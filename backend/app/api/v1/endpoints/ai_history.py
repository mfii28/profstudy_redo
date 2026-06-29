"""
AI History API endpoints.
Stores AI tutor interactions in the User.aiUsage JSONB field.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User
from typing import Dict, List
from datetime import datetime

router = APIRouter()


def _get_interactions(user: User) -> List[dict]:
    usage = user.aiUsage or {}
    return usage.get("interactions", []) if isinstance(usage, dict) else []


def _set_interactions(user: User, interactions: List[dict]) -> None:
    usage = user.aiUsage or {}
    if isinstance(usage, dict):
        usage["interactions"] = interactions
    else:
        usage = {"interactions": interactions}
    user.aiUsage = usage


@router.get("/")
async def list_ai_history(
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List AI interactions for the current user."""
    result = await db.execute(select(User).where(User.id == current_user["id"]))
    user = result.scalar_one_or_none()
    if not user:
        return {"interactions": []}

    interactions = _get_interactions(user)
    # Return latest 50 interactions sorted by timestamp desc
    interactions.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return {"interactions": interactions[:50]}


@router.post("/")
async def save_ai_interaction(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save an AI interaction to the user's aiUsage JSONB field."""
    result = await db.execute(select(User).where(User.id == current_user["id"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    interactions = _get_interactions(user)
    interaction = {
        **data,
        "id": data.get("id", f"ai-{int(datetime.utcnow().timestamp())}-{len(interactions)}"),
        "timestamp": data.get("timestamp", datetime.utcnow().isoformat()),
    }
    interactions.append(interaction)
    _set_interactions(user, interactions)
    await db.flush()
    return {"success": True, "id": interaction["id"]}


@router.delete("/{interaction_id}")
async def delete_ai_interaction(
    interaction_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an AI interaction."""
    result = await db.execute(select(User).where(User.id == current_user["id"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    interactions = _get_interactions(user)
    interactions = [i for i in interactions if i.get("id") != interaction_id]
    _set_interactions(user, interactions)
    await db.flush()
    return {"success": True}
