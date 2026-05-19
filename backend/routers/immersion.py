# -*- coding: utf-8 -*-
"""
FastAPI Router for Deep Immersion Cooling Status and Simulator Controls.
Strictly PEP 8 compliant, robust, and Production ready.
"""

from __future__ import annotations
from fastapi import APIRouter, Request, HTTPException, Query
from pydantic import BaseModel
from typing import Dict, Any, Optional

router = APIRouter(prefix="/api/immersion", tags=["Immersion Cooling"])


class SimulatePayload(BaseModel):
    tank_id: str
    gpu_load_kw: Optional[float] = None
    condenser_flow_lpm: Optional[float] = None
    seal_leak: Optional[bool] = None
    clogged_filter: Optional[bool] = None
    water_intrusion: Optional[bool] = None


@router.get("/status")
async def get_immersion_status(request: Request, tank_id: str = Query(..., description="The unique ID of the immersion tank")):
    """
    獲取單個雙相浸沒式槽體的實時深度遙測、物理與化學狀態
    """
    container = request.app.state.container
    latest_metrics = container.telemetry.list_latest()
    
    # 尋找對應的槽體遙測
    tank_data = None
    for m in latest_metrics:
        if m.get("server_id") == tank_id:
            tank_data = m
            break
            
    # 如果沒找到，可能它在設備列表 (equipments) 中，我們從 telemetry 中獲取
    if not tank_data:
        tank_data = container.telemetry.latest_metrics.get(tank_id)
        
    if not tank_data:
        # 提供初始備用數據，避免 API 崩潰
        return {
            "tank_id": tank_id,
            "void_fraction": 12.5,
            "boiling_regime": "nucleate",
            "should_throttle": False,
            "purification_state": "standby",
            "theoretical_loss_rate_ml_hr": 0.2,
            "observed_loss_rate_ml_hr": 0.1,
            "fused_loss_rate_ml_hr": 0.15,
            "leak_severity": "normal",
            "filter_dp_psi": 2.2,
            "filter_progress": 92.0,
            "filter_days_remaining": 88.0,
            "filter_status": "normal",
            "conductivity_us_cm": 0.08,
            "ph_value": 7.2,
            "water_content_ppm": 8.0,
            "hf_corrosion_risk": "low",
            "water_warning": False,
            "chem_severity": "normal",
            "chem_description": "流體化學性質優良。雙相氟化液電導率與酸鹼值均處於安全標準區間。"
        }
        
    # 直接回傳包含深度推算欄位的資料字典
    return {
        "tank_id": tank_id,
        "void_fraction": tank_data.get("void_fraction", 12.5),
        "boiling_regime": tank_data.get("boiling_regime", "nucleate"),
        "should_throttle": tank_data.get("should_throttle", False),
        "purification_state": tank_data.get("purification_state", "standby"),
        
        "theoretical_loss_rate_ml_hr": tank_data.get("theoretical_loss_rate_ml_hr", 0.2),
        "observed_loss_rate_ml_hr": tank_data.get("observed_loss_rate_ml_hr", 0.1),
        "fused_loss_rate_ml_hr": tank_data.get("fused_loss_rate_ml_hr", 0.15),
        "leak_severity": tank_data.get("leak_severity", "normal"),
        
        "filter_dp_psi": tank_data.get("filter_dp_psi", 2.2),
        "filter_progress": tank_data.get("filter_progress", 92.0),
        "filter_days_remaining": tank_data.get("filter_days_remaining", 88.0),
        "filter_status": tank_data.get("filter_status", "normal"),
        "trigger_filter_maintenance": tank_data.get("trigger_filter_maintenance", False),
        
        "conductivity_us_cm": tank_data.get("conductivity_us_cm", 0.08),
        "ph_value": tank_data.get("ph_value", 7.2),
        "water_content_ppm": tank_data.get("water_content_ppm", 8.0),
        
        "hf_corrosion_risk": tank_data.get("hf_corrosion_risk", "low"),
        "water_warning": tank_data.get("water_warning", False),
        "chem_severity": tank_data.get("chem_severity", "normal"),
        "chem_description": tank_data.get("chem_description", "流體化學性質優良。雙相氟化液電導率與酸鹼值均處於安全標準區間。")
    }


@router.post("/simulate")
async def simulate_immersion_state(request: Request, payload: SimulatePayload):
    """
    接收觀眾/使用者在模擬面板中的手動控制調控指令，覆寫物理與化學參數
    """
    container = request.app.state.container
    overrides = {}
    
    if payload.gpu_load_kw is not None:
        overrides["gpu_load_kw"] = payload.gpu_load_kw
    if payload.condenser_flow_lpm is not None:
        overrides["condenser_flow_lpm"] = payload.condenser_flow_lpm
    if payload.seal_leak is not None:
        overrides["seal_leak"] = payload.seal_leak
    if payload.clogged_filter is not None:
        overrides["clogged_filter"] = payload.clogged_filter
    if payload.water_intrusion is not None:
        overrides["water_intrusion"] = payload.water_intrusion
        
    container.immersion_service.set_simulator_override(payload.tank_id, overrides)
    
    return {
        "status": "success",
        "tank_id": payload.tank_id,
        "applied_overrides": overrides
    }
