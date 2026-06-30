"""
Admin API endpoints.
Dashboard stats, user management, security telemetry.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import User, Course, Order, Review, Notification, Book, PlatformSettings, Coupon
from typing import Dict, Optional
from datetime import datetime
import random, json

router = APIRouter()

ADMIN_ROLES = ("admin", "superadmin", "subadmin")


async def _require_admin(current_user: Dict, db: AsyncSession):
    """Check if the current user has an admin role.
    First checks JWT claim (fast), then falls back to database lookup."""
    role = current_user.get("role", "")
    if role in ADMIN_ROLES:
        return

    # JWT role not sufficient — check database for actual role
    from app.models.models import User
    result = await db.execute(select(User).where(User.id == current_user.get("id")))
    user = result.scalar_one_or_none()
    if user and user.role and user.role in ADMIN_ROLES:
        # Update the current_user dict with the real role
        current_user["role"] = user.role
        return

    raise HTTPException(status_code=403, detail="Unauthorized")


@router.get("/analytics/overview")
async def get_analytics_overview(
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Platform analytics overview."""
    await _require_admin(current_user, db)

    users_count = (await db.execute(select(func.count(User.id)))).scalar() or 0
    courses_count = (await db.execute(select(func.count(Course.id)))).scalar() or 0
    orders_count = (await db.execute(select(func.count(Order.id)))).scalar() or 0

    # Calculate real revenue from orders
    revenue_result = await db.execute(select(func.coalesce(func.sum(Order.amount), 0)))
    total_revenue = revenue_result.scalar() or 0

    # Recent orders for trend data (last 30 days)
    from datetime import timedelta
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    trend_orders = await db.execute(
        select(Order).where(Order.createdAt >= thirty_days_ago).order_by(Order.createdAt.asc())
    )
    trend_orders_list = trend_orders.scalars().all()

    # Build daily trend data
    trend_by_day = {}
    for o in trend_orders_list:
        day = o.createdAt.strftime("%Y-%m-%d") if o.createdAt else datetime.utcnow().strftime("%Y-%m-%d")
        trend_by_day[day] = trend_by_day.get(day, 0) + (o.amount or 0)

    trend_data = [{"date": d, "revenue": v} for d, v in sorted(trend_by_day.items())]

    # Calculate real enrollment counts from User JSONB
    all_users_result = await db.execute(select(User.id, User.enrollments))
    all_users = all_users_result.all()
    total_enrollments = 0
    for u in all_users:
        if u.enrollments:
            if isinstance(u.enrollments, dict):
                total_enrollments += len(u.enrollments)
            elif isinstance(u.enrollments, list):
                total_enrollments += len(u.enrollments)

    # Calculate retention: users who enrolled in >1 course / total enrolled users
    enrolled_users = 0
    multi_course_users = 0
    for u in all_users:
        if u.enrollments:
            count = 0
            if isinstance(u.enrollments, dict):
                count = len(u.enrollments)
            elif isinstance(u.enrollments, list):
                count = len(u.enrollments)
            if count > 0:
                enrolled_users += 1
            if count > 1:
                multi_course_users += 1
    retention_rate = round((multi_course_users / enrolled_users * 100)) if enrolled_users > 0 else 0

    # Count users with premium subscriptions
    premium_count = (await db.execute(
        select(func.count(User.id)).where(User.isPremium == True)
    )).scalar() or 0

    # Recent reviews
    reviews_result = await db.execute(
        select(Review).order_by(Review.createdAt.desc()).limit(5)
    )
    recent_reviews = reviews_result.scalars().all()

    return {
        "activeUsers": users_count,
        "totalCourses": courses_count,
        "totalEnrollments": total_enrollments,
        "totalRevenue": total_revenue,
        "totalOrders": orders_count,
        "totalSubscriptions": premium_count,
        "retentionRate": retention_rate,
        "trendData": trend_data,
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
    await _require_admin(current_user, db)

    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    total_courses = (await db.execute(select(func.count(Course.id)))).scalar() or 0
    total_orders = (await db.execute(select(func.count(Order.id)))).scalar() or 0
    total_reviews = (await db.execute(select(func.count(Review.id)))).scalar() or 0
    total_books = (await db.execute(select(func.count(Book.id)))).scalar() or 0

    # Calculate real revenue
    revenue_result = await db.execute(select(func.coalesce(func.sum(Order.amount), 0)))
    total_revenue = revenue_result.scalar() or 0

    # Pending tutor approvals
    pending_tutors = await db.execute(
        select(func.count(User.id)).where(User.role == "tutor", User.tutorApproved == False)
    )

    return {
        "totalUsers": total_users,
        "totalCourses": total_courses,
        "totalRevenue": total_revenue,
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
    await _require_admin(current_user, db)

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


# ---------------------------------------------------------------------------
# Admin: User list and detail
# ---------------------------------------------------------------------------
@router.get("/users")
async def list_admin_users(
    page: int = 1,
    page_size: int = 50,
    role: Optional[str] = None,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all users with pagination (admin only)."""
    await _require_admin(current_user, db)

    query = select(User).order_by(User.createdAt.desc())
    count_query = select(func.count(User.id))
    if role:
        query = query.where(User.role == role)
        count_query = count_query.where(User.role == role)

    total = (await db.execute(count_query)).scalar() or 0
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size)
    result = await db.execute(query)
    users = result.scalars().all()

    return {
        "users": [
            {
                "id": u.id, "name": u.name, "email": u.email, "role": u.role,
                "avatar": u.avatar, "bio": u.bio, "status": u.status,
                "tutorApproved": u.tutorApproved, "isPremium": u.isPremium,
                "createdAt": u.createdAt.isoformat() if u.createdAt else None,
            }
            for u in users
        ],
        "total": total, "page": page, "pageSize": page_size,
        "hasMore": (offset + page_size) < total,
    }


@router.get("/users/{user_id}")
async def get_admin_user(
    user_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single user by ID (admin only)."""
    await _require_admin(current_user, db)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "user": {
            "id": user.id, "name": user.name, "email": user.email,
            "role": user.role, "avatar": user.avatar, "bio": user.bio,
            "status": user.status, "tutorApproved": user.tutorApproved,
            "isPremium": user.isPremium,
            "createdAt": user.createdAt.isoformat() if user.createdAt else None,
        }
    }


@router.post("/users/search")
async def search_users(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search users by email or name prefix (admin only)."""
    await _require_admin(current_user, db)

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
    await _require_admin(current_user, db)

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
    await _require_admin(current_user, db)

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
    await _require_admin(current_user, db)

    now = datetime.utcnow()
    payment_id = f"pmt-{int(now.timestamp())}-{random.randint(1000, 9999)}"
    amount = data.get("amount", 0)
    user_id = data.get("userId")
    course_id = data.get("courseId")

    if not user_id:
        raise HTTPException(status_code=400, detail="userId is required")

    # Create an Order record
    order = Order(
        id=payment_id,
        userId=user_id,
        amount=amount,
        status="completed",
        reference=data.get("reference", f"manual-{payment_id}"),
        createdAt=now,
    )
    db.add(order)

    # If courseId provided, also enroll the user
    if course_id:
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if user:
            enrollments = user.enrollments or []
            if isinstance(enrollments, dict):
                enrollments[course_id] = {
                    "courseId": course_id,
                    "enrolledDate": now.isoformat(),
                    "source": "admin_manual_payment",
                    "progress": 0,
                    "completedLessons": [],
                }
            elif isinstance(enrollments, list):
                enrollments.append({
                    "courseId": course_id,
                    "enrolledDate": now.isoformat(),
                    "source": "admin_manual_payment",
                    "progress": 0,
                    "completedLessons": [],
                })
            user.enrollments = enrollments
            user.updatedAt = now

    await db.flush()
    return {"success": True, "paymentId": payment_id, "totalAmount": amount}


@router.post("/ip-blocklist")
async def block_ip(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add an IP to the blocklist."""
    await _require_admin(current_user, db)

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
    await _require_admin(current_user, db)

    result = await db.execute(select(PlatformSettings).where(PlatformSettings.id == "ip-blocklist"))
    setting = result.scalar_one_or_none()

    if setting and setting.settings:
        ips = setting.settings.get("ips", [])
        setting.settings = {"ips": [i for i in ips if i.get("ip") != block_id and i.get("id") != block_id]}
        await db.flush()

    return {"ok": True}


@router.post("/coupons")
async def create_coupon(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new coupon (admin only)."""
    await _require_admin(current_user, db)
    now = datetime.utcnow()
    coupon = Coupon(
        id=f"cup-{int(now.timestamp())}",
        code=data.get("code", "").strip().upper(),
        discountPct=data.get("discountPct", 0),
        maxUses=data.get("maxUses"),
        courseId=data.get("courseId"),
        expiresAt=datetime.fromisoformat(data["expiresAt"]) if data.get("expiresAt") else None,
        createdAt=now,
        updatedAt=now,
    )
    db.add(coupon)
    await db.flush()
    return {"success": True, "id": coupon.id}


@router.get("/coupons")
async def list_coupons(
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all coupons (admin only)."""
    await _require_admin(current_user, db)
    result = await db.execute(select(Coupon).order_by(Coupon.createdAt.desc()))
    coupons = result.scalars().all()
    return {
        "coupons": [
            {
                "id": c.id,
                "code": c.code,
                "discountPct": c.discountPct,
                "maxUses": c.maxUses,
                "usedCount": c.usedCount,
                "courseId": c.courseId,
                "expiresAt": c.expiresAt.isoformat() if c.expiresAt else None,
                "createdAt": c.createdAt.isoformat() if c.createdAt else None,
            }
            for c in coupons
        ]
    }


@router.delete("/coupons/{coupon_id}")
async def delete_coupon(
    coupon_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a coupon (admin only)."""
    await _require_admin(current_user, db)
    result = await db.execute(select(Coupon).where(Coupon.id == coupon_id))
    coupon = result.scalar_one_or_none()
    if not coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
    await db.delete(coupon)
    await db.flush()
    return {"success": True}


# ---------------------------------------------------------------------------
# Email Templates
# ---------------------------------------------------------------------------
@router.get("/email-templates")
async def list_email_templates(
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all email templates (admin only)."""
    await _require_admin(current_user, db)
    result = await db.execute(
        select(PlatformSettings).where(PlatformSettings.id == "email-templates")
    )
    row = result.scalar_one_or_none()
    templates = row.settings if row and row.settings else {}
    return {"templates": templates}


@router.put("/email-templates/{key:path}")
async def update_email_template(
    key: str,
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a single email template (admin only)."""
    await _require_admin(current_user, db)
    result = await db.execute(
        select(PlatformSettings).where(PlatformSettings.id == "email-templates")
    )
    row = result.scalar_one_or_none()
    templates = dict(row.settings) if row and row.settings else {}
    templates[key] = data
    if row:
        row.settings = templates
    else:
        db.add(PlatformSettings(id="email-templates", settings=templates))
    await db.flush()
    return {"success": True}


# ---------------------------------------------------------------------------
# Communication Templates
# ---------------------------------------------------------------------------
@router.get("/communication-templates")
async def list_communication_templates(
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all communication templates (admin only)."""
    await _require_admin(current_user, db)
    result = await db.execute(
        select(PlatformSettings).where(PlatformSettings.id == "communication-templates")
    )
    row = result.scalar_one_or_none()
    templates = row.settings if row and row.settings else {}
    return {"templates": templates}


@router.put("/communication-templates/{key:path}")
async def update_communication_template(
    key: str,
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a single communication template (admin only)."""
    await _require_admin(current_user, db)
    result = await db.execute(
        select(PlatformSettings).where(PlatformSettings.id == "communication-templates")
    )
    row = result.scalar_one_or_none()
    templates = dict(row.settings) if row and row.settings else {}
    templates[key] = data
    if row:
        row.settings = templates
    else:
        db.add(PlatformSettings(id="communication-templates", settings=templates))
    await db.flush()
    return {"success": True}


# ---------------------------------------------------------------------------
# Affiliates (stored as platform settings)
# ---------------------------------------------------------------------------
AFFILIATES_KEY = "affiliates"


@router.get("/affiliates")
async def list_affiliates(
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all affiliates (admin only)."""
    await _require_admin(current_user, db)
    result = await db.execute(
        select(PlatformSettings).where(PlatformSettings.id == AFFILIATES_KEY)
    )
    row = result.scalar_one_or_none()
    affiliates = row.settings if row and row.settings else []
    return {"affiliates": affiliates}


@router.post("/affiliates")
async def create_affiliate(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new affiliate (admin only)."""
    await _require_admin(current_user, db)
    result = await db.execute(
        select(PlatformSettings).where(PlatformSettings.id == AFFILIATES_KEY)
    )
    row = result.scalar_one_or_none()
    affiliates = list(row.settings) if row and row.settings else []
    affiliate = {**data, "id": data.get("id", f"aff_{len(affiliates)+1}")}
    affiliates.append(affiliate)
    if row:
        row.settings = affiliates
    else:
        db.add(PlatformSettings(id=AFFILIATES_KEY, settings=affiliates))
    await db.flush()
    return {"affiliate": affiliate}


@router.delete("/affiliates/{affiliate_id}")
async def delete_affiliate(
    affiliate_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an affiliate (admin only)."""
    await _require_admin(current_user, db)
    result = await db.execute(
        select(PlatformSettings).where(PlatformSettings.id == AFFILIATES_KEY)
    )
    row = result.scalar_one_or_none()
    if not row or not row.settings:
        raise HTTPException(status_code=404, detail="Affiliates not found")
    affiliates = list(row.settings)
    affiliates = [a for a in affiliates if a.get("id") != affiliate_id]
    row.settings = affiliates
    await db.flush()
    return {"success": True}


@router.post("/affiliates/user/{user_id}")
async def save_affiliate_to_user(
    user_id: str,
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Save affiliate profile to a user (admin only)."""
    await _require_admin(current_user, db)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.affiliateProfile = data
    await db.flush()
    return {"success": True}


@router.delete("/affiliates/user/{user_id}")
async def remove_affiliate_from_user(
    user_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove affiliate profile from a user (admin only)."""
    await _require_admin(current_user, db)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.affiliateProfile = None
    await db.flush()
    return {"success": True}


# ---------------------------------------------------------------------------
# Audit Logs (stored as platform settings)
# ---------------------------------------------------------------------------
AUDIT_LOGS_KEY = "audit-logs"


@router.get("/audit-logs")
async def list_audit_logs(
    count: int = 50,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List audit logs (admin only)."""
    await _require_admin(current_user, db)
    result = await db.execute(
        select(PlatformSettings).where(PlatformSettings.id == AUDIT_LOGS_KEY)
    )
    row = result.scalar_one_or_none()
    logs = list(row.settings) if row and row.settings else []
    return {"logs": logs[:count]}


@router.post("/audit-logs")
async def create_audit_log(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create an audit log entry (admin only)."""
    await _require_admin(current_user, db)
    result = await db.execute(
        select(PlatformSettings).where(PlatformSettings.id == AUDIT_LOGS_KEY)
    )
    row = result.scalar_one_or_none()
    logs = list(row.settings) if row and row.settings else []
    log_entry = {
        **data,
        "id": data.get("id", f"log_{len(logs)+1}"),
        "timestamp": datetime.utcnow().isoformat(),
    }
    logs.append(log_entry)
    if row:
        row.settings = logs
    else:
        db.add(PlatformSettings(id=AUDIT_LOGS_KEY, settings=logs))
    await db.flush()
    return {"success": True}
