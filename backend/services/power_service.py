from __future__ import annotations

import time
import random
import threading
from typing import Dict, List, Any

class PowerCappingService:
    """電力限制與碳排管理系統 (DPC-CT) 背景引擎"""

    def __init__(self):
        # 核心設定與狀態
        self.grid_limit_kw = 800.0            # 契約用電容量 (kW) (調高至 800kW 以完美包容 570 台伺服器大軍)
        self.safety_margin = 0.95             # 安全警戒係數 (95%)
        self.carbon_coefficient = 0.495       # 台灣電力排碳係數 (kg CO2e/kWh)
        self.cumulative_carbon_kg = 124.5     # 累計排碳量 (kg)
        self.capping_active = True           # 是否啟動自動電力限制引擎
        
        # 設備電力控制表 { server_id: { "priority": "critical"|"normal"|"background", "cap_value": float, "min_cap": float, "max_cap": float } }
        self.server_policies: Dict[str, Dict[str, Any]] = {}
        self.lock = threading.RLock()
        
        # 模擬事件：電網緊急事件 (Grid Emergency) 狀態
        self.grid_emergency_active = False
        self.original_grid_limit = 800.0
        
        # 歷史軌跡 (保留最近 60 筆)
        self.power_timeline: List[Dict[str, Any]] = []

    def register_server_if_absent(self, server_id: str, gpu_model: str | None, current_power: float) -> None:
        """根據伺服器類型 (是否有 GPU) 自動分配優先級與硬體物理極限值"""
        with self.lock:
            if server_id in self.server_policies:
                return
                
            # 判斷是否為 GPU 伺服器
            is_gpu = gpu_model is not None and len(gpu_model.strip()) > 0
            
            if is_gpu:
                # 高端 GPU 伺服器 (如 H100sxm)，滿載 8.0 kW，硬體能耗底線為 3.0 kW
                priority = "critical" if "GB200" in gpu_model or "H200" in gpu_model or "H100" in gpu_model else "normal"
                self.server_policies[server_id] = {
                    "server_id": server_id,
                    "gpu_model": gpu_model,
                    "priority": priority,
                    "max_cap": 8.0,
                    "min_cap": 3.0,
                    "cap_value": 8.0,
                    "capped": False
                }
            else:
                # 普通 CPU 伺服器，滿載 1.5 kW，硬體底線為 0.6 kW
                self.server_policies[server_id] = {
                    "server_id": server_id,
                    "gpu_model": None,
                    "priority": "background" if random.random() > 0.4 else "normal",
                    "max_cap": 1.5,
                    "min_cap": 0.6,
                    "cap_value": 1.5,
                    "capped": False
                }

    def update_server_policy(self, server_id: str, priority: str | None = None, cap_value: float | None = None) -> Dict[str, Any]:
        """手動更新單台或批次伺服器的原則"""
        with self.lock:
            if server_id not in self.server_policies:
                self.server_policies[server_id] = {
                    "server_id": server_id,
                    "gpu_model": None,
                    "priority": "normal",
                    "max_cap": 1.5,
                    "min_cap": 0.6,
                    "cap_value": 1.5,
                    "capped": False
                }
            
            policy = self.server_policies[server_id]
            if priority in ["critical", "normal", "background"]:
                policy["priority"] = priority
            if cap_value is not None:
                # 限制在硬體物理極限區間
                policy["cap_value"] = max(policy["min_cap"], min(policy["max_cap"], cap_value))
                # 如果小於最大值，代表已啟動手動限制
                policy["capped"] = policy["cap_value"] < policy["max_cap"]
                
            return policy

    def toggle_emergency(self, active: bool) -> float:
        """觸發電網緊急事件，大幅調降契約容量展示限電自癒"""
        with self.lock:
            self.grid_emergency_active = active
            if active:
                self.original_grid_limit = self.grid_limit_kw
                # 當有 570 台大規模伺服器上線時 (800kW)，砍至 300kW 限額；若為少數伺服器，則砍至 50kW
                if self.original_grid_limit > 500.0:
                    self.grid_limit_kw = 300.0
                else:
                    self.grid_limit_kw = 50.0
            else:
                self.grid_limit_kw = self.original_grid_limit
            return self.grid_limit_kw

    def apply_capping_logic(self, current_servers: List[Dict[str, Any]], facility_base_power: float) -> List[Dict[str, Any]]:
        """
        每秒被主控制循環呼叫：
        1. 統計當前總耗電。
        2. 若超出契約安全水位且 capping_active=True，實施閉環電力扣減。
        3. 計算碳排放。
        """
        with self.lock:
            # 確保所有伺服器已註冊至原則表
            for s in current_servers:
                sid = s.get("server_id")
                gpu = s.get("gpu_model")
                # 計算該伺服器的模擬功耗 (若無則根據 gpu 隨機)
                default_p = 8.0 if gpu else 1.5
                self.register_server_if_absent(sid, gpu, default_p)

            # 計算當前總 IT 功率
            total_it_kw = 0.0
            server_map = {s["server_id"]: s for s in current_servers}
            
            for sid, policy in self.server_policies.items():
                if sid in server_map:
                    # 伺服器在線上且未關機
                    if server_map[sid].get("power_state") != "off":
                        # 計算該伺服器滿載功耗 (依 CPU 使用率與 GPU 計算)
                        cpu = server_map[sid].get("cpu_usage", 0.0)
                        max_p = policy["max_cap"]
                        min_p = policy["min_cap"]
                        # 基礎未限電下的功耗
                        base_p = min_p + (max_p - min_p) * (cpu / 100.0)
                        
                        # 套用當前的 Power Cap
                        effective_p = min(base_p, policy["cap_value"])
                        server_map[sid]["power_kw"] = effective_p
                        
                        # 若被限制了，等比例調降 cpu 與效能展示
                        if policy["capped"] or effective_p < base_p:
                            policy["capped"] = True
                            server_map[sid]["power_capped"] = True
                            # 算力打折 (隨功耗限制等比例下降)
                            ratio = effective_p / max_p
                            if "flops" in server_map[sid]:
                                server_map[sid]["flops"] = server_map[sid]["flops"] * ratio
                        else:
                            server_map[sid]["power_capped"] = False
                            
                        total_it_kw += effective_p
                    else:
                        server_map[sid]["power_kw"] = 0.0
                        server_map[sid]["power_capped"] = False
            
            # 總耗電 (包含 IT 與冷卻廠務等基礎功耗)
            total_power_kw = total_it_kw + facility_base_power
            threshold = self.grid_limit_kw * self.safety_margin
            
            # --- 閉環控制：超額調度邏輯 ---
            if self.capping_active and total_power_kw > threshold:
                deficit = total_power_kw - threshold
                
                # 按照優先權從低到高：background -> normal -> critical 逐步限制
                for tier in ["background", "normal"]:
                    tier_policies = [p for p in self.server_policies.values() if p["priority"] == tier and not p["capped"]]
                    
                    for p in tier_policies:
                        if deficit <= 0:
                            break
                        # 將此伺服器限制到最低硬體底線
                        current_cap = p["cap_value"]
                        min_c = p["min_cap"]
                        if current_cap > min_c:
                            reduction = current_cap - min_c
                            p["cap_value"] = min_c
                            p["capped"] = True
                            deficit -= reduction
                            
                            # 即時反應在當前 server payload
                            if p["server_id"] in server_map:
                                server_map[p["server_id"]]["power_kw"] = min_c
                                server_map[p["server_id"]]["power_capped"] = True
                                if "flops" in server_map[p["server_id"]]:
                                    server_map[p["server_id"]]["flops"] = server_map[p["server_id"]]["flops"] * (min_c / p["max_cap"])
                                    
            elif self.capping_active and total_power_kw < (threshold * 0.85):
                # 電力十分充裕，逐步恢復 (Uncap) 釋放算力
                for tier in ["normal", "background"]:
                    capped_policies = [p for p in self.server_policies.values() if p["priority"] == tier and p["capped"]]
                    for p in capped_policies:
                        p["cap_value"] = p["max_cap"]
                        p["capped"] = False
                        if p["server_id"] in server_map:
                            server_map[p["server_id"]]["power_capped"] = False

            # --- 碳排與累積計算 ---
            # 碳排速率 (kg/h) = 總電力 kW * 係數
            carbon_rate_kgh = total_power_kw * self.carbon_coefficient
            # 累加 (每秒呼叫，故 /3600)
            self.cumulative_carbon_kg += (carbon_rate_kgh / 3600.0)
            
            # 寫入歷史時序
            now_label = time.strftime("%H:%M:%S")
            self.power_timeline.append({
                "time_label": now_label,
                "total_power_kw": total_power_kw,
                "it_power_kw": total_it_kw,
                "facility_power_kw": facility_base_power,
                "grid_limit": self.grid_limit_kw,
                "carbon_rate": carbon_rate_kgh,
                "capped_count": sum(1 for p in self.server_policies.values() if p["capped"])
            })
            if len(self.power_timeline) > 60:
                self.power_timeline.pop(0)

            return current_servers
