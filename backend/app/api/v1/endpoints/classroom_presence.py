"""
Classroom Presence API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import ClassroomPresence
from typing import Dict
from datetime import datetime
import random

router = APIRouter()


def _presence_to_dict(p: ClassroomPresence) -> dict:
    return {
        "id": p.id,
        "classroomId": p.classroomId,
        "userId": p.userId,
        "status": p.status,
        "lastActive": p.lastActive.isoformat() if p.lastActive else None,
    }


@router.get("/{classroom_id}")
async def list_presence(
    classroom_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List presence records in a classroom."""
    result = await db.execute(
        select(ClassroomPresence).where(ClassroomPresence.classroomId == classroom_id)
    )
    records = result.scalars().all()
    return {"presence": [_presence_to_dict(r) for r in records]}


@router.post("/")
async def upsert_presence(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upsert a presence record for the current user in a classroom."""
    classroom_id = data.get("classroomId")
    status = data.get("status", "online")

    if not classroom_id:
        raise HTTPException(status_code=400, detail="classroomId is required")

    now = datetime.utcnow()
    presence_id = f"{classroom_id}_{current_user['id']}"

    result = await db.execute(select(ClassroomPresence).where(ClassroomPresence.id == presence_id))
    existing = result.scalar_one_or_none()

    if existing:
        existing.status = status
        existing.lastActive = now
    else:
        presence = ClassroomPresence(
            id=presence_id,
            classroomId=classroom_id,
            userId=current_user["id"],
            status=status,
            lastActive=now,
        )
        db.add(presence)

    await db.flush()
    return {"success": True}
