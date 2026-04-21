import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.container import AppContainer
from routers.system import ops_router, router as system_router
from routers.telemetry import router as telemetry_router
from routers.control import router as control_router
from routers.auth import router as auth_router
from routers.maintenance import router as maintenance_router


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


load_env_file(Path(__file__).resolve().parent.parent / ".env")

app = FastAPI(title="DataCenter Monitoring API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.container = AppContainer()
app.include_router(telemetry_router)
app.include_router(system_router)
app.include_router(ops_router)
app.include_router(control_router)
app.include_router(auth_router)
app.include_router(maintenance_router)


@app.on_event("startup")
async def startup_event():
    container: AppContainer = app.state.container
    await container.sse.connect()
    container.startup()


@app.on_event("shutdown")
async def shutdown_event():
    container: AppContainer = app.state.container
    container.shutdown()
    await container.sse.disconnect()
