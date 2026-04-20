import time
import json
import random
import requests

# 與專案 start.bat 預設之 uvicorn 埠一致（可自行改成實際 API 位址）
API_URL = "http://127.0.0.1:9000/ingest"

# 模擬設備
servers = [f"SERVER-{i:03d}" for i in range(1, 13)]
switches = [f"SW-{i:03d}" for i in range(1, 13)]
all_devices = servers + switches

def generate_telemetry():
    device_id = random.choice(all_devices)
    
    if device_id.startswith("SW-"):
        # 模擬 Switch 流量与端口
        traffic = round(random.uniform(0.5, 35.0), 2)
        ports_active = random.randint(10, 48)
        return {
            "server_id": device_id,
            "traffic_gbps": traffic,
            "ports_active": ports_active,
            "ports_total": 48,
            "timestamp": int(time.time() * 1000)
        }
    else:
        # 模擬 CPU 負載 (10% ~ 95%)
        cpu_usage = round(random.uniform(10.0, 95.0), 2)
        # 模擬溫度 (機房基礎 20度 + CPU負載造成的熱量)
        temperature = round(20.0 + (cpu_usage * 0.3) + random.uniform(-1, 2), 2)
        
        return {
            "server_id": device_id,
            "cpu_usage": cpu_usage,
            "temperature": temperature,
            "timestamp": int(time.time() * 1000)
        }

if __name__ == "__main__":
    print(f"啟動 DataCenter 設備模擬器，寫入目標: {API_URL}")
    print("Press Ctrl+C to stop.")
    
    while True:
        payload = generate_telemetry()
        try:
            res = requests.post(API_URL, json=payload, timeout=2)
            print(f"[{res.status_code}] 發送 -> {payload['server_id']} | CPU: {payload['cpu_usage']}% | Temp: {payload['temperature']}°C")
        except requests.exceptions.RequestException as e:
            print(f"[ Error ] API 連線失敗: {e}")
            
        # 每 1 ~ 3 秒產生一筆數據
        time.sleep(random.uniform(1.0, 3.0))
