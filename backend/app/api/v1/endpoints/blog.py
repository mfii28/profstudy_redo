from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import Dict, Any, List
import uuid
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.models import BlogPost, User

router = APIRouter()

async def require_admin(current_user: Dict, db: AsyncSession) -> User:
    uid = current_user.get("id")
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
        
    result = await db.execute(select(User).where(User.id == uid))
    db_user = result.scalar_one_or_none()
    
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if db_user.role not in ["admin", "superadmin", "subadmin"]:
        raise HTTPException(status_code=403, detail="Unauthorized: Admin access required")
        
    return db_user

@router.get("/")
async def get_blog_posts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BlogPost).order_by(BlogPost.createdAt.desc()))
    posts = result.scalars().all()
    return posts

@router.post("/")
async def save_blog_post(
    payload: Dict[str, Any],
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    admin = await require_admin(current_user, db)
    
    post_id = payload.get("id")
    title = payload.get("title", "")
    slug = payload.get("slug") or title.lower().replace(" ", "-")
    
    now = datetime.utcnow()
    status = payload.get("status", "Draft")
    published_at = now if status == "Published" else None
    
    if post_id:
        result = await db.execute(select(BlogPost).where(BlogPost.id == post_id))
        existing = result.scalar_one_or_none()
        if not existing:
            raise HTTPException(status_code=404, detail="Blog post not found")
            
        existing.title = title
        existing.slug = slug
        existing.summary = payload.get("summary", "")
        existing.content = payload.get("content", "")
        existing.coverUrl = payload.get("coverUrl")
        existing.authorId = payload.get("authorId") or admin.id
        existing.authorName = payload.get("authorName") or admin.name or admin.email or "Admin"
        existing.category = payload.get("category")
        existing.tags = payload.get("tags", [])
        existing.status = status
        
        if status == "Published":
            existing.publishedAt = existing.publishedAt or now
        else:
            existing.publishedAt = None
            
        await db.flush()
        return {"id": existing.id}
    else:
        new_post = BlogPost(
            id=f"blog-{uuid.uuid4().hex[:12]}",
            title=title,
            slug=slug,
            summary=payload.get("summary", ""),
            content=payload.get("content", ""),
            coverUrl=payload.get("coverUrl"),
            authorId=payload.get("authorId") or admin.id,
            authorName=payload.get("authorName") or admin.name or admin.email or "Admin",
            category=payload.get("category"),
            tags=payload.get("tags", []),
            status=status,
            publishedAt=published_at
        )
        db.add(new_post)
        await db.flush()
        return {"id": new_post.id}

@router.delete("/{post_id}")
async def delete_blog_post(
    post_id: str,
    current_user: Dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await require_admin(current_user, db)
    
    result = await db.execute(select(BlogPost).where(BlogPost.id == post_id))
    existing = result.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=404, detail="Blog post not found")
        
    await db.delete(existing)
    await db.flush()
    return {"ok": True}
