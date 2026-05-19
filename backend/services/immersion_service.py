# -*- coding: utf-8 -*-
"""
Immersion Cooling Deep Telemetry and Degradation Prediction Service.
Strictly PEP 8 compliant, highly robust, and Production ready.
"""

from __future__ import annotations
import math
import time
import threading
import re
from typing import Dict, Any, List, Tuple, Optional
from abc import ABC, abstractmethod

# 雙相浸沒式冷卻氟化液熱物理常數
H_FG = 112000.0      # 汽化潛熱 Latent Heat of Vaporization (J/kg)
RHO_VAPOR = 14.3     # 飽和蒸汽密度 (kg/m³)
RHO_LIQUID = 1430.0   # 氟化液液體密度 (kg/m³)
V_D = 0.45           # 氣泡上升速度常數 (m/s)
P_SAT = 101.3        # 大氣飽和壓力 (kPa)


def predict_filter_lifecycle_static(dp_history: List[Tuple[float, float]], max_allowed_dp: float = 15.0) -> Dict[str, Any]:
    """
    靜態共享的過濾器壓差斜率預測工具
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
    
    pressure_life = (1.0 - (current_dp - 1.0) / 14.0) * 100.0
    time_life = (days_remaining / 90.0) * 100.0
    life_progress = max(0.0, min(100.0, pressure_life, time_life))
    status = "critical" if days_remaining <= 7 else "warning" if days_remaining <= 21 else "normal"
    
    return {
        "current_dp_psi": round(current_dp, 2),
        "days_remaining": days_remaining,
        "progress": round(life_progress, 1),
        "status": status,
        "trigger_maintenance": status in ["critical", "warning"]
    }


class ImmersionCoolingEngine(ABC):
    """
    浸沒式冷卻物理/化學推算引擎抽象類別
    """
    def __init__(self, node_id: str) -> None:
        self.node_id = node_id

    @abstractmethod
    def update_telemetry(
        self,
        data: Dict[str, Any],
        latest_metrics: List[Dict[str, Any]],
        override: Dict[str, Any],
        maintenance_service: Optional[Any] = None
    ) -> None:
        pass

    @abstractmethod
    def reset_consumables(self, task_type: str) -> None:
        """重置耗材與物理狀態"""
        pass

class SinglePhaseEngine(ImmersionCoolingEngine):
    """
    單相（1P）浸沒式液冷物理引擎：
    聚焦顯熱對流、泵浦流場、油品黏度與化學劣化（介電強度、總酸值）。
    """
    def __init__(self, node_id: str) -> None:
        super().__init__(node_id)
        self._dp_history: List[Tuple[float, float]] = []

        # 🟢 核心修正 1：內部化物理與化學狀態，絕不依賴外部 data 的瞬間值
        self._current_dp = 2.2
        self._current_dielectric = 50.0
        self._current_tan = 0.02
        self._current_water = 15.0
        self._current_outlet_temp = 30.0  # 模擬熱慣性用的當前出水溫

    def update_telemetry(
        self,
        data: Dict[str, Any],
        latest_metrics: List[Dict[str, Any]],
        override: Dict[str, Any],
        maintenance_service: Optional[Any] = None
    ) -> None:
        now = time.time()

        # 1. 獲取基本負載功率與溫度
        tank_servers_power = 0.0
        max_gpu_temp = 35.0

        for m in latest_metrics:
            parent_rack = m.get("rack_id", m.get("server_id", ""))
            if self.node_id in parent_rack or parent_rack == self.node_id:
                tank_servers_power += float(m.get("power_kw", 0.0))
                max_gpu_temp = max(max_gpu_temp, float(m.get("temperature", 35.0)))

        if tank_servers_power == 0:
            tank_servers_power = float(data.get("power_kw", data.get("power_usage_kw", 12.5)))

        if "gpu_load_kw" in override:
            tank_servers_power = float(override["gpu_load_kw"])

        inlet_temp = float(override.get("condenser_inlet_temp", 30.0))

        # 2. 目標泵浦流量 (假設滿載 300 LPM)
        target_flow = float(override.get("condenser_flow_lpm", 150.0))
        if tank_servers_power > 40.0:
            target_flow = 250.0

        # 🟢 核心修正 2：過濾器壓差 (Filter DP) 物理限制與流量折減
        dp_growth = 0.0001
        if override.get("clogged_filter", False):
            dp_growth = 2.1  # 模擬快速堵塞

        # 使用內部變數累加！擺脫 data 被洗掉的命運
        self._current_dp = min(15.0, self._current_dp + dp_growth)
        simulated_dp_base = self._current_dp

        # 流量折減率：當壓差超過 3.0 時流阻開始浮現，讓實際流量下降
        flow_resistance_factor = 1.0
        if simulated_dp_base > 3.0:
            flow_resistance_factor = max(0.15, 1.0 - (simulated_dp_base - 3.0) / 12.0 * 0.85)

        actual_pump_flow = target_flow * flow_resistance_factor

        # 3. 熱力學對流溫升推算 (Q = m * Cp * dT)
        # 單相油品比熱容約為 1.8 kJ/kg.K，密度約 0.85 kg/L
        cp_oil = 1.8
        density_oil = 0.85
        mass_flow_kg_s = (actual_pump_flow / 60.0) * density_oil

        if mass_flow_kg_s > 0:
            delta_t = tank_servers_power / (mass_flow_kg_s * cp_oil)
        else:
            delta_t = tank_servers_power * 0.5  # 極端無流量狀態下的溫升懲罰

        target_outlet = inlet_temp + delta_t

        # 模擬熱慣性 (Thermal Inertia)，出水溫不會瞬間跳躍
        tau = 15.0
        self._current_outlet_temp += (target_outlet - self._current_outlet_temp) * (1.0 / tau)
        outlet_temp = self._current_outlet_temp

        # 評估是否產生熱點 (Hotspot) 或需要降頻 (Throttle)
        hotspot_prob = max(0.0, min(100.0, (outlet_temp - 50.0) * 5.0))
        should_throttle = outlet_temp > 65.0 or max_gpu_temp > 85.0

        # 4. 更新壓差歷史與預測壽命
        # 為了中控台能準確執行線性迴歸，我們必須回傳「不受降流速掩蓋」的名目堵塞壓差
        final_dp = simulated_dp_base
        self._dp_history.append((now, final_dp))
        if len(self._dp_history) > 300:
            self._dp_history.pop(0)

        filter_data = predict_filter_lifecycle_static(self._dp_history)

        # 🟢 核心修正 3：化學性質劣化改用內部狀態累加
        if override.get("water_intrusion", False):
            self._current_water = min(200.0, self._current_water + 15.0)
            self._current_dielectric = max(5.0, self._current_dielectric - 3.75)
        elif tank_servers_power > 60.0 and max_gpu_temp > 78.0:
            self._current_tan = min(0.3, self._current_tan + 0.01)

        regeneration_state = "standby"
        if self._current_tan > 0.15 or self._current_dielectric < 30.0:
            regeneration_state = "active_full"
            self._current_tan = max(0.02, self._current_tan - 0.008)
            self._current_dielectric = min(50.0, self._current_dielectric + 1.5)
            self._current_water = max(15.0, self._current_water - 5.0)
        elif self._current_tan > 0.08 or self._current_dielectric < 40.0:
            regeneration_state = "active_bypass"
            self._current_tan = max(0.02, self._current_tan - 0.002)
            self._current_dielectric = min(50.0, self._current_dielectric + 0.5)
            self._current_water = max(15.0, self._current_water - 1.5)

        # 5. 全面寫入遙測數據字典
        data["type"] = "immersion_single"
        data["delta_t"] = round(delta_t, 1)
        data["outlet_temp"] = round(outlet_temp, 1)
        data["max_gpu_temp"] = round(max_gpu_temp, 1)
        data["hotspot_prob"] = round(hotspot_prob, 1)
        data["should_throttle"] = should_throttle
        data["condenser_inlet_temp"] = inlet_temp
        data["condenser_flow_lpm"] = round(actual_pump_flow, 1)

        data["filter_dp_psi"] = filter_data["current_dp_psi"]
        data["filter_progress"] = filter_data["progress"]
        data["filter_days_remaining"] = filter_data["days_remaining"]
        data["filter_status"] = filter_data["status"]
        data["trigger_filter_maintenance"] = filter_data["trigger_maintenance"]

        data["dielectric_strength_kv"] = round(self._current_dielectric, 1)
        data["tan_mg_koh_g"] = round(self._current_tan, 3)
        data["water_content_ppm"] = round(self._current_water, 1)
        data["regeneration_state"] = regeneration_state

        chem_severity = "critical" if self._current_dielectric < 30.0 else "warning" if self._current_tan > 0.15 else "normal"
        data["chem_severity"] = chem_severity
        data["chem_description"] = (
            f"CRITICAL: 介電強度危急 ({round(self._current_dielectric, 1)} kV)！有放電短路風險，線上脫水淨化旁路全載運轉中。"
            if self._current_dielectric < 30.0 else
            f"WARNING: 冷卻油總酸值超標 ({round(self._current_tan, 3)} mgKOH/g)，可能腐蝕金屬件，已啟動旁路脫酸系統。"
            if self._current_tan > 0.15 else
            "單相冷卻油電介性質優良，黏度與絕緣強度均處於正常範圍。"
        )

        if should_throttle:
            data["power_capped"] = True
            try:
                data["power_kw"] = min(float(data.get("power_kw", 8.0)), 3.0)
            except (ValueError, TypeError):
                data["power_kw"] = 3.0

        # 6. 自動工單連動
        if filter_data["trigger_maintenance"] and maintenance_service is not None:
            try:
                existing_schedules = maintenance_service.list_schedules()
                already_exists = any(
                    s.get("target") == self.node_id 
                    and s.get("task_type") == "Filter Replacement (Single-Phase)"
                    and s.get("status") != "COMPLETED"
                    for s in existing_schedules
                )
                if not already_exists:
                    maintenance_service.create_schedule(
                        target=self.node_id,
                        task_type="Filter Replacement (Single-Phase)",
                        scheduled_at=time.strftime("%Y-%m-%d", time.localtime(now + 86400)),
                        recurrence_days=180,
                        assignee_username="admin",
                        assignee_name="AI Self-Healer",
                        assignee_role="L2 Autonomous Operator",
                        assignee_email="healer@datacenter.local",
                        notify_email=False,
                        notes=f"⚠️ 閉環自癒系統自動派單：單相冷卻油過濾器壓差上升至 {filter_data['current_dp_psi']} PSI，預測壽命僅剩 {filter_data['days_remaining']} 天，已自動排程明天更換濾芯。",
                        is_auto_generated=True
                    )
            except Exception as ex:
                print(f"[ImmersionSelfHealing] Failed to auto-create maintenance schedule: {ex}")

    def reset_consumables(self, task_type: str) -> None:
        # 🟢 核心修正 4：結案時完美重置物理引擎內部變數
        if "filter" in task_type.lower() or "濾" in task_type:
            self._dp_history.clear()
            self._current_dp = 2.2
        if "fluid" in task_type.lower() or "oil" in task_type.lower() or "液" in task_type or "油" in task_type:
            self._current_dielectric = 50.0
            self._current_tan = 0.02
            self._current_water = 15.0

class TwoPhaseEngine(ImmersionCoolingEngine):
    """
    雙相（2P）浸沒式液冷物理引擎：
    聚焦汽化相變、潛熱（Latent Heat）、氣泡比例（Void Fraction）與氟化液冷凝回收。
    """
    def __init__(self, node_id: str) -> None:
        super().__init__(node_id)
        self._dp_history: List[Tuple[float, float]] = []
        self._level_history: List[Tuple[float, float]] = []
        
        # 🟢 核心修正 1：內部化物理與化學狀態，絕不依賴外部 data 的瞬間值
        self._current_dp = 2.2
        self._current_level = 480.0
        self._current_cond = 0.08
        self._current_ph = 7.2
        self._current_water = 8.0

    def update_telemetry(
        self,
        data: Dict[str, Any],
        latest_metrics: List[Dict[str, Any]],
        override: Dict[str, Any],
        maintenance_service: Optional[Any] = None
    ) -> None:
        now = time.time()
        
        pressure = float(data.get("pressure_kpa", 102.5))
        
        # 1. 獲取基本負載功率
        tank_servers_power = 0.0
        max_gpu_temp = 35.0
        
        for m in latest_metrics:
            parent_rack = m.get("rack_id", m.get("server_id", ""))
            if self.node_id in parent_rack or parent_rack == self.node_id:
                tank_servers_power += float(m.get("power_kw", 0.0))
                max_gpu_temp = max(max_gpu_temp, float(m.get("temperature", 35.0)))
        
        if tank_servers_power == 0:
            tank_servers_power = float(data.get("power_kw", data.get("power_usage_kw", 12.5)))
        
        if "gpu_load_kw" in override:
            tank_servers_power = float(override["gpu_load_kw"])
        
        condenser_flow = float(override.get("condenser_flow_lpm", 15.0))
        condenser_inlet_temp = float(override.get("condenser_inlet_temp", 28.0))
        
        # 2. 氣泡比例與沸騰 Regime 計算
        void_fraction, boiling_regime, should_throttle = self._calculate_void_fraction(
            gpu_power_kw=tank_servers_power,
            gpu_temp=max_gpu_temp,
            pressure_kpa=pressure
        )
        
        # 🟢 核心修正 2：液位與流失率改用內部 _current_level 進行累加
        is_leak = override.get("seal_leak", False)
        if is_leak:
            level_drift = 0.08  # 漏液快速下降
        else:
            level_drift = 0.0005  # 微幅蒸發下降
            
        self._current_level = max(10.0, self._current_level - level_drift)
        data["fluid_level_mm"] = round(self._current_level, 2)
        
        self._level_history.append((now, self._current_level))
        if len(self._level_history) > 300:
            self._level_history.pop(0)
            
        loss_data = self._estimate_fluid_loss_rate(
            total_heat_kw=tank_servers_power,
            condenser_inlet_temp=condenser_inlet_temp,
            condenser_flow_lpm=condenser_flow,
            level_history_mm=self._level_history,
            is_leak_override=is_leak
        )
        
        # 🟢 核心修正 3：過濾器壓差改用內部 _current_dp 進行累加
        dp_growth = 0.0002 if self._current_dp < 14.5 else 0.0
        if override.get("clogged_filter", False):
            dp_growth = 2.1
            
        self._current_dp = min(15.0, self._current_dp + dp_growth)
        data["filter_dp_psi"] = round(self._current_dp, 2)
        
        self._dp_history.append((now, self._current_dp))
        if len(self._dp_history) > 300:
            self._dp_history.pop(0)
            
        filter_data = predict_filter_lifecycle_static(self._dp_history)
        
        # 🟢 核心修正 4：化學性質改用內部狀態累加
        if is_leak or override.get("water_intrusion", False):
            # 水氣入侵，電導率飆升，pH 下降
            self._current_cond = min(2.5, self._current_cond + 0.15)
            self._current_ph = max(4.0, self._current_ph - 0.25)
            self._current_water = min(200.0, self._current_water + 15.0)
        elif tank_servers_power > 60.0 and max_gpu_temp > 78.0:
            # 高溫熱裂解產生 HF (氫氟酸)
            self._current_cond = min(1.8, self._current_cond + 0.005)
            self._current_ph = max(4.8, self._current_ph - 0.01)
            self._current_water = min(40.0, self._current_water + 0.2)
            
        purification = "standby"
        if self._current_ph < 5.5 or self._current_cond > 1.2:
            purification = "active_full"
            self._current_cond = max(0.08, self._current_cond - 0.02)
            self._current_ph = min(7.2, self._current_ph + 0.04)
            self._current_water = max(8.0, self._current_water - 5.0) # 加速除水
        elif self._current_ph < 6.5 or self._current_cond > 0.6:
            purification = "active_bypass"
            self._current_cond = max(0.08, self._current_cond - 0.005)
            self._current_ph = min(7.2, self._current_ph + 0.01)
            self._current_water = max(8.0, self._current_water - 1.5)
            
        data["conductivity_us_cm"] = round(self._current_cond, 3)
        data["ph_value"] = round(self._current_ph, 2)
        data["water_content_ppm"] = round(self._current_water, 1)
        
        chem_data = self._check_chemical_degradation(self._current_cond, self._current_ph, self._current_water)
        
        # 6. 全面寫入遙測數據字典
        data["type"] = "immersion_dual"
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
        
        if should_throttle:
            data["power_capped"] = True
            try:
                data["power_kw"] = min(float(data.get("power_kw", 8.0)), 3.0)
            except (ValueError, TypeError):
                data["power_kw"] = 3.0

        # 工單連動
        if filter_data["trigger_maintenance"] and maintenance_service is not None:
            try:
                existing_schedules = maintenance_service.list_schedules()
                already_exists = any(
                    s.get("target") == self.node_id 
                    and s.get("task_type") == "Filter Replacement"
                    and s.get("status") != "COMPLETED"
                    for s in existing_schedules
                )
                if not already_exists:
                    maintenance_service.create_schedule(
                        target=self.node_id,
                        task_type="Filter Replacement",
                        scheduled_at=time.strftime("%Y-%m-%d", time.localtime(time.time() + 86400)),
                        recurrence_days=90,
                        assignee_username="admin",
                        assignee_name="AI Self-Healer",
                        assignee_role="L2 Autonomous Operator",
                        assignee_email="healer@datacenter.local",
                        notify_email=False,
                        notes=f"⚠️ 閉環自癒系統自動派單：槽體壓差上升至 {filter_data['current_dp_psi']} PSI，預測壽命僅剩 {filter_data['days_remaining']} 天，已自動排程明天更換濾芯。",
                        is_auto_generated=True
                    )
            except Exception as ex:
                print(f"[ImmersionSelfHealing] Failed to auto-create maintenance schedule: {ex}")

    def _calculate_void_fraction(self, gpu_power_kw: float, gpu_temp: float, pressure_kpa: float, gpu_count: int = 8) -> Tuple[float, str, bool]:
        try:
            if gpu_power_kw <= 0:
                return 0.0, "nucleate", False
                
            die_area = 0.015 * gpu_count
            heat_flux = (gpu_power_kw * 1000.0) / die_area
            
            pressure_factor = 1.0 - 0.004 * max(0.0, pressure_kpa - P_SAT)
            denom = heat_flux + (RHO_VAPOR * H_FG * V_D)
            void_fraction = (heat_flux / denom) * 100.0 * max(0.2, pressure_factor)
            void_fraction = min(100.0, max(0.0, void_fraction))
            
            if void_fraction >= 45.0 or gpu_temp > 82.0:
                return void_fraction, "film", True
            elif void_fraction >= 25.0:
                return void_fraction, "transition", False
            else:
                return void_fraction, "nucleate", False
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
            fused_loss_rate = max(180.0, observed_loss_ml_hr)
        else:
            fused_loss_rate = 0.7 * observed_loss_ml_hr + 0.3 * theoretical_loss_ml_hr
            
        return {
            "theoretical_loss_rate_ml_hr": round(theoretical_loss_ml_hr, 1),
            "observed_loss_rate_ml_hr": round(observed_loss_ml_hr, 1),
            "fused_loss_rate_ml_hr": round(fused_loss_rate, 1),
            "leak_severity": "critical" if fused_loss_rate > 50.0 else "warning" if fused_loss_rate > 15.0 else "normal"
        }

    def _check_chemical_degradation(self, conductivity_us_cm: float, ph_value: float, water_content_ppm: float) -> Dict[str, Any]:
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

    def reset_consumables(self, task_type: str) -> None:
        # 🟢 核心修正 5：結案時，清空歷史的同時，一併重置實例內部的物理狀態
        if "filter" in task_type.lower() or "濾" in task_type:
            self._dp_history.clear()
            self._current_dp = 2.2
            
        if "fluid" in task_type.lower() or "leak" in task_type.lower() or "液" in task_type:
            self._level_history.clear()
            self._current_level = 480.0
            self._current_cond = 0.08
            self._current_ph = 7.2
            self._current_water = 8.0

class ImmersionCoolingService:
    """
    流體力學與化學裂解推算虛擬遙測中控服務（Facade & Factory Pattern）
    """
    def __init__(self) -> None:
        self._lock = threading.RLock()
        
        # 儲存每個槽體（單相或雙相）專屬的狀態引擎
        self._engines: Dict[str, ImmersionCoolingEngine] = {}
        
        # 儲存槽體識別 ID 與其對應單/雙相型態的動態映射
        self._tank_types: Dict[str, str] = {}
        
        # 模擬調控滑桿覆寫，用於展場觀眾模擬調參
        # 結構: { tank_id: { 'gpu_load_kw': X, 'condenser_flow_lpm': Y, 'seal_leak': bool } }
        self.simulator_overrides: Dict[str, Dict[str, Any]] = {}

    def register_tank_type(self, tank_id: str, tank_type: str) -> None:
        """
        註冊/記錄槽體 ID 與類型的映射關係
        """
        with self._lock:
            self._tank_types[tank_id] = tank_type

    def get_tank_type(self, tank_id: str) -> Optional[str]:
        """
        取得槽體類型
        """
        with self._lock:
            return self._tank_types.get(tank_id)

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
        攔截浸沒式槽體的 telemetry，並使用對應的物理引擎進行解耦計算。
        """
        node_upper = node_id.upper()
        tank_type = self._tank_types.get(node_id) or data.get("type")
        if not ("IMM" in node_upper or "TP" in node_upper or "TANK" in node_upper or tank_type in ["immersion_single", "immersion_dual"]):
            return

        with self._lock:
            # 判斷是否為單相冷卻系統
            is_single = "single" in node_id.lower() or "1p" in node_id.lower() or tank_type == "immersion_single"
            
            # 1. 建立/獲取解耦引擎 (Factory Pattern)
            if node_id not in self._engines:
                if is_single:
                    self._engines[node_id] = SinglePhaseEngine(node_id)
                else:
                    self._engines[node_id] = TwoPhaseEngine(node_id)
            
            # 2. 獲取當前模擬器手動覆寫值
            override = self.simulator_overrides.get(node_id, {})
            
            # 3. 委託引擎計算 (Strategy Pattern)
            self._engines[node_id].update_telemetry(data, latest_metrics, override, maintenance_service)

    def reset_consumables(self, tank_id: str, task_type: str, telemetry_service: Any = None) -> None:
        """
        當維護工單被完成時，重置單相/雙相浸沒式冷卻系統的相關耗材壽命與流體化學數值。
        同時清除該槽體對應的模擬器故障覆寫。
        """
        clean_id = re.sub(r"\s+", "", (tank_id or "").strip().upper().replace("_", "-"))
        with self._lock:
            # 清除模擬器故障覆寫
            if clean_id in self.simulator_overrides:
                self.simulator_overrides[clean_id]["clogged_filter"] = False
                self.simulator_overrides[clean_id]["water_intrusion"] = False
                self.simulator_overrides[clean_id]["seal_leak"] = False

            # 找到對應引擎進行內部歷史重置
            engine = self._engines.get(clean_id)
            if engine:
                engine.reset_consumables(task_type)

            # 同步更新 telemetry 快取中的數值，防止時序資料庫/快取殘留舊的異常值
            if telemetry_service and clean_id in telemetry_service.latest_metrics:
                payload = telemetry_service.latest_metrics[clean_id]

                # 不論是單相或雙相，如果有更換濾清器，重置壓差
                if "filter" in task_type.lower() or "濾" in task_type:
                    payload["filter_dp_psi"] = 2.2
                    payload["filter_progress"] = 100.0
                    payload["filter_days_remaining"] = 90.0
                    payload["filter_status"] = "normal"
                    payload["trigger_filter_maintenance"] = False

                # 針對流體老化或水氣入侵維護，重置化學品質與液位
                if "fluid" in task_type.lower() or "oil" in task_type.lower() or "油" in task_type or "液" in task_type:
                    tank_type = self._tank_types.get(clean_id) or payload.get("type")
                    is_single = "single" in clean_id.lower() or "1p" in clean_id.lower() or tank_type == "immersion_single"
                    if is_single:
                        payload["dielectric_strength_kv"] = 50.0
                        payload["tan_mg_koh_g"] = 0.02
                        payload["water_content_ppm"] = 15.0
                        payload["viscosity_cst"] = 10.0
                        payload["regeneration_state"] = "standby"
                        payload["chem_severity"] = "normal"
                        payload["chem_description"] = "單相冷卻油電介性質優良，黏度與絕緣強度均處於正常範圍。"
                    else:
                        payload["fluid_level_mm"] = 480.0
                        payload["conductivity_us_cm"] = 0.08
                        payload["ph_value"] = 7.2
                        payload["water_content_ppm"] = 8.0
                        payload["purification_state"] = "standby"
                        payload["chem_severity"] = "normal"
                        payload["chem_description"] = "流體化學性質優良。雙相氟化液電導率與酸鹼值均處於安全標準區間。"
