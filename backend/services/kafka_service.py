from __future__ import annotations

import json
import random
import threading
import time
import re
from typing import Callable, Dict

from kafka import KafkaConsumer, KafkaProducer


class KafkaRuntimeService:
    def __init__(self, broker: str, topic: str):
        self.broker = broker
        self.topic = topic
        self.producer: KafkaProducer | None = None
        self.producer_init_lock = threading.Lock()
        self.producer_init_thread: threading.Thread | None = None
        self.consumer_ready = False
        self.stop_event = threading.Event()
        self.simulation_targets: list[str] = []

    def init_kafka_producer(self) -> None:
        with self.producer_init_lock:
            while not self.producer and not self.stop_event.is_set():
                try:
                    self.producer = KafkaProducer(
                        bootstrap_servers=[self.broker],
                        value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                        # Avoid blocking API requests for long periods when broker is unavailable.
                        request_timeout_ms=2500,
                        max_block_ms=2000,
                        retries=0,
                        acks=1,
                    )
                    print("Kafka Producer connected...")
                except Exception:
                    time.sleep(3)

    def ensure_kafka_producer_thread(self) -> None:
        if self.producer is not None:
            return
        if self.producer_init_thread is not None and self.producer_init_thread.is_alive():
            return
        self.producer_init_thread = threading.Thread(target=self.init_kafka_producer, daemon=True)
        self.producer_init_thread.start()

    def emit(self, payload: dict) -> bool:
        if not self.producer:
            return False
        try:
            # Wait briefly for broker ack; do not block ingest endpoint indefinitely.
            future = self.producer.send(self.topic, value=payload)
            future.get(timeout=1.5)
            return True
        except Exception:
            try:
                self.producer.close(timeout=1)
            except Exception:
                pass
            self.producer = None
            self.ensure_kafka_producer_thread()
            return False

    def emit_or_fallback(self, payload: dict, fallback: Callable[[dict], None] | None = None) -> bool:
        if self.emit(payload):
            return True
        if fallback is not None:
            fallback(payload)
            return True
        return False

    def kafka_consumer_worker(self, on_message: Callable[[dict], None]) -> None:
        backoff_s = 3.0
        max_backoff_s = 60.0
        fail_count = 0

        while not self.stop_event.is_set():
            consumer = None
            try:
                consumer = KafkaConsumer(
                    self.topic,
                    bootstrap_servers=[self.broker],
                    group_id="influx_writer_group_persistent",
                    auto_offset_reset="latest",
                    value_deserializer=lambda m: json.loads(m.decode("utf-8")),
                    # Keep the same member in group; do not auto-timeout and recreate.
                    enable_auto_commit=True,
                )
                self.consumer_ready = True
                backoff_s = 3.0
                fail_count = 0
                print("Kafka Consumer started and polling...")
                while not self.stop_event.is_set():
                    records = consumer.poll(timeout_ms=1000, max_records=200)
                    for msg_list in records.values():
                        for msg in msg_list:
                            try:
                                on_message(msg.value)
                            except Exception as exc:
                                print(f"Error processing message: {exc}")
            except Exception as exc:
                self.consumer_ready = False
                fail_count += 1
                if fail_count == 1 or fail_count % 10 == 0:
                    print(
                        f"Kafka Consumer unavailable ({exc}). "
                        f"Next retry in {backoff_s:.0f}s (fail #{fail_count}). "
                        f"請確認 broker 已啟動（預設 {self.broker}，見 docker-compose）。"
                    )
                if self.stop_event.wait(backoff_s):
                    break
                backoff_s = min(backoff_s * 1.5, max_backoff_s)
            finally:
                if consumer is not None:
                    try:
                        consumer.close()
                    except Exception:
                        pass

    def simulation_worker(
        self,
        system_mode_getter: Callable[[], str],
        fallback_on_message: Callable[[dict], None] | None = None,
    ) -> None:
        def normalize_name(value: str) -> str:
            return re.sub(r"\s+", "", (value or "").strip().upper().replace("_", "-"))

        def infer_kind(node_id: str) -> str:
            sid = normalize_name(node_id)
            if sid.startswith("SW-") or "SWITCH" in sid:
                return "switch"
            if sid.startswith("CDU-") or "CDU" in sid:
                return "cdu"
            if sid.startswith("IMM-") or sid.startswith("TANK") or "IMMERSION" in sid:
                return "tank"
            if sid.startswith("CRAC") or "CHILLER" in sid:
                return "cooling"
            if sid.startswith("PDU") or sid.startswith("UPS") or "POWER" in sid:
                return "power"
            return "server"

        base_metrics: Dict[str, Dict[str, float]] = {}
        active_critical = None
        active_warning = None
        loops = 0
        last_logged_targets: tuple[str, ...] = ()

        while not self.stop_event.is_set():
            mode = system_mode_getter()
            if self.producer:
                try:
                    all_ids = self.simulation_targets
                    if not all_ids:
                        servers = [f"SERVER-{str(i).zfill(3)}" for i in range(1, 19)]
                        switches = [f"SW-{str(i).zfill(3)}" for i in range(1, 4)]
                        all_ids = servers + switches

                    current_targets = tuple(all_ids)
                    if current_targets != last_logged_targets:
                        print(f"[SimulationWorker] targets={list(current_targets)}")
                        last_logged_targets = current_targets

                    for s_id in all_ids:
                        if s_id not in base_metrics:
                            base_metrics[s_id] = {"temp": random.uniform(20, 25), "cpu": random.uniform(10, 30), "traffic": random.uniform(2, 10)}

                    # 僅在模擬模式下更新模擬數值
                    if mode == "simulation":
                        if loops % 12 == 0 and len(all_ids) >= 2:
                            sampled = random.sample(all_ids, 2)
                            active_critical = sampled[0]
                            active_warning = sampled[1]
                        loops += 1

                        for s_id in all_ids:
                            base = base_metrics[s_id]
                            base["temp"] += random.uniform(-1.0, 1.0)
                            base["cpu"] += random.uniform(-4.0, 4.0)
                            base["traffic"] += random.uniform(-2.0, 2.0)

                            if s_id == active_critical:
                                base["temp"] = 90.0
                                base["cpu"] = 100.0
                                base["traffic"] = 50.0
                            elif s_id == active_warning:
                                if base["temp"] < 45: base["temp"] += 5.0
                                if base["cpu"] < 75: base["cpu"] += 10.0
                                if base["traffic"] < 30: base["traffic"] += 5.0
                            else:
                                if base["temp"] > 25: base["temp"] -= 5.0
                                if base["cpu"] > 25: base["cpu"] -= 10.0
                                if base["traffic"] > 10: base["traffic"] -= 5.0

                            base["temp"] = max(18, min(base["temp"], 90))
                            base["cpu"] = max(2, min(base["cpu"], 100))
                            base["traffic"] = max(0.1, min(base["traffic"], 50))

                    # 發送數據
                    for s_id in all_ids:
                        if mode == "simulation":
                            base = base_metrics[s_id]
                            kind = infer_kind(s_id)
                            if kind == "switch":
                                payload = {
                                    "server_id": s_id,
                                    "is_simulated": True,
                                    "traffic_gbps": round(base["traffic"], 2),
                                    "ports_active": int(48 * (base["cpu"] / 100)),
                                    "ports_total": 48,
                                    "cpu_usage": round(base["cpu"], 2),
                                    "temperature": round(base["temp"], 2),
                                    "timestamp": int(time.time() * 1000),
                                }
                            elif kind == "cdu":
                                payload = {
                                    "server_id": s_id,
                                    "is_simulated": True,
                                    "cpu_usage": round(base["cpu"] * 0.4, 1),
                                    "temperature": round(base["temp"], 2),
                                    "inlet_temp": round(23.0 + random.uniform(-1.0, 2.0), 1),
                                    "outlet_temp": round(35.0 + random.uniform(-2.0, 5.0), 1),
                                    "flow_rate_lpm": round(8.0 + random.uniform(-0.5, 0.5), 1),
                                    "pressure_bar": round(1.5 + random.uniform(-0.1, 0.2), 2),
                                    "pump_a_rpm": 2800 + random.randint(-50, 50),
                                    "pump_b_rpm": 2800 + random.randint(-50, 50),
                                    "reservoir_level": round(85.0 + random.uniform(-2.0, 2.0), 1),
                                    "valve_position": 80,
                                    "facility_supply_temp": 7.2,
                                    "facility_return_temp": 12.5,
                                    "leak_detected": False,
                                    "timestamp": int(time.time() * 1000),
                                }
                            elif kind == "tank":
                                payload = {
                                    "server_id": s_id,
                                    "is_simulated": True,
                                    "flow_rate_lpm": round(12.0 + random.uniform(-1.0, 1.0), 1),
                                    "temperature": round(32.0 + random.uniform(-1.0, 3.0), 1),
                                    "pressure_bar": round(1.02 + random.uniform(-0.02, 0.05), 2),
                                    "coolant_level": random.randint(92, 98),
                                    "cpu_usage": round(base["cpu"] * 0.2, 1),
                                    "timestamp": int(time.time() * 1000),
                                }
                            elif kind == "cooling":
                                payload = {
                                    "server_id": s_id,
                                    "is_simulated": True,
                                    "temperature": round(20.0 + random.uniform(2.0, 8.0), 1),
                                    "cpu_usage": round(base["cpu"] * 0.15, 1),
                                    "timestamp": int(time.time() * 1000),
                                }
                            elif kind == "power":
                                payload = {
                                    "server_id": s_id,
                                    "is_simulated": True,
                                    "temperature": round(24.0 + random.uniform(0.5, 4.0), 1),
                                    "cpu_usage": round(base["cpu"] * 0.1, 1),
                                    "timestamp": int(time.time() * 1000),
                                }
                            else:
                                current_temp = base["temp"] + (random.uniform(15, 25) if random.random() < 0.005 else 0)
                                current_cpu = base["cpu"] + (random.uniform(30, 50) if random.random() < 0.005 else 0)

                                final_temp = min(current_temp, 99.9)
                                fan_speed = min(100.0, max(20.0, ((final_temp - 25) * 1.6) + 20))

                                payload = {
                                    "server_id": s_id,
                                    "is_simulated": True,
                                    "temperature": final_temp,
                                    "cpu_usage": min(current_cpu, 100.0),
                                    "fan_speed": fan_speed,
                                    "timestamp": int(time.time() * 1000),
                                }
                        else:
                            # 真實模式下，對於無真實數據的節點發送最低限度狀態
                            # 這樣 AppContainer.process_message 會注入電源狀態，並讓前端感知
                            payload = {
                                "server_id": s_id,
                                "is_simulated": True,
                                "power_state": "off", # 真實模式下若無數據，我們標記為 off (除非手動開機)
                                "timestamp": int(time.time() * 1000),
                            }

                        # Simulation data is local synthetic state; write it directly to the app cache
                        # to avoid Kafka backlog or stale targets delaying frontend updates.
                        if fallback_on_message is not None:
                            fallback_on_message(payload)
                        else:
                            self.emit_or_fallback(payload, fallback_on_message)
                except Exception:
                    try:
                        import traceback

                        with open("sim_error.log", "a", encoding="utf-8") as file:
                            file.write(f"Simulator Error: {traceback.format_exc()}\n")
                    except Exception:
                        pass
                    try:
                        self.producer.close(timeout=1)
                    except Exception:
                        pass
                    self.producer = None
                    self.ensure_kafka_producer_thread()
            if self.stop_event.wait(2):
                break

    def shutdown(self) -> None:
        self.stop_event.set()
        self.consumer_ready = False
        if self.producer is not None:
            try:
                self.producer.close(timeout=1)
            except Exception:
                pass
            self.producer = None

