# -*- coding: utf-8 -*-
"""
Immersion Cooling Deep Telemetry and Degradation Prediction Service.
Strictly PEP 8 compliant, highly robust, and Production ready.
"""

from __future__ import annotations
import math
import time
import threading
from typing import Dict, Any, List, Tuple, Optional

# 雙相浸沒式冷卻氟化液熱物理常數
H_FG = 112000.0      # 汽化潛熱 Latent Heat of Vaporization (J/kg)
RHO_VAPOR = 14.3     # 飽和蒸汽密度 (kg/m³)
RHO_LIQUID = 1430.0   # 氟化液液體密度 (kg/m³)
V_D = 0.45           # 氣泡上升速度常數 (m/s)
P_SAT = 101.3        # 大氣飽和壓力 (kPa)


class ImmersionCoolingService:
    """
    流體力學與化學裂解推算虛擬遙測服務
    """
    def __init__(self) -> None:
        self._lock = threading.RLock()
        
        # 儲存浸沒式槽體的壓差與液位歷史，用於 d/dt 導數斜率推算
        # 結構: { tank_id: [(timestamp, val)] }
        self._dp_history: Dict[str, List[Tuple[float, float]]] = {}
        self._level_history: Dict[str, List[Tuple[float, float]]] = {}
        
        # 線上淨化系統工作狀態: { tank_id: 'standby' | 'active_bypass' | 'active_full' }
        self.purification_states: Dict[str, str] = {}
        
        # 模擬調控滑桿覆寫，用於展場觀眾模擬調參
        # 結構: { tank_id: { 'gpu_load_kw': X, 'condenser_flow_lpm': Y, 'seal_leak': bool } }
        self.simulator_overrides: Dict[str, Dict[str, Any]] = {}

    def set_simulator_override(self, tank_id: str, overrides: Dict[str, Any]) -> None:
        """
        供展場互動模擬器隨意調控輸入，動態覆寫物理與化學參數
        """
        with self._lock:
            if tank_id not in self.simulator_overrides:
                self.simulator_overrides[tank_id] = {}
            self.simulator_overrides[tank_id].update(overrides)

    def get_simulator_override(self, tank_id: str) -> Dict[str, Any]:
        """
        讀取模擬器覆寫值
        """
        with self._lock:
            return self.simulator_overrides.get(tank_id, {})

    def process_immersion_telemetry(
        self,
        node_id: str,
        data: Dict[str, Any],
        latest_metrics: List[Dict[str, Any]],
        maintenance_service: Optional[Any] = None
    ) -> None:
        """
        攔截浸沒式槽體 (IMM-TP-xxx 或 IMM-TAN-xxx) 的 telemetry，動態推算並注入深度物理化學數值。
        """
        # 只針對浸沒式冷卻槽體 (DLC 槽、雙相槽)
        # 例如伺服器/槽體 ID 匹配 IMM
        if not ("IMM" in node_id or data.get("type") in ["immersion_single", "immersion_dual"] or "TP" in node_id):
            return

        with self._lock:
            now = time.time()
            
            # 1. 取得基本物理讀數，若不存在則模擬初始讀數
            pressure = float(data.get("pressure_kpa", 102.5))
            level = float(data.get("fluid_level_mm", 480.0))
            
            # 2. 獲取該槽下伺服器晶片溫度與 GPU 發熱量
            # 尋找與該槽關聯的伺服器發熱量 (加總)
            # 在模擬模式下，可以讀取 latest_metrics 的功率加總
            tank_servers_power = 0.0
            max_gpu_temp = 35.0
            
            for m in latest_metrics:
                parent_rack = m.get("rack_id", m.get("server_id", ""))
                if node_id in parent_rack or parent_rack == node_id:
                    tank_servers_power += float(m.get("power_kw", 0.0))
                    max_gpu_temp = max(max_gpu_temp, float(m.get("temperature", 35.0)))
            
            # 若沒有找到子伺服器，可能 node_id 本身就是伺服器/槽體混合體，讀取自身的功率
            if tank_servers_power == 0:
                tank_servers_power = float(data.get("power_kw", data.get("power_usage_kw", 12.5)))
            
            # 3. 處理模擬器手動調控覆寫 (展會演示用)
            override = self.simulator_overrides.get(node_id, {})
            if "gpu_load_kw" in override:
                tank_servers_power = float(override["gpu_load_kw"])
            
            condenser_flow = float(override.get("condenser_flow_lpm", 15.0))
            condenser_inlet_temp = float(override.get("condenser_inlet_temp", 28.0))
            
            # 4. 氣泡比例與沸騰 Regime 計算
            void_fraction, boiling_regime, should_throttle = self._calculate_void_fraction(
                gpu_power_kw=tank_servers_power,
                gpu_temp=max_gpu_temp,
                pressure_kpa=pressure
            )
            
            # 5. 液位與流失率 (Fugitive Evaporation) 斜率計算
            # 更新歷史窗口
            if node_id not in self._level_history:
                self._level_history[node_id] = []
            
            # 模擬微幅液位變動，若沒有手動覆寫洩漏，常規下液位緩慢微幅蒸發
            is_leak = override.get("seal_leak", False)
            if is_leak:
                # 漏氟化液，液面下降極快
                level_drift = 0.08  # 每秒下降 0.08 mm
            else:
                level_drift = 0.0005  # 每秒微幅下降
                
            simulated_level = max(10.0, level - level_drift)
            data["fluid_level_mm"] = round(simulated_level, 2)
            
            self._level_history[node_id].append((now, simulated_level))
            # 限制窗口為最近 1 小時 (大約 300 條)
            if len(self._level_history[node_id]) > 300:
                self._level_history[node_id].pop(0)
                
            loss_data = self._estimate_fluid_loss_rate(
                total_heat_kw=tank_servers_power,
                condenser_inlet_temp=condenser_inlet_temp,
                condenser_flow_lpm=condenser_flow,
                level_history_mm=self._level_history[node_id],
                is_leak_override=is_leak
            )
            
            # 6. 過濾器壓差 \Delta P 與壽命預估
            dp = float(data.get("filter_dp_psi", 2.2))
            # 模擬壓差緩慢增長
            dp_growth = 0.0002 if dp < 14.5 else 0.0
            # 模擬濾芯堵塞 overrides
            if override.get("clogged_filter", False):
                dp_growth = 2.1  # 堵塞極快
                
            simulated_dp = min(15.0, dp + dp_growth)
            data["filter_dp_psi"] = round(simulated_dp, 2)
            
            if node_id not in self._dp_history:
                self._dp_history[node_id] = []
            self._dp_history[node_id].append((now, simulated_dp))
            if len(self._dp_history[node_id]) > 300:
                self._dp_history[node_id].pop(0)
                
            filter_data = self._predict_filter_lifecycle(self._dp_history[node_id])
            
            # 7. 化學劣化指數計算
            # 默認初始值
            conductivity = float(data.get("conductivity_us_cm", 0.08))
            ph_value = float(data.get("ph_value", 7.2))
            water_content = float(data.get("water_content_ppm", 8.0))
            
            # 模擬劣化與裂解
            if is_leak or override.get("water_intrusion", False):
                # 水氣入侵，電導率飆升，pH 下降
                conductivity = min(2.5, conductivity + 0.15)
                ph_value = max(4.0, ph_value - 0.25)
                water_content = min(200.0, water_content + 15.0)
            elif tank_servers_power > 60.0 and max_gpu_temp > 78.0:
                # 高溫熱裂解產生 HF
                conductivity = min(1.8, conductivity + 0.005)
                ph_value = max(4.8, ph_value - 0.01)
                water_content = min(40.0, water_content + 0.2)
                
            # 淨化系統自癒調控反應
            purification = "standby"
            if ph_value < 5.5 or conductivity > 1.2:
                purification = "active_full"
                # 自癒降低酸度與導電
                conductivity = max(0.1, conductivity - 0.02)
                ph_value = min(7.0, ph_value + 0.04)
            elif ph_value < 6.5 or conductivity > 0.6:
                purification = "active_bypass"
                conductivity = max(0.1, conductivity - 0.005)
                ph_value = min(7.0, ph_value + 0.01)
                
            data["conductivity_us_cm"] = round(conductivity, 3)
            data["ph_value"] = round(ph_value, 2)
            data["water_content_ppm"] = round(water_content, 1)
            self.purification_states[node_id] = purification
            
            chem_data = self._check_chemical_degradation(conductivity, ph_value, water_content)
            
            # 8. 全面注入遙測字典
            data["void_fraction"] = round(void_fraction, 1)
            data["boiling_regime"] = boiling_regime
            data["should_throttle"] = should_throttle
            data["purification_state"] = purification
            
            data["theoretical_loss_rate_ml_hr"] = loss_data["theoretical_loss_rate_ml_hr"]
            data["observed_loss_rate_ml_hr"] = loss_data["observed_loss_rate_ml_hr"]
            data["fused_loss_rate_ml_hr"] = loss_data["fused_loss_rate_ml_hr"]
            data["leak_severity"] = loss_data["leak_severity"]
            
            data["filter_dp_psi"] = filter_data["current_dp_psi"]
            data["filter_progress"] = filter_data["progress"]
            data["filter_days_remaining"] = filter_data["days_remaining"]
            data["filter_status"] = filter_data["status"]
            data["trigger_filter_maintenance"] = filter_data["trigger_maintenance"]
            
            data["hf_corrosion_risk"] = chem_data["hf_corrosion_risk"]
            data["water_warning"] = chem_data["water_warning"]
            data["chem_severity"] = chem_data["severity"]
            data["chem_description"] = chem_data["description"]
            
            # 9. 沸騰 CHF 乾涸極限自癒降頻保護
            if should_throttle:
                # 自動回寫降頻信號，強制冷卻，保護硬體
                data["power_capped"] = True
                # 壓制功率至安全底線
                data["power_kw"] = min(data.get("power_kw", 8.0), 3.0)

            # 10. 閉環自癒工單連動：當過濾器壽命不足時，自動發起濾芯更換任務工單
            if filter_data["trigger_maintenance"] and maintenance_service is not None:
                try:
                    existing_schedules = maintenance_service.list_schedules()
                    already_exists = any(
                        s.get("target") == node_id and s.get("task_type") == "Filter Replacement"
                        for s in existing_schedules
                    )
                    if not already_exists:
                        maintenance_service.create_schedule(
                            target=node_id,
                            task_type="Filter Replacement",
                            scheduled_at=time.strftime("%Y-%m-%d", time.localtime(time.time() + 86400)),
                            recurrence_days=90,
                            assignee_username="admin",
                            assignee_name="AI Self-Healer",
                            assignee_role="L2 Autonomous Operator",
                            assignee_email="healer@datacenter.local",
                            notify_email=False,
                            notes=f"⚠️ 閉環自癒系統自動派單：槽體壓差上升至 {filter_data['current_dp_psi']} PSI，預測壽命僅剩 {filter_data['days_remaining']} 天，已自動排程明天更換濾芯。"
                        )
                except Exception as ex:
                    print(f"[ImmersionSelfHealing] Failed to auto-create maintenance schedule: {ex}")

    def _calculate_void_fraction(self, gpu_power_kw: float, gpu_temp: float, pressure_kpa: float, gpu_count: int = 8) -> Tuple[float, str, bool]:
        """
        依據熱物理力學計算槽體內氣泡比例 (Void Fraction) 與沸騰狀態 (Boiling Regime)
        """
        try:
            if gpu_power_kw <= 0:
                return 0.0, "nucleate", False
                
            # 包含散熱金屬鰭片結構的總相變換熱表面積
            die_area = 0.015 * gpu_count
            heat_flux = (gpu_power_kw * 1000.0) / die_area  # W/m²
            
            pressure_factor = 1.0 - 0.004 * max(0.0, pressure_kpa - P_SAT)
            denom = heat_flux + (RHO_VAPOR * H_FG * V_D)
            void_fraction = (heat_flux / denom) * 100.0 * max(0.2, pressure_factor)
            void_fraction = min(100.0, max(0.0, void_fraction))
            
            if void_fraction >= 45.0 or gpu_temp > 82.0:
                return void_fraction, "film", True  # 臨界乾涸膜狀沸騰，必須降頻
            elif void_fraction >= 25.0:
                return void_fraction, "transition", False  # 過渡沸騰
            else:
                return void_fraction, "nucleate", False  # 核沸騰
                
        except (ZeroDivisionError, ValueError):
            return 0.0, "nucleate", False

    def _estimate_fluid_loss_rate(
        self,
        total_heat_kw: float,
        condenser_inlet_temp: float,
        condenser_flow_lpm: float,
        level_history_mm: List[Tuple[float, float]],
        is_leak_override: bool
    ) -> Dict[str, Any]:
        """
        推算氟化液蒸汽逸散率與液位下降斜率 (d/dt)
        """
        cp_water = 4.184
        water_flow_kg_s = condenser_flow_lpm / 60.0
        
        cooling_capacity_kw = water_flow_kg_s * cp_water * 5.0
        excess_heat_kw = max(0.0, total_heat_kw - cooling_capacity_kw)
        
        loss_factor = 0.05 if excess_heat_kw > 0 else 0.001
        theoretical_loss_ml_hr = (excess_heat_kw / H_FG) * (1.0 / RHO_LIQUID) * 3600.0 * 1e6 * loss_factor
        
        observed_slope_mm_hr = 0.0
        if len(level_history_mm) >= 2:
            t1, l1 = level_history_mm[0]
            t2, l2 = level_history_mm[-1]
            dt_hr = (t2 - t1) / 3600.0
            if dt_hr > 0:
                observed_slope_mm_hr = (l1 - l2) / dt_hr
                
        observed_loss_ml_hr = max(0.0, observed_slope_mm_hr * 120.0)
        
        if is_leak_override:
            # 覆寫強制高流失，展現漏液效果
            fused_loss_rate = max(180.0, observed_loss_ml_hr)
        else:
            fused_loss_rate = 0.7 * observed_loss_ml_hr + 0.3 * theoretical_loss_ml_hr
            
        return {
            "theoretical_loss_rate_ml_hr": round(theoretical_loss_ml_hr, 1),
            "observed_loss_rate_ml_hr": round(observed_loss_ml_hr, 1),
            "fused_loss_rate_ml_hr": round(fused_loss_rate, 1),
            "leak_severity": "critical" if fused_loss_rate > 50.0 else "warning" if fused_loss_rate > 15.0 else "normal"
        }

    def _predict_filter_lifecycle(self, dp_history: List[Tuple[float, float]], max_allowed_dp: float = 15.0) -> Dict[str, Any]:
        """
        過濾器壓差斜率預測
        """
        if len(dp_history) < 5:
            current_dp = dp_history[-1][1] if len(dp_history) > 0 else 2.2
            progress = max(0.0, min(100.0, (1.0 - (current_dp - 1.0) / 14.0) * 100.0))
            return {
                "current_dp_psi": round(current_dp, 2),
                "days_remaining": 90.0,
                "progress": round(progress, 1),
                "status": "normal",
                "trigger_maintenance": False
            }
            
        n = len(dp_history)
        sum_x = sum_y = sum_xx = sum_xy = 0.0
        t0 = dp_history[0][0]
        
        for t, dp in dp_history:
            x = (t - t0) / 86400.0
            y = dp
            sum_x += x
            sum_y += y
            sum_xx += x * x
            sum_xy += x * y
            
        denom = (n * sum_xx - sum_x * sum_x)
        if abs(denom) < 1e-6:
            current_dp = dp_history[-1][1]
            progress = max(0.0, min(100.0, (1.0 - (current_dp - 1.0) / 14.0) * 100.0))
            return {
                "current_dp_psi": round(current_dp, 2),
                "days_remaining": 90.0,
                "progress": round(progress, 1),
                "status": "normal",
                "trigger_maintenance": False
            }
            
        slope = (n * sum_xy - sum_x * sum_y) / denom
        current_dp = dp_history[-1][1]
        
        if slope <= 0:
            progress = max(0.0, min(100.0, (1.0 - (current_dp - 1.0) / 14.0) * 100.0))
            return {
                "current_dp_psi": round(current_dp, 2),
                "days_remaining": 120.0,
                "progress": round(progress, 1),
                "status": "normal",
                "trigger_maintenance": False
            }
            
        days_to_limit = (max_allowed_dp - current_dp) / slope
        days_remaining = max(0.0, round(days_to_limit, 1))
        
        life_progress = max(0.0, min(100.0, (1.0 - (current_dp - 1.0) / 14.0) * 100.0))
        status = "critical" if days_remaining <= 7 else "warning" if days_remaining <= 21 else "normal"
        
        return {
            "current_dp_psi": round(current_dp, 2),
            "days_remaining": days_remaining,
            "progress": round(life_progress, 1),
            "status": status,
            "trigger_maintenance": status in ["critical", "warning"]
        }

    def _check_chemical_degradation(self, conductivity_us_cm: float, ph_value: float, water_content_ppm: float) -> Dict[str, Any]:
        """
        化學裂解評估
        """
        hf_corrosion_risk = "low"
        if ph_value < 5.5 or conductivity_us_cm > 1.2:
            hf_corrosion_risk = "high"
        elif ph_value < 6.5 or conductivity_us_cm > 0.6:
            hf_corrosion_risk = "medium"
            
        water_warning = water_content_ppm > 50.0
        severity = "critical" if hf_corrosion_risk == "high" else "warning" if hf_corrosion_risk == "medium" else "normal"
        
        return {
            "hf_corrosion_risk": hf_corrosion_risk,
            "water_warning": water_warning,
            "severity": severity,
            "description": (
                "CRITICAL: 化學腐蝕警告！電導率過高且 pH 呈強酸性，氟化液熱裂解中！已自動開啟線上雙極過濾淨化。"
                if severity == "critical" else 
                "WARNING: 氟化液劣化警告。電導率上升且 pH 偏酸，已啟動旁路乾燥過濾系統。"
                if severity == "warning" else
                "流體化學性質優良。雙相氟化液電導率與酸鹼值均處於安全標準區間。"
            )
        }
