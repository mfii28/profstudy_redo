"""
Cart API endpoints.
CartItem has no quantity column — multiple rows represent quantity.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import CartItem, User, Course, Book
from typing import Dict
from datetime import datetime

router = APIRouter()


def _cart_item_to_dict(item: CartItem) -> dict:
    return {
        "id": item.id,
        "userId": item.userId,
        "courseId": item.courseId,
        "bookId": item.bookId,
        "createdAt": item.createdAt.isoformat() if item.createdAt else None,
    }


@router.get("/")
async def get_cart(
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's cart items, grouped to compute quantities."""
    result = await db.execute(
        select(CartItem).where(CartItem.userId == current_user["id"])
    )
    items = result.scalars().all()

    # Group by courseId and bookId to compute quantity from row count
    grouped = {}
    for item in items:
        key = f"course:{item.courseId}" if item.courseId else f"book:{item.bookId}"
        if key not in grouped:
            grouped[key] = {
                "courseId": item.courseId,
                "bookId": item.bookId,
                "quantity": 0,
                "itemIds": [],
            }
        grouped[key]["quantity"] += 1
        grouped[key]["itemIds"].append(item.id)

    cart_items = list(grouped.values())

    # Enrich with item details if needed
    return {"items": cart_items, "rawCount": len(items)}


@router.post("/add")
async def add_to_cart(
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add an item to cart (courseId or bookId). Creates a new row each time."""
    course_id = data.get("courseId")
    book_id = data.get("bookId")

    if not course_id and not book_id:
        raise HTTPException(status_code=400, detail="courseId or bookId is required")

    now = datetime.utcnow()
    import random, string
    item_id = f"cart-{now.timestamp()}-{''.join(random.choices(string.ascii_lowercase, k=6))}"

    item = CartItem(
        id=item_id,
        userId=current_user["id"],
        courseId=course_id,
        bookId=book_id,
        createdAt=now,
    )
    db.add(item)
    await db.flush()
    return {"success": True, "id": item_id}


@router.delete("/{item_id}")
async def remove_cart_item(
    item_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a single cart item by its database row ID."""
    result = await db.execute(
        select(CartItem).where(CartItem.id == item_id, CartItem.userId == current_user["id"])
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Cart item not found")
    await db.delete(item)
    await db.flush()
    return {"success": True}


@router.delete("/")
async def clear_cart(
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove all cart items for the current user."""
    await db.execute(
        delete(CartItem).where(CartItem.userId == current_user["id"])
    )
    await db.flush()
    return {"success": True}
