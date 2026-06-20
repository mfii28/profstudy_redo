from fastapi import APIRouter, Depends, HTTPException, Query, Header, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import select, and_
from app.core.database import get_db
from app.core.config import settings
from app.core.security import get_current_user
from app.models.models import User, Order, CartItem, BookPurchase, Course
from app.services.email_service import email_service
import httpx
import hmac
import hashlib
from typing import Dict, Any, Optional

router = APIRouter()

PAYSTACK_INIT_URL = "https://api.paystack.co/transaction/initialize"
PAYSTACK_VERIFY_URL = "https://api.paystack.co/transaction/verify/"

@router.post("/initialize")
async def initialize_transaction(
    payload: Dict[str, Any],
    current_user: Dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Initializes a Paystack transaction and creates a pending Order in the database.
    """
    uid = current_user["id"]
    email = payload.get("email")
    amount = payload.get("amount") # Expected in GHS
    metadata = payload.get("metadata", {})
    
    if not email or not amount:
        raise HTTPException(status_code=400, detail="Email and amount are required.")
        
    # Convert amount to kobo (GHS * 100)
    amount_kobo = int(round(amount * 100))
    
    # Inject user ID in metadata to link user
    if isinstance(metadata, dict):
        metadata["userId"] = uid
        
    # Call Paystack initialize
    headers = {
        "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}",
        "Content-Type": "application/json"
    }
    
    request_body = {
        "email": email,
        "amount": amount_kobo,
        "metadata": metadata
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(PAYSTACK_INIT_URL, json=request_body, headers=headers)
            res_data = response.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to reach Paystack: {str(e)}")
            
    if response.status_code != 200 or not res_data.get("status"):
        raise HTTPException(
            status_code=400,
            detail=res_data.get("message", "Failed to initialize Paystack transaction.")
        )
        
    data = res_data.get("data", {})
    reference = data.get("reference")
    authorization_url = data.get("authorization_url")
    
    if not reference or not authorization_url:
        raise HTTPException(status_code=500, detail="Invalid response from payment provider.")
        
    # Persist pending order
    order = Order(
        id=f"ord-{reference}",
        userId=uid,
        amount=float(amount),
        status="pending",
        reference=reference
    )
    db.add(order)
    db.commit()
    
    return {
        "authorization_url": authorization_url,
        "reference": reference
    }

@router.get("/verify")
async def verify_transaction(
    reference: str = Query(...),
    expectedAmount: Optional[float] = Query(None),
    current_user: Dict = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Verifies a transaction with Paystack and fulfills the purchase.
    """
    uid = current_user["id"]
    
    # Check if order is already completed
    order = db.query(Order).filter(Order.reference == reference).first()
    if order and order.status == "completed":
        return {
            "success": True,
            "status": "completed",
            "message": "Order already fulfilled.",
            "orderId": order.id
        }
        
    # Verify with Paystack
    headers = {
        "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{PAYSTACK_VERIFY_URL}{reference}", headers=headers)
            res_data = response.json()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to contact Paystack: {str(e)}")
            
    if response.status_code != 200 or not res_data.get("status"):
        raise HTTPException(status_code=400, detail="Verification request failed.")
        
    data = res_data.get("data", {})
    if data.get("status") != "success":
        return {
            "success": False,
            "status": data.get("status"),
            "message": data.get("gateway_response", "Transaction was not successful.")
        }
        
    # Validate amount
    actual_amount = data.get("amount") / 100.0 # Convert from kobo to GHS
    if expectedAmount is not None:
        tolerance = expectedAmount * 0.01
        if abs(actual_amount - expectedAmount) > tolerance:
            raise HTTPException(
                status_code=400,
                detail=f"Amount mismatch: expected {expectedAmount}, got {actual_amount}"
            )
            
    # Validate user match
    metadata = data.get("metadata", {})
    if isinstance(metadata, dict) and metadata.get("userId") != uid:
        raise HTTPException(
            status_code=403,
            detail="Unauthorized: Transaction belongs to a different user."
        )
        
    # Perform fulfillment
    # 1. Update/Create Order in DB
    if not order:
        order = Order(
            id=f"ord-{reference}",
            userId=uid,
            amount=actual_amount,
            status="completed",
            reference=reference
        )
        db.add(order)
    else:
        order.status = "completed"
        
    # 2. Add Book Purchase records if checkout type was book_purchase
    checkout_type = metadata.get("checkoutType")
    if checkout_type == "book_purchase":
        book_id = metadata.get("bookId")
        if book_id:
            purchase = BookPurchase(
                id=f"bp-{reference}",
                userId=uid,
                bookId=book_id
            )
            db.add(purchase)
            
    # 3. Clear cart if checkout type was cart_purchase
    elif checkout_type == "cart_purchase":
        db.query(CartItem).filter(CartItem.userId == uid).delete()
        
    db.commit()
    
    # 4. Trigger Email Notification (Asynchronous/Non-blocking)
    user = db.query(User).filter(User.id == uid).first()
    if user and user.email:
        email_html = f"""
        <h1>Payment Confirmed!</h1>
        <p>Hi {user.name or 'Student'},</p>
        <p>Your payment of <b>GHS {actual_amount:.2f}</b> has been received successfully.</p>
        <p>Order Reference: <b>{reference}</b></p>
        <p>Thank you for studying with StudyMate!</p>
        """
        await email_service.send_email(
            to=user.email,
            subject="StudyMate Payment Confirmed",
            html=email_html
        )
        
    return {
        "success": True,
        "status": "completed",
        "orderId": order.id,
        "amount": actual_amount
    }

@router.post("/webhook")
async def paystack_webhook(
    request: Request,
    x_paystack_signature: str = Header(None),
    db: Session = Depends(get_db)
):
    """
    Paystack Webhook Endpoint. Processes charge.success events to fulfill orders.
    """
    if not x_paystack_signature:
        raise HTTPException(status_code=401, detail="Missing Paystack signature.")
        
    body = await request.body()
    
    # Verify signature
    computed_sig = hmac.new(
        settings.PAYSTACK_SECRET_KEY.encode('utf-8'),
        body,
        hashlib.sha512
    ).hexdigest()
    
    if not hmac.compare_digest(computed_sig, x_paystack_signature):
        raise HTTPException(status_code=401, detail="Invalid signature.")
        
    payload = await request.json()
    event = payload.get("event")
    
    if event == "charge.success":
        data = payload.get("data", {})
        reference = data.get("reference")
        amount = data.get("amount") / 100.0 # Convert from kobo to GHS
        metadata = data.get("metadata", {})
        
        # Check if order is already completed
        order = db.query(Order).filter(Order.reference == reference).first()
        if order and order.status == "completed":
            return {"status": "success", "message": "Order already processed."}
            
        user_id = metadata.get("userId")
        if not user_id:
            return {"status": "ignored", "message": "No userId in metadata."}
            
        # Update or create the completed order
        if not order:
            order = Order(
                id=f"ord-{reference}",
                userId=user_id,
                amount=amount,
                status="completed",
                reference=reference
            )
            db.add(order)
        else:
            order.status = "completed"
            
        # Book purchase logic
        checkout_type = metadata.get("checkoutType")
        if checkout_type == "book_purchase":
            book_id = metadata.get("bookId")
            if book_id:
                purchase = BookPurchase(
                    id=f"bp-{reference}",
                    userId=user_id,
                    bookId=book_id
                )
                db.add(purchase)
        elif checkout_type == "cart_purchase":
            db.query(CartItem).filter(CartItem.userId == user_id).delete()
            
        db.commit()
        
    return {"status": "success"}
