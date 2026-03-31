from __future__ import annotations

from fastapi import APIRouter, Request

from core.container import AppContainer

router = APIRouter(prefix="/api/system")
ops_router = APIRouter()


def _container(request: Request) -> AppContainer:
    return request.app.state.container


@router.get("/mode")
def get_system_mode(request: Request):
    container = _container(request)
    return {"mode": container.system_mode}


@router.post("/mode")
def toggle_system_mode(payload: dict, request: Request):
    container = _container(request)
    mode = payload.get("mode")
    if mode in ["simulation", "real"]:
        if mode != container.system_mode:
            container.telemetry.clear_latest()
        container.system_mode = mode
    return {"status": "success", "mode": container.system_mode}


@router.post("/simulate_targets")
def set_simulate_targets(payload: dict, request: Request):
    container = _container(request)
    targets = payload.get("targets", [])
    if isinstance(targets, list) and targets:
        container.kafka.simulation_targets = targets
    return {"status": "success", "targets_count": len(container.kafka.simulation_targets)}


@ops_router.get("/health")
def health_check(request: Request):
    container = _container(request)
    mongo_state = "up" if container.alert_storage.is_ready else "down"
    producer_state = "up" if container.kafka.producer is not None else "down"
    consumer_state = "up" if container.kafka.consumer_ready else "down"

    overall = (
        "healthy" if mongo_state == "up" and producer_state == "up" and consumer_state == "up" else "degraded"
    )

    return {
        "status": overall,
        "dependencies": {
            "mongo": mongo_state,
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
        "mongo_ready": container.alert_storage.is_ready,
    }
