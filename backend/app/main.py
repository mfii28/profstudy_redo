from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.api.v1.endpoints import api_v1_router
from app.services.r2_service import r2_service

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.2.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS configuration to allow local/production Next.js frontend to interact
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all API v1 routes
app.include_router(api_v1_router, prefix=settings.API_V1_STR)

@app.get("/")
async def read_root():
    return {"message": "Welcome to StudyMate API"}

@app.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    # Verify Database Connection
    db_status = "healthy"
    try:
        from sqlalchemy import text
        await db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
        
    # Verify R2 configuration status
    r2_status = "configured" if r2_service.client is not None else "not configured"
    
    return {
        "status": "online",
        "database": db_status,
        "storage_r2": r2_status
    }

