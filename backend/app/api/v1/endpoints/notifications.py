"""
Notifications API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Notification, User
from typing import Dict
from datetime import datetime
import random

router = APIRouter()


def _notif_to_dict(n: Notification) -> dict:
    return {
        "id": n.id,
        "userId": n.userId,
        "title": n.title,
        "message": n.message,
        "isRead": n.isRead,
        "createdAt": n.createdAt.isoformat() if n.createdAt else None,
    }


@router.get("/")
async def list_notifications(
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List notifications for the current user."""
    result = await db.execute(
        select(Notification)
        .where(Notification.userId == current_user["id"])
        .order_by(Notification.createdAt.desc())
        .limit(100)
    )
    notifications = result.scalars().all()
    return {"notifications": [_notif_to_dict(n) for n in notifications]}


@router.post("/")
async def create_notification(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a notification for a user (admin or system)."""
    user_id = data.get("userId") or current_user["id"]
    title = data.get("title", "")
    message = data.get("message") or data.get("description", "")

    if not title or not message:
        raise HTTPException(status_code=400, detail="title and message are required")

    now = datetime.utcnow()
    notif = Notification(
        id=f"notif-{now.timestamp()}-{random.randint(1000, 9999)}",
        userId=user_id,
        title=title,
        message=message,
        isRead=False,
        createdAt=now,
    )
    db.add(notif)
    await db.flush()
    return {"success": True, "id": notif.id}


@router.put("/{notif_id}/read")
async def mark_notification_read(
    notif_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a notification as read."""
    result = await db.execute(
        select(Notification).where(
            Notification.id == notif_id,
            Notification.userId == current_user["id"],
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.isRead = True
    await db.flush()
    return {"success": True}


@router.post("/broadcast")
async def broadcast_notification(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Broadcast a notification to users matching a role filter (admin only)."""
    caller_role = current_user.get("role", "student")
    if caller_role not in ("admin", "superadmin", "subadmin"):
        raise HTTPException(status_code=403, detail="Unauthorized")

    title = data.get("title", "")
    message = data.get("message", "")
    role_filter = data.get("audience")  # e.g. "student", "tutor"
    target_user_id = data.get("targetUserId")

    if not title or not message:
        raise HTTPException(status_code=400, detail="title and message are required")

    now = datetime.utcnow()
    notified_count = 0

    if target_user_id:
        notif = Notification(
            id=f"notif-{now.timestamp()}-{random.randint(1000, 9999)}",
            userId=target_user_id,
            title=title,
            message=message,
            isRead=False,
            createdAt=now,
        )
        db.add(notif)
        notified_count = 1
    elif role_filter:
        result = await db.execute(
            select(User).where(User.role == role_filter).limit(500)
        )
        users = result.scalars().all()
        for user in users:
            notif = Notification(
                id=f"notif-{now.timestamp()}-{random.randint(1000, 9999)}",
                userId=user.id,
                title=title,
                message=message,
                isRead=False,
                createdAt=now,
            )
            db.add(notif)
            notified_count += 1

    await db.flush()
    return {"success": True, "notifiedCount": notified_count}
