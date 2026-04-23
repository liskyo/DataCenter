from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from core.auth_middleware import get_current_user, require_role
from core.container import AppContainer

router = APIRouter(prefix="/api/system")
ops_router = APIRouter()


def _container(request: Request) -> AppContainer:
    return request.app.state.container


@router.get("/mode")
def get_system_mode(request: Request, _: dict = Depends(get_current_user)):
    container = _container(request)
    return {"mode": container.system_mode}


@router.post("/mode")
def toggle_system_mode(
    payload: dict,
    request: Request,
    _: dict = Depends(require_role("admin", "operator")),
):
    container = _container(request)
    mode = payload.get("mode")
    if mode in ["simulation", "real"]:
        if mode != container.system_mode:
            container.telemetry.clear_latest()
        container.system_mode = mode
    return {"status": "success", "mode": container.system_mode}


@router.post("/simulate_targets")
def set_simulate_targets(
    payload: dict,
    request: Request,
    _: dict = Depends(get_current_user),
):
    container = _container(request)
    targets = payload.get("targets", [])
    if isinstance(targets, list) and targets:
        merged_targets = list(container.kafka.simulation_targets)
        seen = set(merged_targets)
        for t in targets:
            if not isinstance(t, str):
                continue
            n = container.normalize_node_id(t)
            if not n:
                continue
            container.bind_asset(n, n)
            if n not in seen:
                seen.add(n)
                merged_targets.append(n)
        container.kafka.simulation_targets = merged_targets
    return {"status": "success", "targets_count": len(container.kafka.simulation_targets)}


@router.get("/id_bindings")
def list_id_bindings(request: Request, _: dict = Depends(get_current_user)):
    container = _container(request)
    rows = [{"asset_id": a, "display_name": d} for a, d in container.asset_to_display.items()]
    rows.sort(key=lambda x: x["display_name"])
    return {"data": rows}


@router.post("/id_bindings/bind")
def bind_id(
    payload: dict,
    request: Request,
    _: dict = Depends(require_role("admin", "operator")),
):
    container = _container(request)
    asset_id = payload.get("asset_id")
    display_name = payload.get("display_name")
    if not isinstance(asset_id, str) or not isinstance(display_name, str):
        return {"status": "error", "message": "asset_id and display_name are required"}
    try:
        mapped = container.bind_asset(asset_id, display_name)
    except ValueError as exc:
        return {"status": "error", "message": str(exc)}
    return {"status": "success", "data": mapped}


@router.post("/id_bindings/bulk_bind")
def bulk_bind_id(
    payload: dict,
    request: Request,
    _: dict = Depends(get_current_user),
):
    container = _container(request)
    items = payload.get("items", [])
    if not isinstance(items, list):
        return {"status": "error", "message": "items must be a list"}

    bound = []
    for item in items:
        if not isinstance(item, dict):
            continue
        asset_id = item.get("asset_id")
        display_name = item.get("display_name")
        if not isinstance(asset_id, str) or not isinstance(display_name, str):
            continue
        try:
            bound.append(container.bind_asset(asset_id, display_name))
        except ValueError:
            continue
    return {"status": "success", "bound_count": len(bound), "data": bound}


@ops_router.get("/health")
def health_check(request: Request):
    container = _container(request)
    mongo_state = "up" if container.alert_storage.is_ready else "down"
    user_store_state = "up" if container.user_storage.is_ready else "down"
    producer_state = "up" if container.kafka.producer is not None else "down"
    consumer_state = "up" if container.kafka.consumer_ready else "down"

    overall = (
        "healthy"
        if mongo_state == "up" and user_store_state == "up" and producer_state == "up" and consumer_state == "up"
        else "degraded"
    )

    return {
        "status": overall,
        "dependencies": {
            "mongo": mongo_state,
            "user_store": user_store_state,
            "kafka_producer": producer_state,
            "kafka_consumer": consumer_state,
            "influx": "up",
        },
    }


@ops_router.get("/debug")
def debug(request: Request):
    container = _container(request)
    return {
        "producer_ready": container.kafka.producer is not None,
        "consumer_ready": container.kafka.consumer_ready,
        "latest_metrics_len": len(container.telemetry.latest_metrics),
        "system_mode": container.system_mode,
        "simulation_targets_count": len(container.kafka.simulation_targets),
        "simulation_targets": container.kafka.simulation_targets,
        "mongo_ready": container.alert_storage.is_ready,
        "user_store_ready": container.user_storage.is_ready,
    }
