from __future__ import annotations
import time
from fastapi import APIRouter, Request, HTTPException

# 如果未來有真實硬體，可以在這裡安裝並引入 Redfish 函式庫
# import requests
# import redfish

router = APIRouter(prefix="/api/control")

@router.post("/{server_id}/power")
def control_power(request: Request, server_id: str, payload: dict):
    # payload: {"action": "on" | "off" | "reboot"}
    action = payload.get("action", "").lower()
    
    if action not in ["on", "off", "reboot"]:
        raise HTTPException(status_code=400, detail="Invalid action")

    # 模擬與實體伺服器 (BMC) 溝通需要的時間
    time.sleep(1.5)

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
        "server_id": server_id,
        "action_executed": action,
        "message": f"Hardware command '{action}' triggered via Redfish API stub."
    }
