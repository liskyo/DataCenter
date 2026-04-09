"""Authentication routes: login and token management."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from core.auth_middleware import USERS_DB, create_token

router = APIRouter(prefix="/api/auth")


@router.post("/login")
def login(payload: dict):
    """Authenticate user and return a JWT token.
    
    Request body: {"username": "admin", "password": "admin123"}
    Response: {"token": "eyJ...", "role": "admin", "name": "系統管理員"}
    """
    username = payload.get("username", "")
    password = payload.get("password", "")

    user = USERS_DB.get(username)
    if not user or user["password"] != password:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_token(username, user["role"])
    return {
        "token": token,
        "role": user["role"],
        "name": user["name"],
        "username": username,
    }


@router.get("/me")
def get_me():
    """Get current user info (placeholder - will be protected in future)."""
    return {"message": "Use Bearer token to authenticate"}
