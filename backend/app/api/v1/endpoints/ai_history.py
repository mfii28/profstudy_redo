"""
AI History API endpoints.
Stores AI tutor interactions in the database.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Notification  # Re-using Notification for AI history
from typing import Dict
from datetime import datetime
import json

# Note: AI history doesn't have its own table. Using a server-action approach
# where history is stored client-side or in the User.aiUsage JSON field.
# This module provides endpoints that simulate the expected API.

router = APIRouter()


@router.get("/")
async def list_ai_history(
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List AI interactions for the current user (stubs - returns empty)."""
    # AI interaction storage is currently client-side via localStorage/indexedDB.
    # This endpoint exists for future server-side persistence.
    return {"interactions": []}


@router.post("/")
async def save_ai_interaction(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save an AI interaction (stub - acknowledged)."""
    return {"success": True, "id": f"ai-{int(datetime.utcnow().timestamp())}"}


@router.delete("/{interaction_id}")
async def delete_ai_interaction(
    interaction_id: str,
    current_user: Dict = Depends(get_current_user),
):
    """Delete an AI interaction (stub)."""
    return {"success": True}
