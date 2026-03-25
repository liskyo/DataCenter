from __future__ import annotations

from collections import deque
from typing import Deque, Dict, List, Tuple


class TelemetryService:
    """In-memory telemetry and anomaly history cache."""

    def __init__(self, history_window: int = 5):
        self.latest_metrics: Dict[str, dict] = {}
        self.server_history: Dict[str, Deque[Tuple[float, float]]] = {}
        self.history_window = history_window

    def upsert_latest(self, server_id: str, payload: dict) -> None:
        self.latest_metrics[server_id] = payload

    def clear_latest(self) -> None:
        self.latest_metrics.clear()

    def list_latest(self) -> List[dict]:
        return list(self.latest_metrics.values())

    def get_history_payload(self) -> Dict[str, List[Tuple[float, float]]]:
        return {k: list(v) for k, v in self.server_history.items()}

    def detect_anomaly(self, server_id: str, cpu: float, temp: float) -> tuple[bool, str]:
        if server_id not in self.server_history:
            self.server_history[server_id] = deque(maxlen=self.history_window)

        history = self.server_history[server_id]
        history.append((temp, cpu))

        if len(history) < 3:
            return False, "Not enough data"

        previous = list(history)[:-1]
        avg_cpu = sum(x[1] for x in previous) / len(previous)
        if cpu > 60 and cpu > (avg_cpu * 1.5):
            return True, (
                f"CPU Anomaly Spike Detected! (Historical Avg: {avg_cpu:.1f}%, "
                f"Sudden Jump to: {cpu:.1f}%)"
            )

        return False, "Normal"

