"""
Session API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, ActiveSession
from typing import Dict
from datetime import datetime

router = APIRouter()


@router.post("/revoke-all")
async def revoke_all_sessions(
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke all sessions for the current user."""
    await db.execute(
        delete(ActiveSession).where(ActiveSession.userId == current_user["id"])
    )
    await db.flush()
    return {"success": True}


@router.get("/")
async def list_sessions(
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List active sessions for the current user."""
    result = await db.execute(
        select(ActiveSession).where(ActiveSession.userId == current_user["id"])
    )
    sessions = result.scalars().all()
    return {
        "sessions": [
            {
                "id": s.id,
                "userId": s.userId,
                "token": s.token[:20] + "..." if s.token else None,
                "expiresAt": s.expiresAt.isoformat() if s.expiresAt else None,
                "createdAt": s.createdAt.isoformat() if s.createdAt else None,
            }
            for s in sessions
        ]
    }


@router.delete("/{session_id}")
async def delete_session(
    session_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a specific session."""
    result = await db.execute(
        select(ActiveSession).where(
            ActiveSession.id == session_id,
            ActiveSession.userId == current_user["id"],
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    await db.flush()
    return {"success": True}
