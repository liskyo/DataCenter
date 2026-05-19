import threading
import time
import math
from typing import List, Dict, Any, Optional

class ThermalPredictionService:
    def __init__(self):
        # 設備時序窗口緩存：保留每台設備最近 20 次的溫度與負載軌跡
        self.history: Dict[str, List[Dict[str, Any]]] = {}
        self.lock = threading.RLock()
        
        # 預判冷卻控制狀態：當預測溫度超標時，主動冷卻開關
        self.proactive_cooling_active = True
        self.proactive_triggers: Dict[str, float] = {} # 記錄哪些 tank/CDU 被觸發了預判加速，以及加速後的泵浦轉速
        
        # 熱力學阻力物理常數設定
        self.temp_env = 25.0       # 機房基準環境溫度 (25°C)
        self.dlc_temp_env = 30.0   # 浸沒式液冷槽基底溫度 (30°C)

    def record_telemetry(self, server_id: str, payload: Dict[str, Any]) -> None:
        """接收 telemetry 並記錄到時序滑動窗口"""
        with self.lock:
            if server_id not in self.history:
                self.history[server_id] = []
            
            # 保留最近 20 筆歷史
            self.history[server_id].append({
                "timestamp": time.time(),
                "temperature": float(payload.get("temperature") or 25.0),
                "cpu_usage": float(payload.get("cpu_usage") or 0.0),
                "pump_rpm": float(payload.get("pump_a_rpm") or payload.get("fan_speed") or 3000.0)
            })
            if len(self.history[server_id]) > 20:
                self.history[server_id].pop(0)

    def predict_temperature(self, server_id: str, current_payload: Dict[str, Any], horizon_minutes: float) -> float:
        """
        利用「一階熱阻物理預測模型 (First-Order Thermal Resistance Model)」預測未來時間的溫度：
        T(t + h) = T_env + (T_curr - T_env) * e^(-alpha * h) + beta * CPU_curr * (1 - e^(-alpha * h))
        """
        with self.lock:
            # 獲取當前遙測值
            is_off = current_payload.get("power_state") == "off"
            if is_off:
                return 25.0 # 關機狀態下，未來溫度漸近於環境室溫
            
            t_curr = float(current_payload.get("temperature") or 25.0)
            cpu_curr = float(current_payload.get("cpu_usage") or 0.0)
            
            # 判斷是否為 DLC 浸沒式液冷設備
            is_dlc = "CDU" in server_id or "SW" in server_id or current_payload.get("gpu_model") is not None
            env_t = self.dlc_temp_env if is_dlc else self.temp_env
            
            # 獲取冷卻排熱率 alpha (隨泵浦轉速或風扇轉速而增加)
            pump_rpm = float(current_payload.get("pump_a_rpm") or current_payload.get("fan_speed") or 3000.0)
            # 轉速越高，alpha 越高，散熱越快
            alpha = 0.04 * (1.0 + pump_rpm / 6000.0)
            
            # 獲取產熱係數 beta (GPU AI 機櫃發熱量大)
            is_gpu = current_payload.get("gpu_model") is not None
            beta = 0.65 if is_gpu else 0.28
            
            # 熱力學物理預測公式
            exponent = math.exp(-alpha * horizon_minutes)
            predicted_temp = env_t + (t_curr - env_t) * exponent + beta * cpu_curr * (1.0 - exponent)
            
            # 如果目前該伺服器被 capped 限電了，我們給予降溫的趨勢補償
            if current_payload.get("capped") or (current_payload.get("power_kw") or 1.5) < 1.0:
                predicted_temp -= 2.0 * (1.0 - exponent)
            
            # 上限保護，物理上最高溫度通常不會超過 95°C
            return max(25.0, min(95.0, predicted_temp))

    def evaluate_proactive_cooling(self, latest_metrics: List[Dict[str, Any]]) -> None:
        """
        每秒掃描所有伺服器的 30 分鐘後預測溫度。
        若發現有任何設備預測未來將破 55°C 警戒線，自動對該機櫃或其配屬的 CDU 實施「主動預判型泵浦加速冷卻」！
        """
        if not self.proactive_cooling_active:
            return
            
        with self.lock:
            self.proactive_triggers.clear()
            for m in latest_metrics:
                sid = m.get("server_id")
                if not sid:
                    continue
                
                # 預測未來 30 分鐘後的溫度
                pred_30m = self.predict_temperature(sid, m, horizon_minutes=30.0)
                
                # 如果未來溫度將會超過 55.0°C，觸發預判冷卻
                if pred_30m > 55.0:
                    # 決定要加速的 CDU/Tank ID (例如對應的 CDU-001 或該設備本身)
                    # 為了演示目的，直接對本機櫃的風扇速度或與之相關的冷卻泵進行預判加速
                    self.proactive_triggers[sid] = 85.0 # 加速到 85% 的風扇/泵浦轉速

    def apply_proactive_cooling_to_telemetry(self, server_id: str, data: Dict[str, Any]) -> None:
        """將預判冷卻的泵浦/風扇轉速強制寫回遙測數據中，供前端實時顯現"""
        with self.lock:
            if server_id in self.proactive_triggers:
                # 預判自癒冷卻生效：強制將風扇/泵浦轉速拉升到 85%~90%
                target_speed = self.proactive_triggers[server_id]
                
                # 同步拉升風扇或泵浦轉速
                if "fan_speed" in data:
                    data["fan_speed"] = target_speed
                if "pump_a_rpm" in data:
                    # RPM 對應百分比
                    data["pump_a_rpm"] = target_speed * 60.0 # 60% = 3600 rpm, 85% = 5100 rpm
                if "pump_b_rpm" in data:
                    data["pump_b_rpm"] = target_speed * 60.0
                
                # 出回水溫度相應微降 (散熱效率提升)
                if "inlet_temp_c" in data:
                    data["inlet_temp_c"] = max(20.0, float(data["inlet_temp_c"]) - 1.5)
                if "outlet_temp_c" in data:
                    data["outlet_temp_c"] = max(30.0, float(data["outlet_temp_c"]) - 3.0)
                
                # 標註預判自癒冷卻狀態，傳遞給前端
                data["proactive_cooling_active"] = True
                data["proactive_cooling_target"] = target_speed
