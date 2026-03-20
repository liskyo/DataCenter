import time
import json
import random
import requests

API_URL = "http://localhost:8000/ingest"

# 模擬 10 台伺服器
servers = [f"SERVER-{i:03d}" for i in range(1, 11)]

def generate_telemetry():
    server_id = random.choice(servers)
    
    # 模擬 CPU 負載 (10% ~ 95%)
    cpu_usage = round(random.uniform(10.0, 95.0), 2)
    
    # 模擬溫度 (機房基礎 20度 + CPU負載造成的熱量)
    temperature = round(20.0 + (cpu_usage * 0.3) + random.uniform(-1, 2), 2)
    
    return {
        "server_id": server_id,
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
