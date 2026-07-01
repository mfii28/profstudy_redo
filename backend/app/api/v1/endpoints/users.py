"""
User management API endpoints.
Handles profile CRUD, role management, email preferences, and student account creation.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user, require_role, rate_limit
from app.models.models import User
from typing import Dict, Optional
from datetime import datetime
import json

router = APIRouter()


# ─── Helper to convert SQLAlchemy User to dict ──────────────────────────

def _user_to_dict(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "avatar": user.avatar,
        "bio": user.bio,
        "address": user.address,
        "role": user.role,
        "status": user.status,
        "lastActive": user.lastActive.isoformat() if user.lastActive else None,
        "studyStreak": user.studyStreak,
        "pointsSpent": user.pointsSpent,
        "referredBy": user.referredBy,
        "emailVerified": user.emailVerified,
        "phone_number": user.phone_number,
        "student_registration_number": user.student_registration_number,
        "affiliate_link": user.affiliate_link,
        "isPremium": user.isPremium,
        "tutorApproved": user.tutorApproved,
        "aiUsage": user.aiUsage,
        "enrollments": user.enrollments if user.enrollments else [],
        "wishlistCourseIds": user.wishlistCourseIds if user.wishlistCourseIds else [],
        "preferences": user.preferences,
        "phoneVerified": user.phoneVerified,
        "registrationVerified": user.registrationVerified,
        "otpHash": user.otpHash,
        "otpExpiresAt": user.otpExpiresAt,
        "otpAttempts": user.otpAttempts,
        "createdAt": user.createdAt.isoformat() if user.createdAt else None,
        "updatedAt": user.updatedAt.isoformat() if user.updatedAt else None,
    }


# ─── GET /users/profile ────────────────────────────────────────────────

@router.get("/profile")
async def get_profile(
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the current user's full profile."""
    result = await db.execute(select(User).where(User.id == current_user["id"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "user": _user_to_dict(user)}


# ─── PUT /users/profile ────────────────────────────────────────────────

@router.put("/profile")
async def update_profile(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the current user's profile fields."""
    result = await db.execute(select(User).where(User.id == current_user["id"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    allowed_fields = {"name", "bio", "avatar", "address", "phone_number",
                      "student_registration_number", "preferences"}
    for key, value in data.items():
        if key in allowed_fields:
            setattr(user, key, value)

    user.updatedAt = datetime.utcnow()
    await db.flush()
    return {"success": True, "user": _user_to_dict(user)}


# ─── POST /users/bootstrap ─────────────────────────────────────────────

@router.post("/bootstrap")
async def bootstrap_profile(
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(rate_limit(10, 60)),  # 10 req/min per IP
):
    """Create a user profile if one doesn't exist yet (idempotent)."""
    result = await db.execute(select(User).where(User.id == current_user["id"]))
    existing = result.scalar_one_or_none()
    if existing:
        return {"isNew": False}

    now = datetime.utcnow()
    new_user = User(
        id=current_user["id"],
        email=current_user.get("email", ""),
        name=current_user.get("name") or current_user.get("displayName") or "Learner",
        role=current_user.get("role", "student"),
        status="active",
        isPremium=False,
        studyStreak=0,
        pointsSpent=0,
        emailVerified=False,
        aiUsage={"tokensRemaining": 50, "lastResetDate": now.isoformat()},
        enrollments=[],
        wishlistCourseIds=[],
        createdAt=now,
        updatedAt=now,
    )
    db.add(new_user)
    await db.flush()
    return {"isNew": True, "user": _user_to_dict(new_user)}


# ─── PUT /users/role ───────────────────────────────────────────────────

@router.put("/role")
async def set_role(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update a user's role. Caller must have higher privileges than the target role.
    """
    target_uid = data.get("targetUid")
    role = data.get("role")

    if not target_uid or not role:
        raise HTTPException(status_code=400, detail="targetUid and role are required")

    valid_roles = ["student", "tutor", "subadmin", "admin", "superadmin"]
    if role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}")

    ROLE_HIERARCHY = ["student", "tutor", "subadmin", "admin", "superadmin"]
    caller_role = current_user.get("role", "student")
    caller_level = ROLE_HIERARCHY.index(caller_role) if caller_role in ROLE_HIERARCHY else -1
    target_level = ROLE_HIERARCHY.index(role) if role in ROLE_HIERARCHY else -1

    if caller_level <= target_level:
        raise HTTPException(status_code=403, detail=f"Unauthorized. You cannot assign the role '{role}'.")

    result = await db.execute(select(User).where(User.id == target_uid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Target user not found")

    user.role = role
    user.updatedAt = datetime.utcnow()
    await db.flush()

    return {"success": True}


# ─── PUT /users/email-verified ─────────────────────────────────────────

@router.put("/email-verified")
async def set_email_verified(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a user's email as verified."""
    target_uid = data.get("uid")
    verified = data.get("verified", True)

    if not target_uid:
        raise HTTPException(status_code=400, detail="uid is required")
    if target_uid != current_user["id"]:
        raise HTTPException(status_code=403, detail="Unauthorized")

    result = await db.execute(select(User).where(User.id == target_uid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.emailVerified = bool(verified)
    user.updatedAt = datetime.utcnow()
    await db.flush()
    return {"success": True}


# ─── PUT /users/email-preferences ──────────────────────────────────────

@router.put("/email-preferences")
async def update_email_preferences(
    data: Dict,
    db: AsyncSession = Depends(get_db),
):
    """Update a user's email preferences by unsubscribe token."""
    token = data.get("token")
    prefs = data.get("preferences", {})

    if not token:
        raise HTTPException(status_code=400, detail="Unsubscribe token is required")

    result = await db.execute(select(User).where(User.id == token))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Invalid unsubscribe token")

    current_prefs = user.preferences or {}
    if "subscribedToMarketing" in prefs:
        current_prefs["notifPromotions"] = prefs["subscribedToMarketing"]
    if "subscribedToTransactional" in prefs:
        current_prefs["notifCourseAnnouncements"] = prefs["subscribedToTransactional"]

    user.preferences = current_prefs
    user.updatedAt = datetime.utcnow()
    await db.flush()
    return {"success": True}


# ─── POST /users/create-student ────────────────────────────────────────

@router.post("/create-student")
async def create_student_account(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only: create a new student account in the database."""
    name = data.get("name")
    email = data.get("email")

    if not name or not email:
        raise HTTPException(status_code=400, detail="name and email are required")

    # Check caller is admin
    caller_role = current_user.get("role", "student")
    if caller_role not in ("admin", "superadmin", "subadmin"):
        raise HTTPException(status_code=403, detail="Unauthorized")

    # Check if user already exists
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="A user with this email already exists")

    now = datetime.utcnow()
    new_user = User(
        id=f"user-{now.timestamp()}-{hash(email) % 10000}",
        email=email,
        name=name,
        role="student",
        status="active",
        phone_number=data.get("phone", ""),
        emailVerified=False,
        isPremium=False,
        enrollments=[],
        aiUsage={"tokensRemaining": 50, "lastResetDate": now.isoformat()},
        createdAt=now,
        updatedAt=now,
    )
    db.add(new_user)
    await db.flush()
    return {"success": True, "uid": new_user.id}


# ─── PUT /users/sync-claims ────────────────────────────────────────────

@router.put("/sync-claims")
async def sync_admin_claims(
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sync a user's role from their profile (placeholder for custom claims logic)."""
    result = await db.execute(select(User).where(User.id == current_user["id"]))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "role": user.role}


# ─── POST /users/check-registration-number ─────────────────────────────

@router.post("/check-registration-number")
async def check_registration_number(
    data: Dict,
    db: AsyncSession = Depends(get_db),
):
    """Check if a student registration number already exists."""
    reg_number = data.get("registrationNumber", "").strip()
    if not reg_number:
        return {"exists": False}

    result = await db.execute(
        select(User).where(User.student_registration_number == reg_number)
    )
    user = result.scalar_one_or_none()
    return {"exists": user is not None}
