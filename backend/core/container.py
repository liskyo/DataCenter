from __future__ import annotations

import time
from dataclasses import dataclass

from services.kafka_service import KafkaRuntimeService
from services.storage_service import AlertStorageService, InfluxService
from services.telemetry_service import TelemetryService
from services.notification_service import NotificationService
from services.sse_manager import SSEManager


@dataclass
class AppSettings:
    kafka_broker: str = "localhost:29093"
    topic: str = "telemetry"
    influx_url: str = "http://localhost:8087"
    influx_token: str = "adminpassword"
    influx_org: str = "datacenter"
    influx_bucket: str = "telemetry"
    mongo_uri: str = "mongodb://admin:adminpassword@localhost:27018/"
    line_notify_token: str = ""


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
        self.notifier = NotificationService(token=self.settings.line_notify_token)
        self.sse = SSEManager()
        self.system_mode = "simulation"

    def trigger_alert(self, server_id: str, msg_type: str, message: str) -> None:
        alert_doc = {
            "server_id": server_id,
            "type": msg_type,
            "message": message,
            "timestamp": int(time.time() * 1000),
        }
        self.alert_storage.insert_alert(alert_doc)
        self.notifier.send_alert(server_id, msg_type, message)
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

        # --- DLC / Liquid Cooling Threshold Checks ---
        inlet_temp = data.get("inlet_temp")
        outlet_temp = data.get("outlet_temp")
        flow_rate = data.get("flow_rate_lpm")
        pressure = data.get("pressure_bar")

        if inlet_temp is not None and float(inlet_temp) > 35:
            self.trigger_alert(server_id, "DLC_INLET_HIGH", f"Coolant inlet temp too high: {inlet_temp}°C (threshold: 35°C)")
            data["dlc_alert"] = "Inlet High"

        if outlet_temp is not None and float(outlet_temp) > 50:
            self.trigger_alert(server_id, "DLC_OUTLET_HIGH", f"Coolant outlet temp too high: {outlet_temp}°C (threshold: 50°C)")
            data["dlc_alert"] = "Outlet High"

        if flow_rate is not None and float(flow_rate) < 3.0:
            self.trigger_alert(server_id, "DLC_LOW_FLOW", f"Coolant flow rate critically low: {flow_rate} LPM (threshold: 3.0 LPM)")
            data["dlc_alert"] = "Low Flow"

        if pressure is not None and float(pressure) > 3.5:
            self.trigger_alert(server_id, "DLC_HIGH_PRESSURE", f"System pressure too high: {pressure} bar (threshold: 3.5 bar)")
            data["dlc_alert"] = "High Pressure"

        if data.get("leak_detected") is True:
            self.trigger_alert(server_id, "DLC_LEAK_DETECTED", "⚠️ LEAK DETECTED! Emergency-locking all control actions.")
            data["dlc_alert"] = "Leak Detected"

        reservoir = data.get("reservoir_level")
        if reservoir is not None and float(reservoir) < 20.0:
            self.trigger_alert(server_id, "DLC_LOW_RESERVOIR", f"Coolant reservoir level critically low: {reservoir}% (threshold: 20%)")
            data["dlc_alert"] = "Low Reservoir"

        self.telemetry.upsert_latest(server_id, data)
        self.influx.write_metrics(server_id=server_id, temp=temp, cpu=cpu)

        # SSE: broadcast to all connected frontends in real-time
        self.sse.broadcast(data)

    def startup(self) -> None:
        self.alert_storage.init()
        self.kafka.ensure_kafka_producer_thread()

    def shutdown(self) -> None:
        self.kafka.shutdown()
        self.alert_storage.close()
        self.influx.close()
