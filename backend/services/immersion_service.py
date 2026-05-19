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
    
    life_progress = max(0.0, min(100.0, (1.0 - (current_dp - 1.0) / 14.0) * 100.0))
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


class SinglePhaseEngine(ImmersionCoolingEngine):
    """
    單相（1P）浸沒式液冷物理引擎：
    聚焦顯熱對流（Q = m * Cp * ΔT）、Arrhenius 動力黏度與過濾器流阻折減模型。
    """
    def __init__(self, node_id: str) -> None:
        super().__init__(node_id)
        self._dp_history: List[Tuple[float, float]] = []

    def update_telemetry(
        self,
        data: Dict[str, Any],
        latest_metrics: List[Dict[str, Any]],
        override: Dict[str, Any],
        maintenance_service: Optional[Any] = None
    ) -> None:
        now = time.time()
        
        # 1. 獲取基本負載功率
        tank_servers_power = 0.0
        for m in latest_metrics:
            parent_rack = m.get("rack_id", m.get("server_id", ""))
            if self.node_id in parent_rack or parent_rack == self.node_id:
                try:
                    tank_servers_power += float(m.get("power_kw", 0.0))
                except (ValueError, TypeError):
                    pass
        
        if tank_servers_power == 0:
            try:
                tank_servers_power = float(data.get("power_kw", data.get("power_usage_kw", 12.5)))
            except (ValueError, TypeError):
                tank_servers_power = 12.5
            
        if "gpu_load_kw" in override:
            try:
                tank_servers_power = float(override["gpu_load_kw"])
            except (ValueError, TypeError):
                pass
            
        # 2. 獲取進油溫度 (Cold Aisle / Inlet Temp)
        try:
            inlet_temp = float(override.get("condenser_inlet_temp", 35.0))
        except (ValueError, TypeError):
            inlet_temp = 35.0

        # 3. 動力黏度 Arrhenius 溫度修正模型 (在低溫時黏度偏高，阻力增加)
        t_est_c = inlet_temp + 10.0
        try:
            viscosity = 0.05 * math.exp(1600.0 / (t_est_c + 273.15))
        except Exception:
            viscosity = 10.0

        # 4. 循環泵浦流量 (LPM) 及其 PID 自動調節邏輯
        # 若無手動覆寫流量，系統依據 GPU 負載動態調整泵浦流量 (PID 閉環控制，目標維持溫升在 12.0°C 左右)
        has_flow_override = "condenser_flow_lpm" in override
        if has_flow_override:
            try:
                target_flow = float(override["condenser_flow_lpm"])
            except (ValueError, TypeError):
                target_flow = 15.0
        else:
            # 閉環 PID 自動控制：Q = m_dot * cp * delta_t
            # 流量需求 LPM = power / (rho * cp * delta_t_target / 60)
            try:
                target_flow = min(150.0, max(12.0, tank_servers_power / 0.328))
            except Exception:
                target_flow = 15.0

        # 5. 過濾器壓差 (Filter DP) 物理限制與流量折減
        try:
            dp_base = float(data.get("filter_dp_psi", 2.2))
        except (ValueError, TypeError):
            dp_base = 2.2

        dp_growth = 0.0001
        if override.get("clogged_filter", False):
            # 模擬濾芯快速油泥堵塞
            dp_growth = 2.1
        simulated_dp_base = min(15.0, dp_base + dp_growth)

        # 流量折減率：壓差高於 3.0 PSI 時流阻開始增加，達 15.0 PSI 時實際流量銳減 85%
        flow_resistance_factor = 1.0
        if simulated_dp_base > 3.0:
            flow_resistance_factor = max(0.15, 1.0 - (simulated_dp_base - 3.0) / 12.0 * 0.85)

        actual_pump_flow = target_flow * flow_resistance_factor

        # 6. 強制熱對流溫升與熱點推導
        rho_oil = 0.82
        cp_oil = 2.0
        oil_flow_kg_s = (actual_pump_flow * rho_oil) / 60.0
        
        if oil_flow_kg_s > 0:
            try:
                delta_t = min(60.0, tank_servers_power / (oil_flow_kg_s * cp_oil))
            except ZeroDivisionError:
                delta_t = 60.0
        else:
            delta_t = 60.0
            
        outlet_temp = inlet_temp + delta_t
        max_gpu_temp = inlet_temp + delta_t * 1.25
        
        # 精確更新當前平均油溫下的動力黏度 (Arrhenius 方程式)
        t_avg_c = inlet_temp + delta_t / 2.0
        try:
            viscosity = 0.05 * math.exp(1600.0 / (t_avg_c + 273.15))
        except Exception:
            viscosity = 10.0

        # 修正後的最終壓差 (依據 Hagen-Poiseuille / Darcy 定律，正比於實際流速與黏度)
        try:
            viscosity_factor = viscosity / 10.0
            flow_factor = actual_pump_flow / 15.0
            corrected_dp = simulated_dp_base * viscosity_factor * flow_factor
            final_dp = min(15.0, max(0.5, corrected_dp))
        except Exception:
            final_dp = simulated_dp_base

        # 熱點形成機率 (隨溫升呈指數衰減漸近)
        try:
            hotspot_prob = (1.0 - math.exp(-0.08 * delta_t)) * 100.0
        except Exception:
            hotspot_prob = 100.0

        should_throttle = hotspot_prob >= 75.0 or max_gpu_temp > 85.0
        
        # 紀錄歷史壓差以供預測
        self._dp_history.append((now, final_dp))
        if len(self._dp_history) > 300:
            self._dp_history.pop(0)
            
        filter_data = predict_filter_lifecycle_static(self._dp_history)
        
        # 閉環自癒工單派發
        if filter_data["trigger_maintenance"] and maintenance_service is not None:
            try:
                existing_schedules = maintenance_service.list_schedules()
                already_exists = any(
                    s.get("target") == self.node_id and s.get("task_type") == "Filter Replacement (Single-Phase)"
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
                        notes=f"⚠️ 單相自癒系統派單：濾芯壓差已升至 {filter_data['current_dp_psi']} PSI，預計殘餘壽命僅 {filter_data['days_remaining']} 天，自動排程明日進行單相冷卻油濾清器更換。"
                    )
            except Exception as ex:
                print(f"[SinglePhaseSelfHealing] Auto-ticket failed: {ex}")
                
        # 7. 化學性質劣化（介電強度與 TAN 氧化）
        try:
            dielectric_strength_kv = float(data.get("dielectric_strength_kv", 50.0))
        except (ValueError, TypeError):
            dielectric_strength_kv = 50.0

        try:
            tan_mg_koh_g = float(data.get("tan_mg_koh_g", 0.02))
        except (ValueError, TypeError):
            tan_mg_koh_g = 0.02

        try:
            water_content_ppm = float(data.get("water_content_ppm", 15.0))
        except (ValueError, TypeError):
            water_content_ppm = 15.0
        
        if override.get("water_intrusion", False):
            # 水氣混入，水分攀升，介電強度驟降
            water_content_ppm = min(200.0, water_content_ppm + 15.0)
            dielectric_strength_kv = max(5.0, dielectric_strength_kv - 3.75)
        elif tank_servers_power > 60.0 and max_gpu_temp > 78.0:
            # 高溫氧化導致總酸值微增
            tan_mg_koh_g = min(0.3, tan_mg_koh_g + 0.01)
            
        # 線上再生脫水與酸吸附系統自癒反應 (當化學屬性超標，開啟自癒旁路)
        regeneration_state = "standby"
        if tan_mg_koh_g > 0.15 or dielectric_strength_kv < 30.0:
            regeneration_state = "active_full"
            tan_mg_koh_g = max(0.02, tan_mg_koh_g - 0.008)
            dielectric_strength_kv = min(50.0, dielectric_strength_kv + 1.5)
            water_content_ppm = max(15.0, water_content_ppm - 5.0)
        elif tan_mg_koh_g > 0.08 or dielectric_strength_kv < 40.0:
            regeneration_state = "active_bypass"
            tan_mg_koh_g = max(0.02, tan_mg_koh_g - 0.002)
            dielectric_strength_kv = min(50.0, dielectric_strength_kv + 0.5)
            water_content_ppm = max(15.0, water_content_ppm - 1.5)
            
        data["dielectric_strength_kv"] = round(dielectric_strength_kv, 1)
        data["tan_mg_koh_g"] = round(tan_mg_koh_g, 3)
        data["water_content_ppm"] = round(water_content_ppm, 1)
        data["viscosity_cst"] = round(viscosity, 2)
        data["regeneration_state"] = regeneration_state
        
        # 8. 全面寫入遙測數據字典
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
        
        data["chem_severity"] = "critical" if dielectric_strength_kv < 30.0 else "warning" if tan_mg_koh_g > 0.15 else "normal"
        data["chem_description"] = (
            f"CRITICAL: 介電強度危急 ({dielectric_strength_kv} kV)！有放電短路風險，線上脫水淨化旁路全載運轉中。"
            if dielectric_strength_kv < 30.0 else
            f"WARNING: 冷卻油總酸值超標 ({tan_mg_koh_g} mg KOH/g)，已啟動活性白土吸附旁路。"
            if tan_mg_koh_g > 0.15 else
            "單相冷卻油電介性質優良，黏度與絕緣強度均處於正常範圍。"
        )
        
        # 自癒降頻保護 (介電強度極端低下或高溫熱飽和)
        if should_throttle or dielectric_strength_kv < 25.0:
            data["should_throttle"] = True
            data["power_capped"] = True
            try:
                data["power_kw"] = min(float(data.get("power_kw", 8.0)), 3.0)
            except (ValueError, TypeError):
                data["power_kw"] = 3.0


class TwoPhaseEngine(ImmersionCoolingEngine):
    """
    雙相（2P）浸沒式液冷物理引擎：
    聚焦汽化相變、潛熱（Latent Heat）、氣泡比例（Void Fraction）與氟化液冷凝回收。
    """
    def __init__(self, node_id: str) -> None:
        super().__init__(node_id)
        self._dp_history: List[Tuple[float, float]] = []
        self._level_history: List[Tuple[float, float]] = []

    def update_telemetry(
        self,
        data: Dict[str, Any],
        latest_metrics: List[Dict[str, Any]],
        override: Dict[str, Any],
        maintenance_service: Optional[Any] = None
    ) -> None:
        now = time.time()
        
        pressure = float(data.get("pressure_kpa", 102.5))
        level = float(data.get("fluid_level_mm", 480.0))
        
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
        
        # 3. 液位與流失率 (Fugitive Evaporation) 斜率計算
        is_leak = override.get("seal_leak", False)
        if is_leak:
            level_drift = 0.08  # 漏液快速下降
        else:
            level_drift = 0.0005  # 微幅蒸發下降
            
        simulated_level = max(10.0, level - level_drift)
        data["fluid_level_mm"] = round(simulated_level, 2)
        
        self._level_history.append((now, simulated_level))
        if len(self._level_history) > 300:
            self._level_history.pop(0)
            
        loss_data = self._estimate_fluid_loss_rate(
            total_heat_kw=tank_servers_power,
            condenser_inlet_temp=condenser_inlet_temp,
            condenser_flow_lpm=condenser_flow,
            level_history_mm=self._level_history,
            is_leak_override=is_leak
        )
        
        # 4. 過濾器壓差 \Delta P 與壽命預估
        dp = float(data.get("filter_dp_psi", 2.2))
        dp_growth = 0.0002 if dp < 14.5 else 0.0
        if override.get("clogged_filter", False):
            dp_growth = 2.1
            
        simulated_dp = min(15.0, dp + dp_growth)
        data["filter_dp_psi"] = round(simulated_dp, 2)
        
        self._dp_history.append((now, simulated_dp))
        if len(self._dp_history) > 300:
            self._dp_history.pop(0)
            
        filter_data = predict_filter_lifecycle_static(self._dp_history)
        
        # 5. 化學性質劣化與裂解
        conductivity = float(data.get("conductivity_us_cm", 0.08))
        ph_value = float(data.get("ph_value", 7.2))
        water_content = float(data.get("water_content_ppm", 8.0))
        
        if is_leak or override.get("water_intrusion", False):
            # 水氣入侵，電導率飆升，pH 下降
            conductivity = min(2.5, conductivity + 0.15)
            ph_value = max(4.0, ph_value - 0.25)
            water_content = min(200.0, water_content + 15.0)
        elif tank_servers_power > 60.0 and max_gpu_temp > 78.0:
            # 高溫熱裂解產生 HF (氫氟酸)
            conductivity = min(1.8, conductivity + 0.005)
            ph_value = max(4.8, ph_value - 0.01)
            water_content = min(40.0, water_content + 0.2)
            
        purification = "standby"
        if ph_value < 5.5 or conductivity > 1.2:
            purification = "active_full"
            conductivity = max(0.1, conductivity - 0.02)
            ph_value = min(7.0, ph_value + 0.04)
        elif ph_value < 6.5 or conductivity > 0.6:
            purification = "active_bypass"
            conductivity = max(0.1, conductivity - 0.005)
            ph_value = min(7.0, ph_value + 0.01)
            
        data["conductivity_us_cm"] = round(conductivity, 3)
        data["ph_value"] = round(ph_value, 2)
        data["water_content_ppm"] = round(water_content, 1)
        
        chem_data = self._check_chemical_degradation(conductivity, ph_value, water_content)
        
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
                    s.get("target") == self.node_id and s.get("task_type") == "Filter Replacement"
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
                        notes=f"⚠️ 閉環自癒系統自動派單：槽體壓差上升至 {filter_data['current_dp_psi']} PSI，預測壽命僅剩 {filter_data['days_remaining']} 天，已自動排程明天更換濾芯。"
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


class ImmersionCoolingService:
    """
    流體力學與化學裂解推算虛擬遙測中控服務（Facade & Factory Pattern）
    """
    def __init__(self) -> None:
        self._lock = threading.RLock()
        
        # 儲存每個槽體（單相或雙相）專屬的狀態引擎
        self._engines: Dict[str, ImmersionCoolingEngine] = {}
        
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
        攔截浸沒式槽體的 telemetry，並使用對應的物理引擎進行解耦計算。
        """
        if not ("IMM" in node_id or data.get("type") in ["immersion_single", "immersion_dual"] or "TP" in node_id):
            return

        with self._lock:
            # 判斷是否為單相冷卻系統
            is_single = "single" in node_id.lower() or "1p" in node_id.lower() or data.get("type") == "immersion_single"
            
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
