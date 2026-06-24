"""
Classroom Messages API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import ClassroomMessage
from typing import Dict
from datetime import datetime
import random

router = APIRouter()


def _msg_to_dict(m: ClassroomMessage) -> dict:
    return {
        "id": m.id,
        "classroomId": m.classroomId,
        "userId": m.userId,
        "content": m.content,
        "createdAt": m.createdAt.isoformat() if m.createdAt else None,
    }


@router.get("/{classroom_id}")
async def list_messages(
    classroom_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List messages in a classroom."""
    result = await db.execute(
        select(ClassroomMessage)
        .where(ClassroomMessage.classroomId == classroom_id)
        .order_by(ClassroomMessage.createdAt.desc())
        .limit(200)
    )
    messages = result.scalars().all()
    return {"messages": [_msg_to_dict(m) for m in messages]}


@router.post("/")
async def send_message(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a message in a classroom."""
    classroom_id = data.get("classroomId")
    content = data.get("content")
    if not classroom_id or not content:
        raise HTTPException(status_code=400, detail="classroomId and content are required")

    now = datetime.utcnow()
    msg = ClassroomMessage(
        id=f"msg-{int(now.timestamp())}-{random.randint(1000, 9999)}",
        classroomId=classroom_id,
        userId=current_user["id"],
        content=content,
        createdAt=now,
    )
    db.add(msg)
    await db.flush()
    return {"success": True, "id": msg.id}


@router.delete("/{message_id}")
async def delete_message(
    message_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a message. Only author or admin can delete."""
    result = await db.execute(select(ClassroomMessage).where(ClassroomMessage.id == message_id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    caller_role = current_user.get("role", "student")
    is_admin = caller_role in ("admin", "superadmin", "subadmin")
    if msg.userId != current_user["id"] and not is_admin:
        raise HTTPException(status_code=403, detail="Unauthorized")

    await db.delete(msg)
    await db.flush()
    return {"success": True}
