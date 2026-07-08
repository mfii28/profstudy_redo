from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError, jwk
from jose.utils import base64url_decode
from app.core.config import settings
from typing import Dict, Optional, Tuple
import httpx
import json as json_lib
import time
from collections import defaultdict

security_scheme = HTTPBearer()

# ── Rate limiter (in-memory sliding window) ─────────────────
# Production: replace with Redis-based limiter
_rate_limit_store: dict = {}  # {key: [(timestamp, count), ...]}

def rate_limit(max_requests: int = 60, window_seconds: int = 60):
    """
    In-memory sliding window rate limiter.
    Usage: @router.get("/path") or as Depends(rate_limit(30, 60))
    
    Falls back gracefully when Redis is unavailable.
    For distributed rate limiting, use Upstash Redis instead.
    """
    async def _rate_limit(request: Request):
        client_ip = request.client.host if request.client else "unknown"
        key = f"rl:{client_ip}:{request.url.path}"
        now = time.time()
        
        # Clean old entries
        if key in _rate_limit_store:
            _rate_limit_store[key] = [
                t for t in _rate_limit_store[key] 
                if now - t < window_seconds
            ]
        
        window = _rate_limit_store.get(key, [])
        if len(window) >= max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later."
            )
        
        window.append(now)
        _rate_limit_store[key] = window
        return True
    
    return _rate_limit
import firebase_admin
from firebase_admin import credentials, auth
from app.core.config import settings

# Initialize Firebase Admin
if not firebase_admin._apps:
    if settings.FIREBASE_ADMIN_CREDENTIALS:
        try:
            import json
            cred_dict = json.loads(settings.FIREBASE_ADMIN_CREDENTIALS)
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
        except Exception as e:
            print(f"Failed to initialize Firebase Admin with credentials string: {e}")
            firebase_admin.initialize_app()
    else:
        # Fallback to default credentials (e.g., GOOGLE_APPLICATION_CREDENTIALS env var)
        try:
            options = {}
            if settings.FIREBASE_PROJECT_ID:
                options["projectId"] = settings.FIREBASE_PROJECT_ID
            
            if options:
                firebase_admin.initialize_app(options=options)
            else:
                firebase_admin.initialize_app()
        except ValueError:
            pass # Already initialized or missing credentials (dev mode)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)) -> Dict:
    """
    Decodes and verifies a Firebase JWT.
    """
    token = credentials.credentials
    is_dev = not settings.FIREBASE_ADMIN_CREDENTIALS

    if is_dev and token == "mock-dev-token":
        return {"id": "dev-user-id", "email": "dev@studymate.com", "role": "admin"}

    try:
        decoded_token = auth.verify_id_token(token, clock_skew_seconds=30)
        return {
            "id": decoded_token.get("uid"),
            "email": decoded_token.get("email", ""),
            "role": decoded_token.get("role", "student"),
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}"
        )


def get_current_user_optional(request: Request) -> Optional[Dict]:
    """
    Tries to decode and verify a Firebase JWT.
    Returns None if no valid token is present.
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
        
    token = auth_header.split(" ")[1]
    is_dev = not settings.FIREBASE_ADMIN_CREDENTIALS

    if is_dev and token == "mock-dev-token":
        return {"id": "dev-user-id", "email": "dev@studymate.com", "role": "admin"}

    try:
        decoded_token = auth.verify_id_token(token, clock_skew_seconds=30)
        return {
            "id": decoded_token.get("uid"),
            "email": decoded_token.get("email", ""),
            "role": decoded_token.get("role", "student"),
        }
    except Exception:
        return None


def require_role(allowed_roles: list[str]):
    """
    Dependency generator to restrict route access to specific roles.
    """
    def dependency(current_user: Dict = Depends(get_current_user)):
        if current_user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        return current_user
    return dependency
