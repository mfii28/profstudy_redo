"""
Session API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User
from typing import Dict

router = APIRouter()


@router.post("/revoke-all")
async def revoke_all_sessions(
    current_user: Dict = Depends(get_current_user),
):
    """Revoke all sessions for the current user (stub - placeholder)."""
    return {"success": True}
