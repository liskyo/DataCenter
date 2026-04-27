"""Authentication routes: login, token management, and user CRUD."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from core.auth_middleware import create_token, get_current_user, get_user_record, get_user_storage, require_role

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


@router.post("/users")
def create_user(payload: dict, request: Request, _: dict = Depends(require_role("admin"))):
    """Create a new user account. Admin only."""
    storage = get_user_storage(request)

    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", "")).strip()
    if not username or not password:
        raise HTTPException(status_code=400, detail="Username and password are required")

    existing = storage.get_user_by_username(username)
    if existing:
        raise HTTPException(status_code=409, detail=f"User '{username}' already exists")

    storage.upsert_user(
        username=username,
        password=password,
        role=str(payload.get("role", "operator")).strip(),
        name=str(payload.get("name", username)).strip(),
        email=str(payload.get("email", "")).strip(),
        line_id=str(payload.get("line_id", "")).strip(),
        department=str(payload.get("department", "")).strip(),
        title=str(payload.get("title", "")).strip(),
        group=payload.get("group", []),
        responsible_equipment=payload.get("responsible_equipment", []),
    )

    return {"status": "created", "username": username}


@router.put("/users/{username}")
def update_user(username: str, payload: dict, request: Request, _: dict = Depends(require_role("admin"))):
    """Update an existing user. Admin only."""
    storage = get_user_storage(request)

    existing = storage.get_user_by_username(username)
    if not existing:
        raise HTTPException(status_code=404, detail=f"User '{username}' not found")

    update_fields: dict = {}
    for field in ("name", "email", "line_id", "role", "department", "title"):
        if field in payload:
            update_fields[field] = str(payload[field]).strip()
    for field in ("group", "responsible_equipment"):
        if field in payload:
            update_fields[field] = payload[field] if isinstance(payload[field], list) else []

    if "password" in payload and payload["password"]:
        update_fields["_new_password"] = str(payload["password"]).strip()

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    storage.update_user(username, update_fields)
    return {"status": "updated", "username": username}


@router.delete("/users/{username}")
def delete_user(username: str, request: Request, current_user: dict = Depends(require_role("admin"))):
    """Disable a user account. Admin only. Cannot delete self."""
    if current_user.get("sub") == username:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    storage = get_user_storage(request)
    existing = storage.get_user_by_username(username)
    if not existing:
        raise HTTPException(status_code=404, detail=f"User '{username}' not found")

    storage.disable_user(username)
    return {"status": "disabled", "username": username}
