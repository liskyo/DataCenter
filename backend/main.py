from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from kafka import KafkaProducer, KafkaConsumer
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
from pymongo import MongoClient
import json
import time
import threading

app = FastAPI(title="DataCenter Monitoring API")

# 允許前端跨域請求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# [1] Kafka Config
KAFKA_BROKER = "localhost:9092"
TOPIC = "telemetry"
producer = None

# [2] InfluxDB Config (時序資料庫)
INFLUX_URL = "http://localhost:8086"
INFLUX_TOKEN = "adminpassword"
INFLUX_ORG = "datacenter"
INFLUX_BUCKET = "telemetry"
influx_client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
write_api = influx_client.write_api(write_options=SYNCHRONOUS)

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
        print("MongoDB connected...")
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
    consumer = None
    while not consumer:
        try:
            consumer = KafkaConsumer(
                TOPIC,
                bootstrap_servers=[KAFKA_BROKER],
                group_id='influx_writer_group',
                auto_offset_reset='earliest',
                value_deserializer=lambda m: json.loads(m.decode('utf-8'))
            )
        except Exception as e:
            time.sleep(3)
            
    print("Kafka Consumer started...")
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

@app.on_event("startup")
async def startup_event():
    # 初始化 MongoDB
    threading.Thread(target=init_mongo, daemon=True).start()
    threading.Thread(target=init_kafka_producer, daemon=True).start()
    threading.Thread(target=kafka_consumer_worker, daemon=True).start()

@app.get("/health")
def health_check():
    return {"status": "healthy"}
