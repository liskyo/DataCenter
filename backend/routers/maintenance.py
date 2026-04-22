from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from core.auth_middleware import get_current_user, get_user_record
from core.container import AppContainer

router = APIRouter(prefix="/api/maintenance")


def _container(request: Request) -> AppContainer:
    return request.app.state.container


def _parse_schedule_payload(payload: dict, request: Request) -> tuple[str, str, str, int, str, bool, str, dict, str]:
    target = str(payload.get("target", "")).strip()
    task_type = str(payload.get("task_type", "")).strip()
    scheduled_at = str(payload.get("scheduled_at", "")).strip()
    recurrence_days_raw = payload.get("recurrence_days", 0)
    assignee_username = str(payload.get("assignee_username", "")).strip()
    notify_email = bool(payload.get("notify_email", False))
    notes = str(payload.get("notes", "")).strip()

    if not target:
        raise HTTPException(status_code=400, detail="Maintenance target is required")
    if not task_type:
        raise HTTPException(status_code=400, detail="Maintenance task is required")
    if not scheduled_at:
        raise HTTPException(status_code=400, detail="Schedule time is required")
    try:
        recurrence_days = int(recurrence_days_raw)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid recurrence value")
    if recurrence_days < 0:
        raise HTTPException(status_code=400, detail="Recurrence days must be non-negative")
    if not assignee_username:
        raise HTTPException(status_code=400, detail="Assignee is required")

    assignee = get_user_record(request, assignee_username)
    assignee_email = str(assignee.get("email", "")).strip()
    if notify_email and not assignee_email:
        raise HTTPException(status_code=400, detail="Selected assignee has no email configured")

    return (
        target,
        task_type,
        scheduled_at,
        recurrence_days,
        assignee_username,
        notify_email,
        notes,
        assignee,
        assignee_email,
    )


@router.get("/schedules")
def list_schedules(request: Request, _: dict = Depends(get_current_user)):
    container = _container(request)
    return {"data": container.maintenance_service.list_schedules()}


@router.post("/schedules")
def create_schedule(payload: dict, request: Request, _: dict = Depends(get_current_user)):
    container = _container(request)
    target, task_type, scheduled_at, recurrence_days, assignee_username, notify_email, notes, assignee, assignee_email = (
        _parse_schedule_payload(payload, request)
    )

    try:
        doc = container.maintenance_service.create_schedule(
            target=target,
            task_type=task_type,
            scheduled_at=scheduled_at,
            recurrence_days=recurrence_days,
            assignee_username=assignee_username,
            assignee_name=str(assignee.get("name", assignee_username)),
            assignee_role=str(assignee.get("role", "")),
            assignee_email=assignee_email,
            notify_email=notify_email,
            notes=notes,
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid schedule time format")
    return {"data": doc}


@router.put("/schedules/{schedule_id}")
def update_schedule(schedule_id: str, payload: dict, request: Request, _: dict = Depends(get_current_user)):
    container = _container(request)
    target, task_type, scheduled_at, recurrence_days, assignee_username, notify_email, notes, assignee, assignee_email = (
        _parse_schedule_payload(payload, request)
    )

    try:
        doc = container.maintenance_service.update_schedule(
            schedule_id,
            target=target,
            task_type=task_type,
            scheduled_at=scheduled_at,
            recurrence_days=recurrence_days,
            assignee_username=assignee_username,
            assignee_name=str(assignee.get("name", assignee_username)),
            assignee_role=str(assignee.get("role", "")),
            assignee_email=assignee_email,
            notify_email=notify_email,
            notes=notes,
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid schedule time format")

    if doc is None:
        raise HTTPException(status_code=404, detail="Schedule not found")

    return {"data": doc}


@router.delete("/schedules/{schedule_id}")
def delete_schedule(schedule_id: str, request: Request, _: dict = Depends(get_current_user)):
    container = _container(request)
    deleted = container.maintenance_service.delete_schedule(schedule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"status": "success", "id": schedule_id}


@router.post("/test-email")
def send_test_email(payload: dict, request: Request, user: dict = Depends(get_current_user)):
    container = _container(request)
    if not container.maintenance_service.is_email_configured:
        raise HTTPException(status_code=503, detail="SMTP is not configured")

    target_email = str(payload.get("email", "")).strip()
    target_username = str(payload.get("username", "")).strip()

    if target_username:
        target_user = get_user_record(request, target_username)
    else:
        target_user = get_user_record(request, str(user.get("sub", "")).strip())

    if not target_email:
        target_email = str(target_user.get("email", "")).strip()

    if not target_email:
        raise HTTPException(status_code=400, detail="Target email is required")

    ok, error, data = container.maintenance_service.send_test_email(
        triggered_by=str(user.get("sub", "")),
        target_user=target_user,
        target_email=target_email,
    )

    if not ok:
        status_code = 400 if error == "Target email is required" else 500
        raise HTTPException(status_code=status_code, detail=error or "Failed to send test email")

    return data
