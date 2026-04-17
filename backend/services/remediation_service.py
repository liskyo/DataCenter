from __future__ import annotations

import time
from typing import Callable


class AutoRemediationEngine:
    def __init__(self, continuous_seconds: int = 5):
        self.continuous_seconds = continuous_seconds
        self.critical_start_times: dict[str, float] = {}

    def check_and_remediate(
        self, 
        server_id: str, 
        cpu: float, 
        temp: float, 
        trigger_alert_cb: Callable[[str, str, str], None],
        set_power_cb: Callable[[str, str], None]
    ) -> None:
        """
        Check if temp > 85 and cpu > 95 continuously for N seconds.
        If yes, trigger IPMI command to turn off power.
        """
        # Triggers active remediation if overheat constraints are breached
        if cpu > 95 and temp > 85:
            now = time.time()
            if server_id not in self.critical_start_times:
                self.critical_start_times[server_id] = now
            
            elapsed = now - self.critical_start_times[server_id]
            if elapsed >= self.continuous_seconds:
                # REMEDIATE!
                trigger_alert_cb(
                    server_id,
                    "AUTO_REMEDIATION",
                    f"⚠️【防護機制啟動】偵測到 {server_id} 持續過熱超載長達 {self.continuous_seconds} 秒，已強制透過 IPMI 執行關機阻斷！"
                )
                set_power_cb(server_id, "off")
                # clear timer so it doesn't trigger repeatedly until it restarts
                del self.critical_start_times[server_id]
        else:
            # Not critical, clear timer
            if server_id in self.critical_start_times:
                del self.critical_start_times[server_id]
