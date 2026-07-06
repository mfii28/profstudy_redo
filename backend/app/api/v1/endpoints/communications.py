from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, List
from app.core.database import get_db
from app.core.security import get_current_user
from app.services.email_service import email_service

router = APIRouter()

@router.post("/send-email")
async def send_email_endpoint(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Send an email (Platform or Transactional).
    Requires tutor or admin privileges for platform emails.
    """
    email_category = data.get("category", "platform") # "platform" or "transactional"
    to = data.get("to")
    
    if not to:
        raise HTTPException(status_code=400, detail="Missing 'to' field")
        
    role = current_user.get("role", "student")
    if role not in ["admin", "superadmin", "subadmin", "tutor"]:
        raise HTTPException(status_code=403, detail="Not authorized to send emails")

    if email_category == "platform":
        subject = data.get("subject", "Update")
        message = data.get("message", "")
        result = await email_service.send_platform_email(to, subject, message)
        if result.get("success"):
            return {"success": True}
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "Email failed"))
            
    elif email_category == "transactional":
        email_type = data.get("type", "welcome")
        recipient_name = data.get("recipientName", "Member")
        result = await email_service.send_transactional_email(email_type, to, recipient_name, **data)
        if result.get("success"):
            return {"success": True}
        else:
            raise HTTPException(status_code=500, detail=result.get("error", "Email failed"))
            
    else:
        raise HTTPException(status_code=400, detail="Invalid email category")

@router.post("/send-sms")
async def send_sms_endpoint(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Placeholder for SMS endpoint if needed.
    """
    role = current_user.get("role", "student")
    if role not in ["admin", "superadmin", "subadmin", "tutor"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    return {"success": True, "message": "SMS endpoint not fully implemented in FastAPI yet."}
