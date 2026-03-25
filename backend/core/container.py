from __future__ import annotations

import time
from dataclasses import dataclass

from services.kafka_service import KafkaRuntimeService
from services.storage_service import AlertStorageService, InfluxService
from services.telemetry_service import TelemetryService


@dataclass
class AppSettings:
    kafka_broker: str = "localhost:29092"
    topic: str = "telemetry"
    influx_url: str = "http://localhost:8086"
    influx_token: str = "adminpassword"
    influx_org: str = "datacenter"
    influx_bucket: str = "telemetry"
    mongo_uri: str = "mongodb://admin:adminpassword@localhost:27017/"


class AppContainer:
    def __init__(self, settings: AppSettings | None = None):
        self.settings = settings or AppSettings()
        self.telemetry = TelemetryService(history_window=5)
        self.alert_storage = AlertStorageService(mongo_uri=self.settings.mongo_uri)
        self.influx = InfluxService(
            url=self.settings.influx_url,
            token=self.settings.influx_token,
            org=self.settings.influx_org,
            bucket=self.settings.influx_bucket,
        )
        self.kafka = KafkaRuntimeService(broker=self.settings.kafka_broker, topic=self.settings.topic)
        self.system_mode = "simulation"

    def trigger_alert(self, server_id: str, msg_type: str, message: str) -> None:
        alert_doc = {
            "server_id": server_id,
            "type": msg_type,
            "message": message,
            "timestamp": int(time.time() * 1000),
        }
        self.alert_storage.insert_alert(alert_doc)
        print(f"[Webhook] {msg_type} FOR {server_id}: {message}")

    def process_message(self, data: dict) -> None:
        server_id = data.get("server_id", "unknown")
        temp = float(data.get("temperature", 0))
        cpu = float(data.get("cpu_usage", 0))

        if temp > 40:
            self.trigger_alert(server_id, "HIGH_TEMPERATURE", f"Temperature exceeds threshold: {temp:.1f}C")
            data["alert"] = "High Temp"

        is_anomaly, reason = self.telemetry.detect_anomaly(server_id, cpu, temp)
        if is_anomaly:
            self.trigger_alert(server_id, "AI_ANOMALY", reason)
            data["anomaly"] = reason

        self.telemetry.upsert_latest(server_id, data)
        self.influx.write_metrics(server_id=server_id, temp=temp, cpu=cpu)

    def startup(self) -> None:
        self.alert_storage.init()
        self.kafka.ensure_kafka_producer_thread()

    def shutdown(self) -> None:
        self.kafka.shutdown()
        self.alert_storage.close()
        self.influx.close()
