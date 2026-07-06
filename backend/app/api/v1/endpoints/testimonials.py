from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Dict, Any, List
import uuid
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user, get_current_user_optional
from app.models.models import Testimonial, User

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

@router.get("/")
async def get_testimonials(group: str = "general", limit: int = 6, db: AsyncSession = Depends(get_db)):
    query = select(Testimonial).where(Testimonial.status == "approved")
    if group and group != "general":
        query = query.where(Testimonial.group == group)
        
    query = query.order_by(Testimonial.submittedAt.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()

@router.get("/all")
async def get_all_testimonials(current_user: Dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await require_admin(current_user, db)
    result = await db.execute(select(Testimonial).order_by(Testimonial.submittedAt.desc()))
    return result.scalars().all()

@router.get("/pending")
async def get_pending_testimonials(current_user: Dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await require_admin(current_user, db)
    result = await db.execute(
        select(Testimonial).where(Testimonial.status == "pending").order_by(Testimonial.submittedAt.desc())
    )
    return result.scalars().all()

@router.post("/")
async def save_testimonial(
    payload: Dict[str, Any],
    current_user: Dict = Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    # This acts for both admin saves and user submissions
    # Determine source
    source = payload.get("source", "user")
    
    if source == "admin":
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        await require_admin(current_user, db)
        status = payload.get("status", "approved")
    else:
        status = "pending"
        
    test_id = payload.get("id")
    now = datetime.utcnow()
    
    if test_id and source == "admin":
        result = await db.execute(select(Testimonial).where(Testimonial.id == test_id))
        existing = result.scalar_one_or_none()
        if not existing:
            raise HTTPException(status_code=404, detail="Testimonial not found")
            
        existing.name = payload.get("name")
        existing.role = payload.get("role")
        existing.avatar = payload.get("avatar", "")
        existing.text = payload.get("text")
        existing.status = payload.get("status", existing.status)
        existing.group = payload.get("group", existing.group)
        existing.reviewedBy = payload.get("reviewedBy", existing.reviewedBy)
        if existing.status != "pending" and not existing.reviewedAt:
            existing.reviewedAt = now
            
        await db.flush()
        return {"id": existing.id}
    else:
        new_test = Testimonial(
            id=f"test-{uuid.uuid4().hex[:12]}",
            name=payload.get("name"),
            role=payload.get("role"),
            text=payload.get("text"),
            avatar=payload.get("avatar", ""),
            status=status,
            group=payload.get("group", "general"),
            source=source,
            submittedBy=current_user.get("id") if current_user else None,
            submittedAt=now
        )
        db.add(new_test)
        await db.flush()
        return {"id": new_test.id}

@router.patch("/{testimonial_id}/status")
async def update_testimonial_status(
    testimonial_id: str,
    payload: Dict[str, Any],
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await require_admin(current_user, db)
    
    status = payload.get("status")
    if not status:
        raise HTTPException(status_code=400, detail="status is required")
        
    result = await db.execute(select(Testimonial).where(Testimonial.id == testimonial_id))
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=404, detail="Testimonial not found")
        
    existing.status = status
    existing.reviewedAt = datetime.utcnow()
    existing.reviewedBy = current_user.get("id")
    
    await db.flush()
    return {"ok": True}

@router.delete("/{testimonial_id}")
async def delete_testimonial(
    testimonial_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await require_admin(current_user, db)
    
    result = await db.execute(select(Testimonial).where(Testimonial.id == testimonial_id))
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=404, detail="Testimonial not found")
        
    await db.delete(existing)
    await db.flush()
    return {"ok": True}
