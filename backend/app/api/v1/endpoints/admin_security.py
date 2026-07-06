from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Dict, Any, List, Optional
import uuid
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, IpBlock, Order

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

@router.get("/telemetry")
async def get_security_telemetry(db: AsyncSession = Depends(get_db), current_user: Dict = Depends(get_current_user)):
    await require_admin(current_user, db)
    
    users_result = await db.execute(select(User).limit(1000))
    users = users_result.scalars().all()
    
    orders_result = await db.execute(select(Order).where(Order.status == "Cancelled").limit(5))
    failed_orders = orders_result.scalars().all()
    
    blocks_result = await db.execute(select(IpBlock).order_by(IpBlock.timestamp.desc()).limit(100))
    blocklist = blocks_result.scalars().all()
    
    return {
        "users": users,
        "failedOrders": failed_orders,
        "blocklist": blocklist
    }

@router.post("/block-ip")
async def block_ip(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    admin = await require_admin(current_user, db)
    ip = payload.get("ip")
    reason = payload.get("reason", "")
    
    if not ip:
        raise HTTPException(status_code=400, detail="IP address is required")
        
    new_block = IpBlock(
        id=f"block-{int(datetime.utcnow().timestamp()*1000)}",
        ip=ip.strip(),
        reason=reason.strip(),
        blockedBy=admin.id,
        timestamp=datetime.utcnow()
    )
    
    db.add(new_block)
    await db.flush()
    
    return {"ok": True, "block": new_block}

@router.delete("/block-ip/{block_id}")
async def unblock_ip(
    block_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: Dict = Depends(get_current_user)
):
    await require_admin(current_user, db)
    
    result = await db.execute(select(IpBlock).where(IpBlock.id == block_id))
    block = result.scalar_one_or_none()
    
    if not block:
        raise HTTPException(status_code=404, detail="Block not found")
        
    await db.delete(block)
    await db.flush()
    
    return {"ok": True}
