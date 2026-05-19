from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from core.container import AppContainer

router = APIRouter(prefix="/api/power", tags=["Power Capping"])

# --- Request Schemas ---
class PowerConfigSchema(BaseModel):
    grid_limit_kw: Optional[float] = None
    safety_margin: Optional[float] = None
    carbon_coefficient: Optional[float] = None
    capping_active: Optional[bool] = None

class EmergencySchema(BaseModel):
    active: bool

class BatchPolicySchema(BaseModel):
    server_ids: List[str]
    priority: Optional[str] = None
    cap_value: Optional[float] = None

# --- Dependency ---
def get_container(request: Request) -> AppContainer:
    return request.app.state.container

@router.get("/status")
def get_power_status(container: AppContainer = Depends(get_container)):
    """取得電力與碳排核心遙測指標及時序軌跡"""
    try:
        ps = container.power_service
        timeline = ps.power_timeline
        
        # 計算當前總 IT 電力 (只計處於 ON 狀態者)
        latest_metrics = container.telemetry.list_latest()
        total_it_kw = sum(float(m.get("power_kw") or 0.0) for m in latest_metrics if m.get("server_id") and m.get("power_state") != "off")
        
        # 冷卻與廠務基礎功耗 (包含 CDU、CRAC)
        facility_base = 35.0  # 模擬固定 35kW
        total_power = total_it_kw + facility_base
        
        # 被限電設備數量
        capped_count = sum(1 for p in ps.server_policies.values() if p["capped"])
        
        return {
            "status": "ok",
            "grid_limit_kw": ps.grid_limit_kw,
            "safety_margin": ps.safety_margin,
            "carbon_coefficient": ps.carbon_coefficient,
            "cumulative_carbon_kg": ps.cumulative_carbon_kg,
            "capping_active": ps.capping_active,
            "grid_emergency_active": ps.grid_emergency_active,
            "total_power_kw": total_power,
            "it_power_kw": total_it_kw,
            "facility_power_kw": facility_base,
            "capped_device_count": capped_count,
            "total_device_count": len(ps.server_policies),
            "timeline": timeline
        }
    except Exception as e:
        import traceback
        with open("error.log", "w", encoding="utf-8") as f:
            f.write(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/servers")
def get_power_servers(container: AppContainer = Depends(get_container)):
    """取得所有伺服器的優先級與電力限制原則"""
    ps = container.power_service
    # 結合 telemetry 中的 active 資訊
    latest_metrics = {m["server_id"]: m for m in container.telemetry.list_latest() if "server_id" in m}
    
    result = []
    with ps.lock:
        for sid, p in ps.server_policies.items():
            metric = latest_metrics.get(sid, {})
            power_state = metric.get("power_state", "on")
            power_kw = metric.get("power_kw")
            if power_kw is None:
                power_kw = 0.0 if power_state == "off" else p.get("cap_value", p.get("max_cap", 1.5))
            
            result.append({
                **p,
                "power_state": power_state,
                "power_kw": float(power_kw),
                "cpu_usage": metric.get("cpu_usage", 0.0),
                "flops": metric.get("flops", 0.0)
            })
    return {"status": "ok", "servers": result}

@router.post("/config")
def update_power_config(config: PowerConfigSchema, container: AppContainer = Depends(get_container)):
    """更新全域電力限制參數"""
    ps = container.power_service
    with ps.lock:
        if config.grid_limit_kw is not None:
            ps.grid_limit_kw = config.grid_limit_kw
        if config.safety_margin is not None:
            ps.safety_margin = config.safety_margin
        if config.carbon_coefficient is not None:
            ps.carbon_coefficient = config.carbon_coefficient
        if config.capping_active is not None:
            ps.capping_active = config.capping_active
            
    return {"status": "ok", "message": "Power configuration updated successfully"}

@router.post("/emergency")
def trigger_grid_emergency(emergency: EmergencySchema, container: AppContainer = Depends(get_container)):
    """一鍵觸發或關閉電網限電緊急危機 (COMPUTEX 展場展示用)"""
    ps = container.power_service
    new_limit = ps.toggle_emergency(emergency.active)
    
    msg = f"Grid emergency triggered. Contract limit slashed to {new_limit}kW." if emergency.active else "Grid emergency resolved."
    container.log_system_event("POWER_GRID", "EMERGENCY_Surge" if emergency.active else "EMERGENCY_RESOLVED", msg)
    
    return {
        "status": "ok",
        "grid_emergency_active": ps.grid_emergency_active,
        "grid_limit_kw": new_limit
    }

@router.post("/batch-policy")
def apply_batch_policy(policy: BatchPolicySchema, container: AppContainer = Depends(get_container)):
    """批次設定所選伺服器的運行優先級與功耗限制值 (對接 Redfish 指令模擬)"""
    ps = container.power_service
    updated = []
    for sid in policy.server_ids:
        try:
            p = ps.update_server_policy(sid, priority=policy.priority, cap_value=policy.cap_value)
            updated.append(p)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to update server {sid}: {str(e)}")
            
    container.log_system_event(
        "POWER_MGMT", 
        "POLICY_BATCH_UPDATE", 
        f"Applied policy to {len(policy.server_ids)} servers. Priority={policy.priority}, Cap={policy.cap_value}kW"
    )
    return {"status": "ok", "updated_count": len(updated)}
