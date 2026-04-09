import time
import json
import logging
import random
import psutil
import requests
import socket
import argparse

# Config
API_URL = "http://localhost:9000/ingest"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


def get_dlc_metrics() -> dict:
    """Simulate DLC/CDU liquid cooling metrics.
    
    In production, replace this with Modbus TCP reads from PLC:
    -------------------------------------------------------
    # from pymodbus.client import ModbusTcpClient
    # client = ModbusTcpClient('192.168.1.200', port=502)
    # client.connect()
    # result = client.read_holding_registers(0, 10, slave=1)
    # inlet_temp       = result.registers[0] / 10.0   # Secondary (IT Loop)
    # outlet_temp      = result.registers[1] / 10.0
    # flow_rate        = result.registers[2] / 10.0
    # pressure         = result.registers[3] / 100.0
    # pump_a_rpm       = result.registers[4]
    # pump_b_rpm       = result.registers[5]
    # valve_position   = result.registers[6]
    # reservoir_level  = result.registers[7]   # %
    # facility_supply  = result.registers[8] / 10.0  # Chiller primary loop
    # facility_return  = result.registers[9] / 10.0
    # leak_detected    = read_discrete_input(0, slave=1).bits[0]
    # client.close()
    -------------------------------------------------------
    """
    base_inlet = 22.0
    base_outlet = 38.0
    base_flow = 8.5
    base_pressure = 1.8
    base_pump_rpm = 3000

    return {
        # Secondary loop (IT side)
        "inlet_temp": round(base_inlet + random.uniform(-1.5, 3.0), 1),
        "outlet_temp": round(base_outlet + random.uniform(-2.0, 8.0), 1),
        "flow_rate_lpm": round(base_flow + random.uniform(-1.0, 1.0), 1),
        "pressure_bar": round(base_pressure + random.uniform(-0.3, 0.5), 2),
        # Dual pump status
        "pump_a_rpm": base_pump_rpm + random.randint(-200, 200),
        "pump_b_rpm": base_pump_rpm + random.randint(-200, 200),
        # Mechanical status
        "valve_position": random.randint(60, 100),
        "reservoir_level": round(random.uniform(75.0, 95.0), 1),  # % capacity
        "leak_detected": False,  # Set to True to test emergency alert
        # Primary loop (Facility/Chiller side)
        "facility_supply_temp": round(7.0 + random.uniform(-0.5, 1.0), 1),
        "facility_return_temp": round(12.0 + random.uniform(-0.5, 2.0), 1),
    }


def get_immersion_metrics() -> dict:
    """Simulate Immersion Cooling (Single/Dual phase) metrics."""
    base_temp = 32.0
    base_flow = 12.5
    base_pressure = 1.02
    
    return {
        "flow_rate_lpm": round(base_flow + random.uniform(-2.0, 2.0), 1),
        "temperature": round(base_temp + random.uniform(-1.0, 4.0), 1),
        "pressure_bar": round(base_pressure + random.uniform(-0.05, 0.1), 2),
        "coolant_level": random.randint(92, 98),  # % level
    }


def get_system_metrics(server_id: str, mode: str = "standard") -> dict:
    # 讀取真實 CPU 負載 (1秒內的平均)
    cpu_usage = psutil.cpu_percent(interval=1.0)
    
    # 嘗試讀取核心溫度 (這在某些 Windows 機器上可能讀不到，會回傳空字典，在此提供備用方案)
    try:
        temps = psutil.sensors_temperatures()
        if temps and 'coretemp' in temps:
            temperature = temps['coretemp'][0].current
        else:
            # 如果讀不到硬體溫度感測器，根據 CPU 負載來估算一個假溫度以供展示
            temperature = 35.0 + (cpu_usage * 0.4)
    except Exception:
        temperature = 35.0 + (cpu_usage * 0.4)

    payload = {
        "server_id": server_id,
        "cpu_usage": round(cpu_usage, 2),
        "temperature": round(temperature, 2),
        "timestamp": int(time.time() * 1000)
    }

    # DLC 液冷模式: 附加冷卻系統遙測數據
    if mode == "dlc":
        payload.update(get_dlc_metrics())
    elif mode == "immersion":
        payload.update(get_immersion_metrics())

    return payload

def install_autostart(server_id: str):
    import os
    import sys
    import platform
    
    if platform.system() == "Windows":
        import winreg
        key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
        exe_path = sys.executable
        script_path = os.path.abspath(__file__)
        # 組合啟動指令，並且讓它在背景執行 (這裡先用最簡單的做法)
        command = f'"{exe_path}" "{script_path}" --server-id {server_id}'
        
        try:
            key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_SET_VALUE)
            winreg.SetValueEx(key, f"DataCenterAgent_{server_id}", 0, winreg.REG_SZ, command)
            winreg.CloseKey(key)
            logging.info(f"✅ 成功寫入 Windows 登錄檔！下次開機將自動啟動 {server_id} 的 Agent。")
        except Exception as e:
            logging.error(f"❌ 寫入登錄檔失敗: {e}")
    else:
        logging.warning("目前 --install 功能僅實作 Windows 系統的自動啟動設定。")

def main():
    parser = argparse.ArgumentParser(description="DataCenter In-Band Telemetry Agent")
    parser.add_argument("--server-id", type=str, default=None, help="The ID of this server (e.g. SERVER-015)")
    parser.add_argument("--mode", type=str, default="standard", choices=["standard", "dlc", "immersion"], help="Telemetry mode: standard, dlc, or immersion")
    parser.add_argument("--api-key", type=str, default="dc-agent-key-2026", help="API key for authentication")
    parser.add_argument("--install", action="store_true", help="Register script to auto-start on boot (Windows)")
    args = parser.parse_args()

    # 預設使用主機名稱當作 ID
    server_id = args.server_id or socket.gethostname()

    if args.install:
        install_autostart(server_id)
        return

    logging.info(f"Starting DataCenter Agent for Node: {server_id}")
    logging.info(f"Mode: {args.mode.upper()} | Targeting API Endpoint: {API_URL}")
    if args.mode == "dlc":
        logging.info("DLC Mode: Liquid cooling metrics (inlet/outlet temp, flow, pressure) enabled.")
    logging.info("Press Ctrl+C to stop.")

    while True:
        try:
            payload = get_system_metrics(server_id, mode=args.mode)
            headers = {"Content-Type": "application/json"}
            if args.api_key:
                headers["X-API-Key"] = args.api_key
            res = requests.post(API_URL, json=payload, headers=headers, timeout=3)
            res.raise_for_status()
            logging.info(f"Pushed Metrics -> CPU: {payload['cpu_usage']}% | Temp: {payload['temperature']}°C")
        except requests.exceptions.RequestException as e:
            logging.error(f"Failed to push metrics to API: {e}")
        except KeyboardInterrupt:
            logging.info("Agent stopped by user.")
            break
        except Exception as e:
            logging.error(f"Unexpected error: {e}")

        # 每 3 秒採樣一次
        time.sleep(2)

if __name__ == "__main__":
    main()
