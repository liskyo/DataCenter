from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from kafka import KafkaProducer, KafkaConsumer
from influxdb_client import InfluxDBClient, Point, WriteOptions
from influxdb_client.client.write_api import ASYNCHRONOUS
from pymongo import MongoClient
import json
import time
import threading

app = FastAPI(title="DataCenter Monitoring API")

# 允許前端跨域請求
from fastapi.middleware.gzip import GZipMiddleware

# 啟動 GZip 壓縮，大幅提升 JSON 傳輸效能
app.add_middleware(GZipMiddleware, minimum_size=1000)

# 允許前端跨域請求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# [1] Kafka Config
KAFKA_BROKER = "localhost:29092"
TOPIC = "telemetry"
producer = None

# [2] InfluxDB Config (時序資料庫)
INFLUX_URL = "http://localhost:8086"
INFLUX_TOKEN = "adminpassword"
INFLUX_ORG = "datacenter"
INFLUX_BUCKET = "telemetry"
influx_client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
write_api = influx_client.write_api(write_options=ASYNCHRONOUS)

# [3] MongoDB Config (應用資料庫: 儲存告警與狀態)
MONGO_URI = "mongodb://admin:adminpassword@localhost:27017/"
mongo_client = None
alerts_collection = None

def init_mongo():
    global mongo_client, alerts_collection
    try:
        mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=2000)
        db = mongo_client["datacenter"]
        alerts_collection = db["alerts"]
        
        # 建立 Index 以預防海量歷史資料造成的記憶體排序效能瓶頸
        alerts_collection.create_index([("timestamp", -1)])
        print("MongoDB connected and index created...")
    except Exception as e:
        print(f"MongoDB connection failed: {e}")

# 記憶體快取 (供前端即時 Dashboard 讀取使用)
latest_metrics = {}
server_history = {} # 供 AI 異常檢測紀錄歷史: server_id -> list of (temp, cpu)

# ==========================================
# 告警發布系統 (Alert System)
# ==========================================
def trigger_alert(server_id, msg_type, message):
    alert_doc = {
        "server_id": server_id,
        "type": msg_type,
        "message": message,
        "timestamp": int(time.time() * 1000)
    }
    # 1. 寫入 MongoDB 備查
    if alerts_collection is not None:
        try:
            alerts_collection.insert_one(alert_doc)
        except: pass
        
    # 2. 模擬發送 Discord / Slack / 郵件 網路請求
    # requests.post("https://discord.com/api/webhooks/...", json={"content": message})
    print(f"🚨 [API Webhook 發送中 -> Discord/Slack/Email] ⚠️ {msg_type} FOR {server_id}: {message}")


# ==========================================
# AI 異常檢測邏輯 (Anomaly Detection)
# ==========================================
def detect_anomaly(server_id, cpu, temp):
    """
    簡單的異常檢測腳本 (例如: 若數值發生不合理的暴漲)
    這裡使用『移動平均對比』作為示範基準。
    """
    if server_id not in server_history:
        server_history[server_id] = []
    
    history = server_history[server_id]
    history.append((temp, cpu))
    
    # 保持最近 5 筆作為 Window Size
    if len(history) > 5:
        history.pop(0)
        
    if len(history) < 3:
        return False, "Not enough data"
        
    # 計算前幾筆的歷史平均 (不含最新一筆)
    avg_cpu = sum(x[1] for x in history[:-1]) / (len(history) - 1)
    
    # AI 檢測門檻: 如果 CPU 瞬間飆升超過歷史平均的 1.5 倍，且目前大於 60%
    if cpu > 60 and cpu > (avg_cpu * 1.5):
        return True, f"CPU Anomaly Spike Detected! (Historical Avg: {avg_cpu:.1f}%, Sudden Jump to: {cpu:.1f}%)"
        
    return False, "Normal"


@app.post("/ingest")
async def ingest_telemetry(payload: dict):
    global producer
    if not producer:
        return {"status": "error", "message": "Kafka is not ready yet"}
    producer.send(TOPIC, value=payload)
    producer.flush()
    return {"status": "event queued"}

@app.get("/metrics")
def get_metrics():
    # 回傳給前端即時狀態
    return {"data": list(latest_metrics.values())}

@app.get("/alerts")
def get_alerts(limit: int = 50):
    # 回傳給 /logs 頁面 MongoDB 儲存的歷史告警，最新的在前
    if alerts_collection is None:
        return {"data": []}
    
    cursor = alerts_collection.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit)
    return {"data": list(cursor)}

@app.get("/history")
def get_history():
    # 回傳給 /analysis 頁面 AI 異常檢測所追蹤的歷史時序資料
    return {"data": server_history}

def kafka_consumer_worker():
    import uuid
    import traceback
    
    while True:
        try:
            consumer = KafkaConsumer(
                TOPIC,
                bootstrap_servers=[KAFKA_BROKER],
                group_id='influx_writer_group_persistent',
                auto_offset_reset='latest',
                value_deserializer=lambda m: json.loads(m.decode('utf-8'))
            )
            print("Kafka Consumer started and polling...")
            for msg in consumer:
                try:
                    data = msg.value
                    server_id = data.get("server_id", "unknown")
                    temp = float(data.get("temperature", 0))
                    cpu = float(data.get("cpu_usage", 0))
                    
                    # 1. 執行固定閾值告警 (Rule-based)
                    if temp > 40:
                        trigger_alert(server_id, "HIGH_TEMPERATURE", f"溫度超過警戒值! 目前溫度: {temp:.1f}°C")
                        data["alert"] = "High Temp"
                        
                    # 2. 執行 AI 異常檢測 (Anomaly Detection)
                    is_anomaly, reason = detect_anomaly(server_id, cpu, temp)
                    if is_anomaly:
                        trigger_alert(server_id, "AI_ANOMALY", reason)
                        data["anomaly"] = reason
                    
                    # 更新最新狀態到快取供前端 Dashboard 使用
                    latest_metrics[server_id] = data
                    
                    # 3. 將資料寫入 InfluxDB
                    point = Point("server_metrics") \
                        .tag("server_id", server_id) \
                        .field("temperature", temp) \
                        .field("cpu_usage", cpu)
                    write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=point)
                except Exception as e:
                    print(f"Error processing message: {e}")
        except Exception as e:
            print(f"Kafka Consumer crashed (likely Windows socket issue): {e}. Reconnecting...")
            time.sleep(3)

def init_kafka_producer():
    global producer
    while not producer:
        try:
            producer = KafkaProducer(
                bootstrap_servers=[KAFKA_BROKER],
                value_serializer=lambda v: json.dumps(v).encode('utf-8')
            )
            print("Kafka Producer connected...")
        except Exception as e:
            time.sleep(3)

import random

# System Mode
system_mode = "simulation"

@app.get("/api/system/mode")
def get_system_mode():
    return {"mode": system_mode}

@app.post("/api/system/mode")
def toggle_system_mode(payload: dict):
    global system_mode, latest_metrics
    mode = payload.get("mode")
    if mode in ["simulation", "real"]:
        if mode != system_mode:
            latest_metrics.clear()
        system_mode = mode
    return {"status": "success", "mode": system_mode}

def simulation_worker():
    global producer
    servers = [f"SERVER-{str(i).zfill(3)}" for i in range(1, 13)]
    switches = [f"SW-{str(i).zfill(3)}" for i in range(1, 13)]
    all_ids = servers + switches
    
    base_metrics = { s_id: {"temp": random.uniform(20, 25), "cpu": random.uniform(10, 30), "traffic": random.uniform(2, 10)} for s_id in all_ids }
    
    active_critical = None
    active_warning = None
    loops = 0

    while True:
        if system_mode == "simulation" and producer:
            try:
                # 每 1 分鐘重新抽籤：一台變紅 (Critical)，一台變黃 (Warning)
                if loops % 12 == 0:
                    sampled = random.sample(all_ids, 2)
                    active_critical = sampled[0]
                    active_warning = sampled[1]
                loops += 1

                for s_id in all_ids:
                    base = base_metrics[s_id]
                    
                    # 基礎微幅亂數震盪
                    base["temp"] += random.uniform(-1.0, 1.0)
                    base["cpu"] += random.uniform(-4.0, 4.0)
                    base["traffic"] += random.uniform(-2.0, 2.0)
                    
                    if s_id == active_critical:
                        # 異常目標 (Red Critical)
                        if base["temp"] < 75: base["temp"] += 10.0
                        if base["cpu"] < 95: base["cpu"] += 20.0
                        if base["traffic"] < 45: base["traffic"] += 10.0
                    elif s_id == active_warning:
                        # 警告目標 (Yellow Warning)
                        if base["temp"] < 45: base["temp"] += 5.0
                        if base["cpu"] < 75: base["cpu"] += 10.0
                        if base["traffic"] < 30: base["traffic"] += 5.0
                    else:
                        # 正常目標
                        if base["temp"] > 25: base["temp"] -= 5.0
                        if base["cpu"] > 25: base["cpu"] -= 10.0
                        if base["traffic"] > 10: base["traffic"] -= 5.0
                    
                    # 絕對上下限保護
                    base["temp"] = max(18, min(base["temp"], 90))
                    base["cpu"] = max(2, min(base["cpu"], 100))
                    base["traffic"] = max(0.1, min(base["traffic"], 50))
                    
                    if s_id.startswith("SW-"):
                        # Network Switch specific payload (Network + Control Plane + Chassis)
                        payload = {
                            "server_id": s_id,
                            "traffic_gbps": round(base["traffic"], 2),
                            "ports_active": int(48 * (base["cpu"] / 100)), # Link ports to "cpu" for simplicity
                            "ports_total": 48,
                            "cpu_usage": round(base["cpu"], 2),      # Control Plane Load
                            "temperature": round(base["temp"], 2),  # Chassis Temp
                            "timestamp": int(time.time() * 1000)
                        }
                    else:
                        # Server specific payload
                        current_temp = base["temp"] + (random.uniform(15, 25) if random.random() < 0.005 else 0)
                        current_cpu = base["cpu"] + (random.uniform(30, 50) if random.random() < 0.005 else 0)
                        payload = {
                            "server_id": s_id,
                            "temperature": min(current_temp, 99.9),
                            "cpu_usage": min(current_cpu, 100.0),
                            "timestamp": int(time.time() * 1000)
                        }
                        
                    producer.send(TOPIC, value=payload)
                producer.flush()
            except Exception as e:
                try:
                    import traceback
                    with open("sim_error.log", "a", encoding="utf-8") as f:
                        f.write(f"Simulator Error: {traceback.format_exc()}\n")
                except:
                    pass
                # 若發生 Metadata Timeout 或 Socket 錯誤，強制重置 Producer 以觸發自動重連
                try:
                    producer.close(timeout=1)
                except: pass
                producer = None
                threading.Thread(target=init_kafka_producer, daemon=True).start()
        time.sleep(5)

@app.on_event("startup")
async def startup_event():
    # 初始化 MongoDB
    threading.Thread(target=init_mongo, daemon=True).start()
    threading.Thread(target=init_kafka_producer, daemon=True).start()
    threading.Thread(target=kafka_consumer_worker, daemon=True).start()
    threading.Thread(target=simulation_worker, daemon=True).start() # 啟動內建模擬器

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.get("/debug")
def debug():
    return {
        "producer_ready": producer is not None,
        "latest_metrics_len": len(latest_metrics),
        "system_mode": system_mode
    }
