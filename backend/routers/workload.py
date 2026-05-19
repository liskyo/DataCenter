"""API router for Job-Aware Power Management (workload scheduling + thermal control)."""

from __future__ import annotations

from fastapi import APIRouter, Request
from typing import Optional

router = APIRouter(prefix="/api/workload", tags=["workload"])


def _get_simulator(request: Request):
    """Retrieve the WorkloadSimulator from the app container."""
    container = request.app.state.container
    return container.workload


@router.get("/jobs")
async def get_jobs(request: Request):
    """Return the current job queue (pending, running, completed)."""
    sim = _get_simulator(request)
    return {"status": "ok", "jobs": sim.get_jobs()}


@router.get("/timeline")
async def get_timeline(request: Request):
    """Return time-series data for the dual-axis chart."""
    sim = _get_simulator(request)
    return {"status": "ok", "timeline": sim.get_timeline()}


@router.post("/dispatch")
async def dispatch_job(request: Request, template_index: Optional[int] = None):
    """Manually dispatch a new AI workload job for demo purposes."""
    try:
        body = await request.json()
        template_index = body.get("template_index", template_index)
    except Exception:
        pass

    sim = _get_simulator(request)
    job = sim.dispatch_job(template_index)
    return {"status": "ok", "job": job}


@router.get("/templates")
async def get_templates(request: Request):
    """Return available workload templates for the dispatch UI."""
    from services.workload_service import WORKLOAD_TEMPLATES
    templates = []
    for i, t in enumerate(WORKLOAD_TEMPLATES):
        templates.append({
            "index": i,
            "name": t["name"],
            "category": t["category"],
            "gpu_model": t["gpu_model"],
            "gpu_count": t["gpu_count"],
            "pflops": t["pflops"],
            "estimated_heat_kw": round(
                (t["gpu_count"] * t["tdp"] * t["mfu"]) / 1000.0, 2
            ),
        })
    return {"status": "ok", "templates": templates}
