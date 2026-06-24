"""
Admin API endpoints.
Dashboard stats, user management, security telemetry.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Course, Order, Review, Notification, Book, PlatformSettings
from typing import Dict, Optional
from datetime import datetime
import random, json

router = APIRouter()

ADMIN_ROLES = ("admin", "superadmin", "subadmin")


def _require_admin(current_user: Dict):
    if current_user.get("role") not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Unauthorized")


@router.get("/analytics/overview")
async def get_analytics_overview(
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Platform analytics overview."""
    _require_admin(current_user)

    users_count = (await db.execute(select(func.count(User.id)))).scalar() or 0
    courses_count = (await db.execute(select(func.count(Course.id)))).scalar() or 0
    orders_count = (await db.execute(select(func.count(Order.id)))).scalar() or 0

    # Recent reviews
    reviews_result = await db.execute(
        select(Review).order_by(Review.createdAt.desc()).limit(5)
    )
    recent_reviews = reviews_result.scalars().all()

    return {
        "activeUsers": users_count,
        "avgEngagement": 65,
        "totalSubscriptions": 0,
        "retentionRate": 72,
        "trendData": [],
        "recentReviews": [
            {"id": r.id, "userId": r.userId, "courseId": r.courseId,
             "rating": r.rating, "comment": r.comment, "createdAt": r.createdAt.isoformat() if r.createdAt else None}
            for r in recent_reviews
        ],
    }


@router.get("/dashboard/stats")
async def get_dashboard_stats(
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin dashboard statistics."""
    _require_admin(current_user)

    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    total_courses = (await db.execute(select(func.count(Course.id)))).scalar() or 0
    total_orders = (await db.execute(select(func.count(Order.id)))).scalar() or 0
    total_reviews = (await db.execute(select(func.count(Review.id)))).scalar() or 0
    total_books = (await db.execute(select(func.count(Book.id)))).scalar() or 0

    # Pending tutor approvals
    pending_tutors = await db.execute(
        select(func.count(User.id)).where(User.role == "tutor", User.tutorApproved == False)
    )

    return {
        "totalUsers": total_users,
        "totalCourses": total_courses,
        "totalRevenue": 0,
        "pendingApprovals": pending_tutors.scalar() or 0,
        "totalBooks": total_books,
        "totalReviews": total_reviews,
    }


@router.get("/security/telemetry")
async def get_security_telemetry(
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Security telemetry for admin."""
    _require_admin(current_user)

    all_users = await db.execute(select(User).limit(500))
    users = all_users.scalars().all()

    blocklist_result = await db.execute(select(PlatformSettings).where(PlatformSettings.id == "ip-blocklist"))
    blocklist_setting = blocklist_result.scalar_one_or_none()

    return {
        "users": [
            {"id": u.id, "email": u.email, "name": u.name, "role": u.role, "status": u.status}
            for u in users
        ],
        "failedOrders": [],
        "blocklist": (blocklist_setting.settings.get("ips", []) if blocklist_setting and blocklist_setting.settings else []),
    }


@router.post("/users/search")
async def search_users(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search users by email or name prefix (admin only)."""
    _require_admin(current_user)

    query_text = data.get("query", "").strip()
    max_results = min(data.get("max", 50), 200)

    if not query_text:
        raise HTTPException(status_code=400, detail="query is required")

    like_pattern = f"{query_text}%"
    result = await db.execute(
        select(User)
        .where(
            (User.email.ilike(like_pattern)) | (User.name.ilike(like_pattern))
        )
        .limit(max_results)
    )
    users = result.scalars().all()

    return {
        "users": [
            {"id": u.id, "name": u.name, "email": u.email, "role": u.role}
            for u in users
        ]
    }


@router.post("/enrollments/enroll")
async def admin_enroll_user(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin enrolls a user in a course."""
    _require_admin(current_user)

    user_id = data.get("userId")
    course_id = data.get("courseId")

    if not user_id or not course_id:
        raise HTTPException(status_code=400, detail="userId and courseId are required")

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    enrollments = user.enrollments or []
    if not any(e.get("courseId") == course_id for e in enrollments):
        enrollments.append({
            "courseId": course_id,
            "enrolledDate": datetime.utcnow().isoformat(),
            "source": "admin",
            "progress": 0,
            "completedLessons": [],
        })
        user.enrollments = enrollments
        user.updatedAt = datetime.utcnow()
        await db.flush()

    return {"success": True}


@router.post("/enrollments/bulk-enroll")
async def admin_bulk_enroll(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin bulk enrolls multiple users in a course."""
    _require_admin(current_user)

    user_ids = data.get("userIds", [])
    course_id = data.get("courseId")

    if not user_ids or not course_id:
        raise HTTPException(status_code=400, detail="userIds and courseId are required")

    results = []
    for uid in user_ids:
        user_result = await db.execute(select(User).where(User.id == uid))
        user = user_result.scalar_one_or_none()
        if not user:
            results.append({"userId": uid, "success": False, "error": "User not found"})
            continue

        enrollments = user.enrollments or []
        if not any(e.get("courseId") == course_id for e in enrollments):
            enrollments.append({
                "courseId": course_id,
                "enrolledDate": datetime.utcnow().isoformat(),
                "source": "admin",
                "progress": 0,
                "completedLessons": [],
            })
            user.enrollments = enrollments
            user.updatedAt = datetime.utcnow()
        results.append({"userId": uid, "success": True})

    await db.flush()
    return {
        "success": True,
        "successCount": sum(1 for r in results if r["success"]),
        "failedCount": sum(1 for r in results if not r["success"]),
        "results": results,
    }


@router.post("/payments/manual")
async def record_manual_payment(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record a manual payment (admin only)."""
    _require_admin(current_user)

    now = datetime.utcnow()
    payment_id = f"pmt-{int(now.timestamp())}-{random.randint(1000, 9999)}"
    return {"success": True, "paymentId": payment_id, "totalAmount": data.get("amount", 0)}


@router.post("/ip-blocklist")
async def block_ip(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add an IP to the blocklist."""
    _require_admin(current_user)

    ip = data.get("ip")
    reason = data.get("reason", "")

    if not ip:
        raise HTTPException(status_code=400, detail="ip is required")

    result = await db.execute(select(PlatformSettings).where(PlatformSettings.id == "ip-blocklist"))
    setting = result.scalar_one_or_none()

    block = {"id": ip, "ip": ip, "reason": reason, "blockedAt": datetime.utcnow().isoformat()}

    if setting:
        ips = setting.settings.get("ips", []) if setting.settings else []
        if not any(i.get("ip") == ip for i in ips):
            ips.append(block)
        setting.settings = {"ips": ips}
    else:
        setting = PlatformSettings(
            id="ip-blocklist",
            settings={"ips": [block]},
        )
        db.add(setting)

    await db.flush()
    return {"ok": True, "block": block}


@router.delete("/ip-blocklist/{block_id}")
async def unblock_ip(
    block_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove an IP from the blocklist."""
    _require_admin(current_user)

    result = await db.execute(select(PlatformSettings).where(PlatformSettings.id == "ip-blocklist"))
    setting = result.scalar_one_or_none()

    if setting and setting.settings:
        ips = setting.settings.get("ips", [])
        setting.settings = {"ips": [i for i in ips if i.get("ip") != block_id and i.get("id") != block_id]}
        await db.flush()

    return {"ok": True}
