from __future__ import annotations

import time
from dataclasses import dataclass
import threading
import re

from services.kafka_service import KafkaRuntimeService
from services.storage_service import AlertStorageService, InfluxService
from services.telemetry_service import TelemetryService
from services.notification_service import NotificationService
from services.sse_manager import SSEManager


def _temperature_tier(temp: float) -> str:
    """與前端儀表板一致：正常 ≤45°C、警告 45–55°C、嚴重 >55°C。"""
    if temp > 55:
        return "critical"
    if temp > 45:
        return "warning"
    return "normal"


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
        self.power_states: dict[str, str] = {} # { "SERVER-001": "on", "CDU-001": "off" }
        self.last_real_data_at: dict[str, float] = {} # { "SERVER-15": 1711956... }
        self._worker_threads: list[threading.Thread] = []
        self._workers_started = False
        self.asset_to_display: dict[str, str] = {}
        self.display_to_asset: dict[str, str] = {}
        # 溫度告警區間狀態（僅在狀態變更時寫入 Mongo / 通知，避免高頻洗版）
        self._temp_tier_state: dict[str, str] = {}

    def normalize_node_id(self, value: str | None) -> str:
        raw = (value or "").strip().upper().replace("_", "-")
        raw = re.sub(r"\s+", "", raw)
        m = re.match(r"^(SERVER|SW|IMM|CDU)-?(\d+)$", raw)
        if m:
            return f"{m.group(1)}-{int(m.group(2)):03d}"
        return raw

    def bind_asset(self, asset_id: str, display_name: str) -> dict:
        asset = self.normalize_node_id(asset_id)
        display = self.normalize_node_id(display_name)
        if not asset or not display:
            raise ValueError("asset_id/display_name cannot be empty")

        old_display = self.asset_to_display.get(asset)
        if old_display and old_display in self.display_to_asset:
            self.display_to_asset.pop(old_display, None)
        old_asset = self.display_to_asset.get(display)
        if old_asset and old_asset in self.asset_to_display:
            self.asset_to_display.pop(old_asset, None)

        self.asset_to_display[asset] = display
        self.display_to_asset[display] = asset
        return {"asset_id": asset, "display_name": display}

    def resolve_ids(self, payload: dict) -> tuple[str, str]:
        raw_asset = payload.get("asset_id") or payload.get("node_id") or payload.get("device_id")
        raw_display = payload.get("server_id")
        asset = self.normalize_node_id(raw_asset) if isinstance(raw_asset, str) else ""
        display = self.normalize_node_id(raw_display) if isinstance(raw_display, str) else ""

        if asset and asset in self.asset_to_display:
            return asset, self.asset_to_display[asset]
        if display and display in self.display_to_asset:
            return self.display_to_asset[display], display

        # Auto-bind fallback: if only one side exists, map both to same normalized ID.
        resolved = asset or display or "UNKNOWN"
        bound = self.bind_asset(resolved, resolved)
        return bound["asset_id"], bound["display_name"]

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
        asset_id, server_id = self.resolve_ids(data)
        data["asset_id"] = asset_id
        data["server_id"] = server_id
        is_simulated = data.get("is_simulated", False)
        now = time.time()

        # 如果收到的是「真實數據」，記錄時間戳
        if not is_simulated:
            self.last_real_data_at[server_id] = now

        # 衝突保護: 如果該伺服器最近 10 秒內有真實數據，則忽略任何針對該伺服器的模擬數據
        # 這能避免「模擬器發送 OFF」與「真實 Agent 發送真實數據」衝突導致的延遲
        if is_simulated and (now - self.last_real_data_at.get(server_id, 0) < 10):
            return

        # 注入電源狀態
        # 邏輯: 如果系統處於「真實模式」且接收到的是「模擬數據」，強制為 off
        if self.system_mode == "real" and is_simulated:
            data["power_state"] = "off"
        else:
            # 否則使用記憶體中的狀態 (預設為 on)
            data["power_state"] = self.power_states.get(server_id, "on")

        # 邏輯保護: 如果電源為 "off"，強制數據為零/環境值 (防止舊數據殘留)
        if data["power_state"] == "off":
            data["cpu_usage"] = 0.0
            data["temperature"] = 25.0  # 假設環境溫度
            if "traffic_gbps" in data: data["traffic_gbps"] = 0.0
            if "ports_active" in data: data["ports_active"] = 0
            # DLC 相關
            if "flow_rate_lpm" in data: data["flow_rate_lpm"] = 0.0
            if "pump_a_rpm" in data: data["pump_a_rpm"] = 0.0
            if "pump_b_rpm" in data: data["pump_b_rpm"] = 0.0

        # 溫度閾值：與前端一致；僅在「區間狀態變更」時 trigger_alert（進入警告/嚴重/回到正常各寫一次）
        temp = float(data.get("temperature", 0))
        cpu = float(data.get("cpu_usage", 0))

        new_temp_tier = _temperature_tier(temp)
        prev_temp_tier = self._temp_tier_state.get(server_id, "normal")
        if new_temp_tier != prev_temp_tier:
            if new_temp_tier == "critical":
                self.trigger_alert(
                    server_id,
                    "HIGH_TEMPERATURE",
                    f"溫度嚴重超標: {temp:.1f}°C（進入嚴重區 >55°C）",
                )
            elif new_temp_tier == "warning":
                self.trigger_alert(
                    server_id,
                    "HIGH_TEMPERATURE_WARNING",
                    f"溫度偏高: {temp:.1f}°C（進入警告區 45–55°C）",
                )
            else:
                self.trigger_alert(
                    server_id,
                    "TEMPERATURE_NORMAL",
                    f"溫度已回到正常: {temp:.1f}°C（≤45°C）",
                )
        self._temp_tier_state[server_id] = new_temp_tier

        if new_temp_tier == "critical":
            data["alert"] = "High Temp"
        elif new_temp_tier == "warning":
            data["alert"] = "High Temp Warning"
        else:
            data.pop("alert", None)

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
        if self._workers_started:
            return

        self._worker_threads = [
            threading.Thread(
                target=self.kafka.kafka_consumer_worker,
                args=(self.process_message,),
                daemon=True,
                name="kafka-consumer-worker",
            ),
            threading.Thread(
                target=self.kafka.simulation_worker,
                args=(lambda: self.system_mode,),
                daemon=True,
                name="kafka-simulation-worker",
            ),
        ]
        for t in self._worker_threads:
            t.start()
        self._workers_started = True

    def shutdown(self) -> None:
        self.kafka.shutdown()
        for t in self._worker_threads:
            t.join(timeout=1.5)
        self._worker_threads = []
        self._workers_started = False
        self.alert_storage.close()
        self.influx.close()
