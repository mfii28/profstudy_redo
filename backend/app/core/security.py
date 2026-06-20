from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.core.config import settings
from typing import Dict, Optional

security_scheme = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security_scheme)) -> Dict:
    """
    Decodes and verifies a JWT sent by the NextAuth frontend.
    Extracts the user ID and role, and checks standard claims.
    """
    token = credentials.credentials
    
    if not settings.JWT_SECRET_KEY:
        # Bypassed in dev if secret key is not set, returning a mock developer user
        return {"id": "dev-user-id", "email": "dev@studymate.com", "role": "admin"}
        
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        # NextAuth places user ID in 'sub'
        user_id: Optional[str] = payload.get("sub")
        email: Optional[str] = payload.get("email")
        role: Optional[str] = payload.get("role", "student")
        
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject claim"
            )
            
        return {
            "id": user_id,
            "email": email,
            "role": role
        }
        
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {str(e)}"
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
