"""
Books API endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import Book, BookPurchase, User
from typing import Dict
from datetime import datetime
import random

router = APIRouter()


def _book_to_dict(b: Book) -> dict:
    return {
        "id": b.id,
        "title": b.title,
        "price": b.price,
        "status": b.status,
        "createdAt": b.createdAt.isoformat() if b.createdAt else None,
    }


@router.get("/")
async def list_books(
    db: AsyncSession = Depends(get_db),
):
    """List all published books."""
    result = await db.execute(
        select(Book).where(Book.status == "Published").order_by(Book.createdAt.desc())
    )
    books = result.scalars().all()
    return {"books": [_book_to_dict(b) for b in books]}


@router.get("/{book_id}")
async def get_book(
    book_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a single book."""
    result = await db.execute(select(Book).where(Book.id == book_id))
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return {"book": _book_to_dict(book)}


@router.post("/{book_id}/purchase")
async def purchase_book(
    book_id: str,
    data: Dict,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Purchase a book (non-free). Returns initialization URL.
    Actual payment handled via Paystack.
    """
    result = await db.execute(select(Book).where(Book.id == book_id))
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    if book.status != "Published":
        raise HTTPException(status_code=400, detail="Book is not available for purchase")

    # Check for existing purchase
    existing = await db.execute(
        select(BookPurchase).where(
            BookPurchase.userId == current_user["id"],
            BookPurchase.bookId == book_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="You already own this book")

    # For paid books, redirect to payment
    if book.price > 0:
        return {"authorization_url": None, "reference": f"book-{book_id}-{int(datetime.utcnow().timestamp())}"}

    return {"error": "Cannot purchase a free book via this endpoint"}


@router.post("/{book_id}/claim-free")
async def claim_free_book(
    book_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Claim a free book."""
    result = await db.execute(select(Book).where(Book.id == book_id))
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    if book.price > 0:
        raise HTTPException(status_code=400, detail="This book is not free")

    # Check for existing purchase
    existing = await db.execute(
        select(BookPurchase).where(
            BookPurchase.userId == current_user["id"],
            BookPurchase.bookId == book_id,
        )
    )
    if existing.scalar_one_or_none():
        return {"ok": True}  # Idempotent

    now = datetime.utcnow()
    purchase = BookPurchase(
        id=f"bp-{int(now.timestamp())}-{random.randint(1000, 9999)}",
        userId=current_user["id"],
        bookId=book_id,
        createdAt=now,
    )
    db.add(purchase)
    await db.flush()
    return {"ok": True}


@router.post("/{book_id}/create-reader-session")
async def create_reader_session(
    book_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a reader session for a purchased book."""
    # Check purchase
    result = await db.execute(
        select(BookPurchase).where(
            BookPurchase.userId == current_user["id"],
            BookPurchase.bookId == book_id,
        )
    )
    purchase = result.scalar_one_or_none()
    if not purchase:
        raise HTTPException(status_code=403, detail="You have not purchased this book")

    now = datetime.utcnow()
    import hashlib
    token = hashlib.sha256(f"{current_user['id']}-{book_id}-{now.timestamp()}".encode()).hexdigest()[:32]

    return {"token": token, "expiresAt": now.isoformat()}
