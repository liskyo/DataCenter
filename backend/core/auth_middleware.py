"""JWT authentication and Role-Based Access Control (RBAC) middleware.

Provides:
- JWT token creation and verification
- FastAPI dependency injection for authenticated routes
- Role-based access control (admin / operator / agent)
"""
from __future__ import annotations

import os
import time
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Secret key for JWT signing (in production, use environment variable)
JWT_SECRET = os.environ.get("JWT_SECRET", "datacenter-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_SECONDS = 86400  # 24 hours

# Simple in-memory user store (replace with database in production)
USERS_DB = {
    "admin": {"password": "admin123", "role": "admin", "name": "系統管理員"},
    "operator": {"password": "operator123", "role": "operator", "name": "維運人員"},
    "agent": {"password": "agent-api-key", "role": "agent", "name": "Agent Service"},
}

# API Key for agent authentication (simpler than JWT for machine-to-machine)
AGENT_API_KEY = os.environ.get("AGENT_API_KEY", "dc-agent-key-2026")

security = HTTPBearer(auto_error=False)


def create_token(username: str, role: str) -> str:
    """Create a JWT token for the given user."""
    payload = {
        "sub": username,
        "role": role,
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_EXPIRE_SECONDS,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_token(token: str) -> dict:
    """Verify and decode a JWT token. Raises HTTPException on failure."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)] = None,
    request: Request = None,
) -> dict:
    """FastAPI dependency: extract and verify current user from Bearer token or API key."""
    # Check for API key in header (for agent auth)
    if request:
        api_key = request.headers.get("X-API-Key")
        if api_key == AGENT_API_KEY:
            return {"sub": "agent", "role": "agent"}

    # Check for Bearer token
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required. Provide a Bearer token or API key.")

    return verify_token(credentials.credentials)


def require_role(*roles: str):
    """Create a FastAPI dependency that checks if user has one of the required roles."""
    async def role_checker(user: dict = Depends(get_current_user)):
        if user.get("role") not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Insufficient permissions. Required role: {', '.join(roles)}. Your role: {user.get('role')}"
            )
        return user
    return role_checker
