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
        "updatedAt": m.updatedAt.isoformat() if m.updatedAt else None,
        "pinned": m.pinned,
        "reactions": m.reactions or {},
        "threadCount": m.threadCount or 0,
        "replyToId": m.replyToId,
        "lastReplyAt": m.lastReplyAt.isoformat() if m.lastReplyAt else None,
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

@router.put("/{message_id}")
async def edit_message(
    message_id: str,
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Edit a message."""
    result = await db.execute(select(ClassroomMessage).where(ClassroomMessage.id == message_id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    if msg.userId != current_user["id"]:
        raise HTTPException(status_code=403, detail="Unauthorized")

    if "content" in data:
        msg.content = data["content"]
        msg.updatedAt = datetime.utcnow()
        await db.flush()
    return {"success": True, "message": _msg_to_dict(msg)}

@router.post("/{message_id}/react")
async def react_to_message(
    message_id: str,
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """React to a message."""
    emoji = data.get("emoji")
    if not emoji:
        raise HTTPException(status_code=400, detail="emoji is required")

    result = await db.execute(select(ClassroomMessage).where(ClassroomMessage.id == message_id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    reactions = msg.reactions or {}
    users_who_reacted = reactions.get(emoji, [])
    user_id = current_user["id"]
    
    if user_id in users_who_reacted:
        users_who_reacted.remove(user_id)
    else:
        users_who_reacted.append(user_id)
        
    if not users_who_reacted:
        reactions.pop(emoji, None)
    else:
        reactions[emoji] = users_who_reacted
        
    msg.reactions = dict(reactions) # Trigger SQLAlchemy JSON update
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(msg, "reactions")
    
    await db.flush()
    return {"success": True, "reactions": msg.reactions}

@router.post("/{message_id}/pin")
async def pin_message(
    message_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Pin a message."""
    caller_role = current_user.get("role", "student")
    if caller_role not in ("admin", "superadmin", "subadmin", "tutor"):
        raise HTTPException(status_code=403, detail="Unauthorized")

    result = await db.execute(select(ClassroomMessage).where(ClassroomMessage.id == message_id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    msg.pinned = True
    await db.flush()
    return {"success": True}

@router.post("/{message_id}/unpin")
async def unpin_message(
    message_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Unpin a message."""
    caller_role = current_user.get("role", "student")
    if caller_role not in ("admin", "superadmin", "subadmin", "tutor"):
        raise HTTPException(status_code=403, detail="Unauthorized")

    result = await db.execute(select(ClassroomMessage).where(ClassroomMessage.id == message_id))
    msg = result.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    msg.pinned = False
    await db.flush()
    return {"success": True}

@router.post("/{message_id}/reply")
async def reply_to_message(
    message_id: str,
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reply to a message (Thread)."""
    content = data.get("content")
    if not content:
        raise HTTPException(status_code=400, detail="content is required")

    result = await db.execute(select(ClassroomMessage).where(ClassroomMessage.id == message_id))
    parent_msg = result.scalar_one_or_none()
    if not parent_msg:
        raise HTTPException(status_code=404, detail="Parent message not found")

    now = datetime.utcnow()
    reply = ClassroomMessage(
        id=f"msg-{int(now.timestamp())}-{random.randint(1000, 9999)}",
        classroomId=parent_msg.classroomId,
        userId=current_user["id"],
        content=content,
        replyToId=parent_msg.id,
        createdAt=now,
    )
    db.add(reply)
    
    parent_msg.threadCount = (parent_msg.threadCount or 0) + 1
    parent_msg.lastReplyAt = now
    
    await db.flush()
    return {"success": True, "id": reply.id}
