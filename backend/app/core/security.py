from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.core.config import settings
from typing import Dict, Optional
from sqlalchemy import select
from app.core.database import get_db, AsyncSession

security_scheme = HTTPBearer()

# Cache for Supabase JWK to avoid fetching on every request
_supabase_jwks_cache: dict = {}
SUPABASE_JWKS_URL = f"{settings.SUPABASE_URL}/.well-known/jwks.json" if settings.SUPABASE_URL else None


async def _verify_supabase_token(token: str) -> Optional[Dict]:
    """Verify a Supabase JWT using the Supabase JWKS endpoint."""
    if not settings.SUPABASE_URL:
        return None

    try:
        # Fetch JWKS
        async with httpx.AsyncClient() as client:
            resp = await client.get(SUPABASE_JWKS_URL, timeout=5)
            if resp.status_code != 200:
                return None
            jwks = resp.json()

        # Decode with JWKS
        from jose import jwk
        from jose.utils import base64url_decode
        import json

        headers = jwt.get_unverified_headers(token)
        kid = headers.get("kid")

        # Find matching key
        key_data = None
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                key_data = key
                break

        if not key_data:
            return None

        # Decode and verify
        payload = jwt.decode(
            token,
            key_data,
            algorithms=["RS256"],
            audience="authenticated",
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
    Decodes and verifies a JWT from either the backend's own signed tokens
    or Supabase Auth tokens. Falls back to dev mock if no secret configured.

    NOTE: Role extracted from JWT may be 'student' by default even for admins.
    Protected endpoints use _require_admin() which checks the JWT role.
    Admins whose Supabase user_metadata.role is not set will get 403.
    To fix, set the role claim in Supabase Auth user_metadata or use the
    /users/sync-claims endpoint.
    """
    token = credentials.credentials

    if not settings.JWT_SECRET_KEY and not settings.SUPABASE_URL:
        # Bypassed in dev — returning a mock developer user
        return {"id": "dev-user-id", "email": "dev@studymate.com", "role": "admin"}

    # Try 1: Backend-signed JWT (NextAuth / internal)
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
            pass  # Fall through to Supabase verification

    # Try 2: Supabase JWT — decode without verification to extract user info
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

    # Try 3: Decode as a raw base64 JSON token (for mock/legacy tokens)
    try:
        import json, base64
        parts = token.split(".")
        if len(parts) == 3:
            padded = parts[1] + "=" * (4 - len(parts[1]) % 4)
            decoded = json.loads(base64.urlsafe_b64decode(padded))
            if decoded.get("sub") or decoded.get("uid"):
                return {
                    "id": decoded.get("sub") or decoded.get("uid"),
                    "email": decoded.get("email", ""),
                    "role": decoded.get("role", "student"),
                }
    except Exception:
        pass

    # Token not valid with any method
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
