from __future__ import annotations

from fastapi import APIRouter, Request

from core.container import AppContainer

router = APIRouter()


def _container(request: Request) -> AppContainer:
    return request.app.state.container


@router.post("/ingest")
async def ingest_telemetry(payload: dict, request: Request):
    container = _container(request)
    if not container.kafka.emit(payload):
        return {"status": "error", "message": "Kafka is not ready yet"}
    return {"status": "event queued"}


@router.get("/metrics")
def get_metrics(request: Request):
    container = _container(request)
    return {"data": container.telemetry.list_latest()}


@router.get("/alerts")
def get_alerts(request: Request, limit: int = 50):
    container = _container(request)
    return {"data": container.alert_storage.list_alerts(limit=limit)}


@router.get("/history")
def get_history(request: Request):
    container = _container(request)
    return {"data": container.telemetry.get_history_payload()}
