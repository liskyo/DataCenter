"""Authentication routes: login and token management."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from core.auth_middleware import create_token, get_current_user, get_user_record, get_user_storage

router = APIRouter(prefix="/api/auth")


@router.post("/login")
def login(payload: dict, request: Request):
    """Authenticate user and return a JWT token.
    
    Request body: {"username": "admin", "password": "admin123"}
    Response: {"token": "eyJ...", "role": "admin", "name": "系統管理員"}
    """
    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))

    storage = get_user_storage(request)
    user = storage.authenticate_user(username, password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_token(user["username"], user["role"])
    return {
        "token": token,
        "role": user["role"],
        "name": user["name"],
        "username": user["username"],
        "email": user.get("email", ""),
        "line_id": user.get("line_id", ""),
        "expires_in": 86400,
    }


@router.get("/me")
def get_me(request: Request, user: dict = Depends(get_current_user)):
    """Return the currently authenticated user profile."""
    username = user.get("sub", "")
    record = get_user_record(request, username)
    return {
        "username": username,
        "role": record.get("role", user.get("role")),
        "name": record.get("name", username),
        "email": record.get("email", ""),
        "line_id": record.get("line_id", ""),
    }


@router.get("/users")
def list_users(request: Request, _: dict = Depends(get_current_user)):
    """List current accounts for assignee selection."""
    storage = get_user_storage(request)
    return {"data": storage.list_users()}
