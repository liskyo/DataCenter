import threading

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from core.container import AppContainer
from routers.system import ops_router, router as system_router
from routers.telemetry import router as telemetry_router
from routers.control import router as control_router

app = FastAPI(title="DataCenter Monitoring API")

app.add_middleware(GZipMiddleware, minimum_size=1000)
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


@app.on_event("startup")
async def startup_event():
    container: AppContainer = app.state.container
    container.startup()
    threading.Thread(target=container.kafka.kafka_consumer_worker, args=(container.process_message,), daemon=True).start()
    threading.Thread(
        target=container.kafka.simulation_worker,
        args=(lambda: container.system_mode,),
        daemon=True,
    ).start()


@app.on_event("shutdown")
async def shutdown_event():
    container: AppContainer = app.state.container
    container.shutdown()
