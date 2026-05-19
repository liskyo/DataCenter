from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from core.container import AppContainer
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/thermal", tags=["Predictive Thermal"])

def get_container(request: Request) -> AppContainer:
    return request.app.state.container

@router.get("/status")
def get_thermal_status(horizon: float = 0.0, container: AppContainer = Depends(get_container)):
    """取得特定預測步長下，全機房伺服器的即時/預測溫度分佈與熱點數量"""
    ts = container.thermal_service
    latest_metrics = container.telemetry.list_latest()
    
    predicted_hotspots = 0
    server_list = []
    
    with ts.lock:
        for m in latest_metrics:
            sid = m.get("server_id")
            if not sid:
                continue
            
            curr_temp = float(m.get("temperature") or 25.0)
            pred_temp = ts.predict_temperature(sid, m, horizon_minutes=horizon)
            
            # 判斷溫度層級 (正常、警告、嚴重)
            def temp_tier(t: float) -> str:
                if t > 55.0: return "critical"
                if t > 45.0: return "warning"
                return "normal"
            
            is_hotspot = pred_temp > 55.0
            if is_hotspot:
                predicted_hotspots += 1
                
            server_list.append({
                "server_id": sid,
                "gpu_model": m.get("gpu_model"),
                "current_temperature": round(curr_temp, 1),
                "predicted_temperature": round(pred_temp, 1),
                "predicted_tier": temp_tier(pred_temp),
                "power_state": m.get("power_state", "on"),
                "proactive_cooling_active": sid in ts.proactive_triggers,
                "proactive_cooling_target": ts.proactive_triggers.get(sid, 0.0)
            })
            
    return {
        "status": "ok",
        "horizon_minutes": horizon,
        "predicted_hotspots_count": predicted_hotspots,
        "servers": server_list
    }

@router.get("/predict-detail")
def get_predict_detail(server_id: str, container: AppContainer = Depends(get_container)):
    """點選單個機櫃時，取得其多軸關聯曲線（結合最近歷史軌跡與未來 120m 預測）"""
    ts = container.thermal_service
    latest_metrics = {m["server_id"]: m for m in container.telemetry.list_latest() if "server_id" in m}
    
    if server_id not in latest_metrics:
        raise HTTPException(status_code=404, detail="Server not found in telemetry")
        
    m = latest_metrics[server_id]
    
    # 獲取歷史
    history_points = []
    with ts.lock:
        hist_list = ts.history.get(server_id, [])
        for i, h in enumerate(hist_list):
            dt = datetime.fromtimestamp(h["timestamp"]).strftime("%H:%M:%S")
            history_points.append({
                "time_label": dt,
                "type": "history",
                "cpu_usage": round(h["cpu_usage"], 1),
                "temperature": round(h["temperature"], 1),
                "pump_rpm": round(h["pump_rpm"], 0),
                "coolant_inlet_temp": round(30.0 + (h["cpu_usage"]/100.0)*2.0, 1) # 模擬冷卻出水溫
            })
            
    # 如果歷史不足，用當前遙測填充基本點
    if not history_points:
        now_str = datetime.now().strftime("%H:%M:%S")
        history_points.append({
            "time_label": now_str,
            "type": "history",
            "cpu_usage": round(float(m.get("cpu_usage") or 0.0), 1),
            "temperature": round(float(m.get("temperature") or 25.0), 1),
            "pump_rpm": round(float(m.get("pump_a_rpm") or m.get("fan_speed") or 3000.0), 0),
            "coolant_inlet_temp": 30.0
        })
        
    # 計算未來預測數據 (+15m, +30m, +60m, +120m)
    prediction_horizons = [15.0, 30.0, 60.0, 120.0]
    prediction_points = []
    
    curr_cpu = float(m.get("cpu_usage") or 0.0)
    
    for h in prediction_horizons:
        pred_temp = ts.predict_temperature(server_id, m, horizon_minutes=h)
        
        # 預測下的風扇/泵浦轉速：若預測破 55°C，則預期風扇會主動拉升至 85%
        pred_pump = 5100.0 if pred_temp > 55.0 and ts.proactive_cooling_active else float(m.get("pump_a_rpm") or m.get("fan_speed") or 3000.0)
        
        prediction_points.append({
            "time_label": f"+{int(h)}m",
            "type": "prediction",
            "cpu_usage": round(curr_cpu, 1),
            "temperature": round(pred_temp, 1),
            "pump_rpm": round(pred_pump, 0),
            "coolant_inlet_temp": round(30.0 + (curr_cpu/100.0)*2.0 - (1.5 if pred_temp > 55.0 else 0.0), 1)
        })
        
    return {
        "status": "ok",
        "server_id": server_id,
        "data": history_points + prediction_points
    }
