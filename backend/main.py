from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
import threading
import time

from services.kafka_service import KafkaRuntimeService
from services.storage_service import AlertStorageService, InfluxService
from services.telemetry_service import TelemetryService

app = FastAPI(title="DataCenter Monitoring API")

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

KAFKA_BROKER = "localhost:29092"
TOPIC = "telemetry"
INFLUX_URL = "http://localhost:8086"
INFLUX_TOKEN = "adminpassword"
INFLUX_ORG = "datacenter"
INFLUX_BUCKET = "telemetry"
MONGO_URI = "mongodb://admin:adminpassword@localhost:27017/"

telemetry_service = TelemetryService(history_window=5)
alert_storage = AlertStorageService(mongo_uri=MONGO_URI)
influx_service = InfluxService(
    url=INFLUX_URL,
    token=INFLUX_TOKEN,
    org=INFLUX_ORG,
    bucket=INFLUX_BUCKET,
)
kafka_service = KafkaRuntimeService(broker=KAFKA_BROKER, topic=TOPIC)

system_mode = "simulation"


def trigger_alert(server_id: str, msg_type: str, message: str) -> None:
    alert_doc = {
        "server_id": server_id,
        "type": msg_type,
        "message": message,
        "timestamp": int(time.time() * 1000),
    }
    alert_storage.insert_alert(alert_doc)
    print(f"[Webhook] {msg_type} FOR {server_id}: {message}")


def process_message(data: dict) -> None:
    server_id = data.get("server_id", "unknown")
    temp = float(data.get("temperature", 0))
    cpu = float(data.get("cpu_usage", 0))

    if temp > 40:
        trigger_alert(server_id, "HIGH_TEMPERATURE", f"Temperature exceeds threshold: {temp:.1f}C")
        data["alert"] = "High Temp"

    is_anomaly, reason = telemetry_service.detect_anomaly(server_id, cpu, temp)
    if is_anomaly:
        trigger_alert(server_id, "AI_ANOMALY", reason)
        data["anomaly"] = reason

    telemetry_service.upsert_latest(server_id, data)
    influx_service.write_metrics(server_id=server_id, temp=temp, cpu=cpu)


@app.post("/ingest")
async def ingest_telemetry(payload: dict):
    if not kafka_service.emit(payload):
        return {"status": "error", "message": "Kafka is not ready yet"}
    return {"status": "event queued"}


@app.get("/metrics")
def get_metrics():
    return {"data": telemetry_service.list_latest()}


@app.get("/alerts")
def get_alerts(limit: int = 50):
    return {"data": alert_storage.list_alerts(limit=limit)}


@app.get("/history")
def get_history():
    return {"data": telemetry_service.get_history_payload()}


@app.get("/api/system/mode")
def get_system_mode():
    return {"mode": system_mode}


@app.post("/api/system/mode")
def toggle_system_mode(payload: dict):
    global system_mode
    mode = payload.get("mode")
    if mode in ["simulation", "real"]:
        if mode != system_mode:
            telemetry_service.clear_latest()
        system_mode = mode
    return {"status": "success", "mode": system_mode}


@app.on_event("startup")
async def startup_event():
    threading.Thread(target=alert_storage.init, daemon=True).start()
    kafka_service.ensure_kafka_producer_thread()
    threading.Thread(target=kafka_service.kafka_consumer_worker, args=(process_message,), daemon=True).start()
    threading.Thread(target=kafka_service.simulation_worker, args=(lambda: system_mode,), daemon=True).start()


@app.on_event("shutdown")
async def shutdown_event():
    kafka_service.shutdown()
    alert_storage.close()
    influx_service.close()


@app.get("/health")
def health_check():
    mongo_state = "up" if alert_storage.is_ready else "down"
    producer_state = "up" if kafka_service.producer is not None else "down"
    consumer_state = "up" if kafka_service.consumer_ready else "down"

    overall = "healthy" if mongo_state == "up" and producer_state == "up" and consumer_state == "up" else "degraded"

    return {
        "status": overall,
        "dependencies": {
            "mongo": mongo_state,
            "kafka_producer": producer_state,
            "kafka_consumer": consumer_state,
            "influx": "up",
        },
    }


@app.get("/debug")
def debug():
    return {
        "producer_ready": kafka_service.producer is not None,
        "consumer_ready": kafka_service.consumer_ready,
        "latest_metrics_len": len(telemetry_service.latest_metrics),
        "system_mode": system_mode,
        "mongo_ready": alert_storage.is_ready,
    }
