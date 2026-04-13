from __future__ import annotations
import time
from fastapi import APIRouter, Request, HTTPException

from core.container import AppContainer

# 如果未來有真實硬體，可以在這裡安裝並引入 Redfish 函式庫
# import requests
# import redfish

router = APIRouter(prefix="/api/control")

# --- Safety Interlock Definitions ---
INTERLOCKS = [
    {
        "field": "temperature",
        "condition": lambda v: v > 70,
        "message": "CPU temperature exceeds 70°C safety limit. Power-on is locked to prevent hardware damage.",
        "block_actions": ["on", "reboot"],
    },
    {
        "field": "outlet_temp",
        "condition": lambda v: v > 60,
        "message": "DLC outlet temperature exceeds 60°C. All control actions are locked.",
        "block_actions": ["on", "off", "reboot"],
    },
    {
        "field": "flow_rate_lpm",
        "condition": lambda v: v < 2.0,
        "message": "Coolant flow rate critically low (<2.0 LPM). Power-on is locked to prevent thermal runaway.",
        "block_actions": ["on", "reboot"],
    },
    {
        "field": "pressure_bar",
        "condition": lambda v: v > 4.0,
        "message": "System pressure exceeds 4.0 bar safety limit. All pump/power operations are locked.",
        "block_actions": ["on", "off", "reboot"],
    },
    {
        "field": "dlc_alert",
        "condition": lambda v: v == "Leak Detected",
        "message": "LEAK DETECTED! All control actions are emergency-locked.",
        "block_actions": ["on", "off", "reboot"],
    },
]


def _container(request: Request) -> AppContainer:
    return request.app.state.container


def check_interlocks(container: AppContainer, server_id: str, action: str) -> str | None:
    """Check all interlock rules against latest telemetry. Returns error message or None if safe."""
    latest = container.telemetry.latest_metrics.get(server_id)
    if not latest:
        return None  # No telemetry data yet — allow action (first boot scenario)

    for rule in INTERLOCKS:
        if action not in rule["block_actions"]:
            continue
        value = latest.get(rule["field"])
        if value is not None:
            try:
                if rule["condition"](float(value) if isinstance(value, (int, float)) else value):
                    return rule["message"]
            except (ValueError, TypeError):
                pass
    return None


@router.post("/{server_id}/power")
def control_power(request: Request, server_id: str, payload: dict):
    # payload: {"action": "on" | "off" | "reboot"}
    action = payload.get("action", "").lower()
    
    if action not in ["on", "off", "reboot"]:
        raise HTTPException(status_code=400, detail="Invalid action")

    # --- Safety Interlock Check ---
    container = _container(request)
    _, resolved_server_id = container.resolve_ids({"server_id": server_id})
    interlock_reason = check_interlocks(container, resolved_server_id, action)
    if interlock_reason:
        raise HTTPException(
            status_code=423,
            detail={
                "locked": True,
                "server_id": resolved_server_id,
                "action_requested": action,
                "interlock_reason": interlock_reason,
            },
        )

    # 模擬與實體伺服器 (BMC) 溝通需要的時間
    time.sleep(1.5)

    # 更新全域電源狀態 (持久化於記憶體)
    if action in ["on", "off"]:
        container.power_states[resolved_server_id] = action
    elif action == "reboot":
        container.power_states[resolved_server_id] = "on"

    """
    ===================================================================
    未來真實環境 (Real Hardware Integration)
    ===================================================================
    # 假設從資料庫取得該伺服器的 BMC_IP, username, password
    bmc_ip = "192.168.1.100"  # 從 DB 取
    
    # 1. Redfish API (Gigabyte AST2600 / Dell iDRAC / HPE iLO)
    reset_type = "On" if action == "on" else ("ForceOff" if action == "off" else "ForceRestart")
    url = f"https://{bmc_ip}/redfish/v1/Systems/Self/Actions/ComputerSystem.Reset"
    # res = requests.post(url, json={"ResetType": reset_type}, auth=(username, password), verify=False)
    
    # 2. 或是使用 IPMI (pyghmi)
    # ipmicmd = Command(bmc=bmc_ip, userid=username, password=password)
    # ipmicmd.set_power(...)
    ===================================================================
    """

    # 回報假的成功狀態
    return {
        "status": "success", 
        "server_id": resolved_server_id,
        "action_executed": action,
        "message": f"Hardware command '{action}' triggered via Redfish API stub."
    }

