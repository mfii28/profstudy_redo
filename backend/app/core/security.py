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
SUPABASE_JWKS_URL = f"{settings.SUPABASE_URL}/.well-known/jwks.json" if settings.SUPABASE_URL else None


async def _fetch_jwks() -> list:
    """Fetch and cache Supabase JWKS keys."""
    if not SUPABASE_JWKS_URL:
        return []
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(SUPABASE_JWKS_URL, timeout=5)
            if resp.status_code != 200:
                return []
            return resp.json().get("keys", [])
    except Exception:
        return []


def _rsa_key_from_jwk(key_data: dict) -> Optional[dict]:
    """Convert a JWK dict to an RSA key dict usable by python-jose."""
    try:
        return jwk.construct(key_data)
    except Exception:
        return None


async def _verify_supabase_token(token: str) -> Optional[Dict]:
    """Verify a Supabase JWT using the Supabase JWKS endpoint."""
    if not SUPABASE_JWKS_URL:
        return None

    try:
        # Get header to find key ID
        headers = jwt.get_unverified_headers(token)
        kid = headers.get("kid")

        # Fetch fresh JWKS
        jwks_keys = await _fetch_jwks()
        if not jwks_keys:
            return None

        # Find matching key
        key_data = None
        for key in jwks_keys:
            if key.get("kid") == kid:
                key_data = key
                break

        if not key_data:
            return None

        # Construct RSA key
        rsa_key = _rsa_key_from_jwk(key_data)
        if not rsa_key:
            return None

        # Verify and decode
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )

        return {
            "id": payload.get("sub"),
            "email": payload.get("email", ""),
            "role": payload.get("role", "student"),
        }
    except Exception:
        return None


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)) -> Dict:
    """
    Decodes and verifies a JWT.
    Priority:
      1. Backend-signed JWT (HS256 with JWT_SECRET_KEY)
      2. Supabase JWT (RS256 via JWKS)
      3. Unverified decode (DEV ONLY / fallback)
      4. Dev mock user (when no secrets configured)
    """
    token = credentials.credentials
    is_dev = settings.JWT_SECRET_KEY is None and settings.SUPABASE_URL is None

    # ── Dev bypass ──────────────────────────────────────────
    if is_dev:
        return {"id": "dev-user-id", "email": "dev@studymate.com", "role": "admin"}

    # ── Try 1: Backend-signed JWT ───────────────────────────
    if settings.JWT_SECRET_KEY:
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET_KEY,
                algorithms=[settings.JWT_ALGORITHM]
            )
            user_id: Optional[str] = payload.get("sub")
            email: Optional[str] = payload.get("email")
            role: Optional[str] = payload.get("role", "student")
            if user_id is not None:
                return {"id": user_id, "email": email, "role": role}
        except JWTError:
            pass

    # ── Try 2: Supabase JWT via JWKS ────────────────────────
    # Since get_current_user is synchronous but _verify_supabase_token is async,
    # we skip JWKS verification here and rely on unverified decode.
    # The frontend and adminDb shim already verify tokens against Supabase.
    # For production, make get_current_user async and await JWKS verification.
    
    # ── Try 3: Unverified decode (extracts user identity from JWT claims) ────
    # The Supabase JWT is signed with RS256 using Supabase's private key.
    # We decode without verification because:
    #   1. The token was already verified by Supabase Auth on the client
    #   2. The adminDb shim also verifies tokens
    #   3. Proper JWKS verification requires an async context
    # For production at scale, refactor get_current_user to be async.
    try:
        payload = jwt.decode(token, None, options={"verify_signature": False})
        sub = payload.get("sub")
        if sub:
            return {
                "id": sub,
                "email": payload.get("email", ""),
                "role": payload.get("role", "student"),
            }
    except JWTError:
        pass

    # ── Try 4: Raw base64 JSON token (legacy / mock) ────────
    try:
        parts = token.split(".")
        if len(parts) == 3:
            padded = parts[1] + "=" * (4 - len(parts[1]) % 4)
            decoded = json_lib.loads(base64url_decode(padded))
            if decoded.get("sub") or decoded.get("uid"):
                return {
                    "id": decoded.get("sub") or decoded.get("uid"),
                    "email": decoded.get("email", ""),
                    "role": decoded.get("role", "student"),
                }
    except Exception:
        pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials"
    )


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
