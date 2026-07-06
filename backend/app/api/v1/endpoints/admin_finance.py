from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Dict, Any, List, Optional
import uuid
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Payout, PlatformSettings, Order

router = APIRouter()

async def require_admin(current_user: Dict, db: AsyncSession) -> User:
    uid = current_user.get("id")
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
        
    result = await db.execute(select(User).where(User.id == uid))
    db_user = result.scalar_one_or_none()
    
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if db_user.role not in ["admin", "superadmin", "subadmin"]:
        raise HTTPException(status_code=403, detail="Unauthorized: Admin access required")
        
    return db_user

@router.get("/payouts")
async def get_payouts(db: AsyncSession = Depends(get_db), current_user: Dict = Depends(get_current_user)):
    await require_admin(current_user, db)
    result = await db.execute(select(Payout).order_by(Payout.date.desc()))
    return result.scalars().all()

@router.get("/payouts/tutor/{tutor_id}")
async def get_payouts_by_tutor(tutor_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Payout).where(Payout.tutorId == tutor_id).order_by(Payout.date.desc()))
    return result.scalars().all()

@router.patch("/payouts/{payout_id}/status")
async def update_payout_status(
    payout_id: str, 
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db), 
    current_user: Dict = Depends(get_current_user)
):
    await require_admin(current_user, db)
    status = payload.get("status")
    if not status:
        raise HTTPException(status_code=400, detail="status required")
        
    result = await db.execute(select(Payout).where(Payout.id == payout_id))
    payout = result.scalar_one_or_none()
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")
        
    payout.status = status
    await db.flush()
    return {"ok": True}

@router.get("/subscription-plans")
async def get_subscription_plans(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PlatformSettings).where(PlatformSettings.id == "subscription-plans"))
    record = result.scalar_one_or_none()
    
    if record and record.settings and "plans" in record.settings:
        return record.settings["plans"]
        
    default_plans = [
        { "id": "plan-basic", "name": "Basic AI", "price": "0", "interval": "month", "activeSubscribers": 1200, "features": ["Daily Chat", "Basic Quizzes"] },
        { "id": "plan-premium", "name": "Premium AI", "price": "25", "interval": "month", "activeSubscribers": 450, "features": ["Unlimited Chat", "Unlimited Quizzes", "Study Plans"] }
    ]
    
    if record:
        record.settings = {"plans": default_plans}
    else:
        new_record = PlatformSettings(id="subscription-plans", settings={"plans": default_plans})
        db.add(new_record)
    
    await db.flush()
    return default_plans

@router.post("/subscription-plans")
async def save_subscription_plan(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    await require_admin(current_user, db)
    
    result = await db.execute(select(PlatformSettings).where(PlatformSettings.id == "subscription-plans"))
    record = result.scalar_one_or_none()
    
    current_plans = record.settings.get("plans", []) if record and record.settings else []
    
    idx = next((i for i, p in enumerate(current_plans) if p.get("id") == payload.get("id")), -1)
    if idx >= 0:
        current_plans[idx] = payload
    else:
        current_plans.append(payload)
        
    if record:
        record.settings = {"plans": current_plans}
    else:
        new_record = PlatformSettings(id="subscription-plans", settings={"plans": current_plans})
        db.add(new_record)
        
    await db.flush()
    return {"ok": True}

@router.delete("/subscription-plans/{plan_id}")
async def delete_subscription_plan(
    plan_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    await require_admin(current_user, db)
    
    result = await db.execute(select(PlatformSettings).where(PlatformSettings.id == "subscription-plans"))
    record = result.scalar_one_or_none()
    
    if record and record.settings:
        current_plans = record.settings.get("plans", [])
        current_plans = [p for p in current_plans if p.get("id") != plan_id]
        record.settings = {"plans": current_plans}
        await db.flush()
        
    return {"ok": True}

@router.get("/commission-config")
async def get_commission_config(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PlatformSettings).where(PlatformSettings.id == "commission-config"))
    record = result.scalar_one_or_none()
    
    if record and record.settings:
        return record.settings
        
    return {"defaultRate": 20, "overrides": []}

@router.post("/commission-config")
async def save_commission_config(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    await require_admin(current_user, db)
    
    result = await db.execute(select(PlatformSettings).where(PlatformSettings.id == "commission-config"))
    record = result.scalar_one_or_none()
    
    if record:
        record.settings = payload
    else:
        new_record = PlatformSettings(id="commission-config", settings=payload)
        db.add(new_record)
        
    await db.flush()
    return {"ok": True}

@router.get("/orders")
async def get_orders(user_id: Optional[str] = None, db: AsyncSession = Depends(get_db), current_user: Dict = Depends(get_current_user)):
    await require_admin(current_user, db)
    
    query = select(Order).order_by(Order.createdAt.desc())
    if user_id:
        query = query.where(Order.userId == user_id)
        
    result = await db.execute(query)
    orders = result.scalars().all()
    
    # Normally we'd include user info here, but simulating what finance.ts returns
    out = []
    for o in orders:
        out.append({
            "id": o.id,
            "userId": o.userId,
            "orderId": o.id,
            "date": o.createdAt.isoformat() if o.createdAt else None,
            "total": o.amount,
            "status": o.status,
            "items": "Course Enrollment",
            "paymentReference": o.reference,
        })
    return out

@router.patch("/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    await require_admin(current_user, db)
    status = payload.get("status")
    
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    order.status = status
    await db.flush()
    return {"ok": True}
