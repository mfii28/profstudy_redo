"""
Async SQLAlchemy database session with Supabase-compatible PostgreSQL.
Replaces the legacy PostgresPyMongoCompat shim.
Uses lazy initialization so importing the module does not trigger a connection.
"""

from functools import lru_cache
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings


@lru_cache(maxsize=1)
def _get_engine():
    return create_async_engine(
        settings.DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        echo=False,
    )


@lru_cache(maxsize=1)
def _get_session_factory():
    return async_sessionmaker(
        _get_engine(),
        class_=AsyncSession,
        expire_on_commit=False,
    )


async def get_db():
    """FastAPI dependency that yields an async SQLAlchemy session."""
    factory = _get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_db_session() -> AsyncSession:
    """Direct async session getter (use outside of FastAPI routes)."""
    factory = _get_session_factory()
    async with factory() as session:
        return session
