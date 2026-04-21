from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from core.auth_middleware import get_current_user
from core.container import AppContainer

router = APIRouter()


def _container(request: Request) -> AppContainer:
    return request.app.state.container


@router.post("/ingest")
async def ingest_telemetry(payload: dict, request: Request):
    container = _container(request)
    if container.kafka.emit(payload):
        return {"status": "event queued"}
    container.process_message(payload)
    return {"status": "processed_local_fallback", "message": "Kafka unavailable, processed locally"}


@router.get("/stream")
async def sse_stream(request: Request, _: dict = Depends(get_current_user)):
    """Server-Sent Events endpoint for real-time telemetry push."""
    container = _container(request)
    q = container.sse.subscribe()

    async def event_stream():
        try:
            async for event in container.sse.event_generator(q):
                if await request.is_disconnected():
                    break
                yield event
        finally:
            container.sse.unsubscribe(q)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/metrics")
def get_metrics(request: Request, _: dict = Depends(get_current_user)):
    container = _container(request)
    return {"data": container.telemetry.list_latest()}


@router.get("/alerts")
def get_alerts(request: Request, limit: int = 50, _: dict = Depends(get_current_user)):
    container = _container(request)
    return {"data": container.alert_storage.list_alerts(limit=limit)}


@router.get("/history")
def get_history(request: Request, _: dict = Depends(get_current_user)):
    container = _container(request)
    return {"data": container.telemetry.get_history_payload()}

