from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import get_db
from app.api.v1.endpoints.storage import router as storage_router
from app.api.v1.endpoints.payments import router as payments_router
from app.api.v1.endpoints.rag import router as rag_router
from app.api.v1.endpoints.ai_tutor import router as ai_tutor_router
from app.services.r2_service import r2_service

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS configuration to allow local/production Next.js frontend to interact
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to specific domains (e.g. localhost:3000) in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount APIRouters
app.include_router(storage_router, prefix=f"{settings.API_V1_STR}/storage", tags=["storage"])
app.include_router(payments_router, prefix=f"{settings.API_V1_STR}/payments", tags=["payments"])
app.include_router(rag_router, prefix=f"{settings.API_V1_STR}/rag", tags=["rag"])
app.include_router(ai_tutor_router, prefix=f"{settings.API_V1_STR}/student", tags=["student"])

@app.get("/")
def read_root():
    return {"message": "Welcome to StudyMate API"}

@app.get("/health")
def health_check(db = Depends(get_db)):
    # Verify Database Connection
    db_status = "healthy"
    try:
        # MongoDB ping command to check connectivity
        db.command("ping")
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
        
    # Verify R2 configuration status
    r2_status = "configured" if r2_service.client is not None else "not configured"
    
    return {
        "status": "online",
        "database": db_status,
        "storage_r2": r2_status
    }

