import time
import json
import logging
import psutil
import requests
import socket
import argparse

# Config
API_URL = "http://localhost:9000/ingest"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

def get_system_metrics(server_id: str) -> dict:
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

    return {
        "server_id": server_id,
        "cpu_usage": round(cpu_usage, 2),
        "temperature": round(temperature, 2),
        "timestamp": int(time.time() * 1000)
    }

def main():
    parser = argparse.ArgumentParser(description="DataCenter In-Band Telemetry Agent")
    parser.add_argument("--server-id", type=str, default=None, help="The ID of this server (e.g. SERVER-015)")
    args = parser.parse_args()

    # 預設使用主機名稱當作 ID
    server_id = args.server_id or socket.gethostname()

    logging.info(f"Starting DataCenter Agent for Node: {server_id}")
    logging.info(f"Targeting API Endpoint: {API_URL}")
    logging.info("Press Ctrl+C to stop.")

    while True:
        try:
            payload = get_system_metrics(server_id)
            res = requests.post(API_URL, json=payload, timeout=3)
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
