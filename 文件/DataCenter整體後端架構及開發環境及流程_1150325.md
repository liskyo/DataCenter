# DataCenter 整體後端架構及開發環境及流程指南 (1150325)

本文件說明目前後端服務的實際架構與運作方式，內容以 `backend/` 現況為準。

---

## 1. 後端定位

後端以 `FastAPI` 為核心，負責：

- 接收遙測資料
- 提供前端 API 與 SSE
- 執行告警與異常分析
- 寫入 InfluxDB / MongoDB
- 管理模擬模式、維運排程、通知與控制流程

主要對外服務埠為 `9000`。

---

## 2. 核心組成

### 2.1 入口層

`backend/main.py` 會建立應用程式並掛載 routers，主要入口包含：

- `POST /ingest`
- `GET /metrics`
- `GET /alerts`
- `GET /history`
- `GET /stream`
- `/api/system/*`
- `/api/control/*`
- `/api/auth/*`
- `/api/maintenance/*`

### 2.2 容器與組裝層

`backend/core/container.py` 負責建立與組裝服務，包含：

- Kafka service
- Telemetry service
- Storage service
- Notification service
- SSE manager
- Maintenance service
- ML worker
- Remediation service

### 2.3 背景工作

目前啟動時會開啟的背景流程包括：

- Kafka consumer worker
- Simulation worker
- Maintenance email worker

---

## 3. 主要服務模組

### 3.1 `kafka_service.py`

- 管理 producer / consumer
- 接收與分發 `telemetry` topic
- 支援模擬資料產生

### 3.2 `telemetry_service.py`

- 保存最新指標快取
- 維護歷史資料滑動視窗
- 提供異常偵測依據

### 3.3 `storage_service.py`

- 將時序資料寫入 InfluxDB
- 將告警、使用者、維運資料寫入 MongoDB

### 3.4 `notification_service.py`

- 支援 LINE Notify
- 支援 SMTP 郵件

### 3.5 `sse_manager.py`

- 管理前端 SSE 廣播
- 可搭配 Redis Pub/Sub 做多實例事件傳遞

### 3.6 其他服務

- `maintenance_service.py`：維護排程與提醒
- `ml_worker.py`：異常偵測處理
- `remediation_service.py`：自動補救邏輯

---

## 4. 後端處理主幹

```text
POST /ingest
   -> Kafka producer
   -> Kafka consumer
   -> process_message
   -> rule / anomaly / maintenance logic
   -> InfluxDB + MongoDB
   -> SSE broadcast
```

這個設計的重點是：

- API 入口儘量保持輕量
- 重運算與資料落庫由背景工作處理
- 前端畫面與儲存層由相同事件主幹驅動

---

## 5. 即時與控制能力

### 5.1 即時能力

- 即時更新使用 `SSE`
- 前端透過 `GET /stream` 接收更新
- 必要時以 Redis 協助事件傳遞

### 5.2 控制能力

- `routers/control.py` 提供控制 API 介面
- 目前為記憶體狀態更新與 Redfish 整合預留點
- 真實 BMC 電源控制尚未完全落地於正式流程

---

## 6. 資料與告警邏輯

目前系統至少包含以下判斷方向：

- 閾值型告警
- AI anomaly 判斷
- 維護排程通知
- 液冷與設備指標的延伸檢查

已知基礎異常判斷邏輯包含：

- CPU 超過一定門檻
- 與歷史平均相比出現異常暴衝

---

## 7. 開發與埠號

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 9000 --reload
```

關聯服務埠：

| 服務 | Host Port |
| --- | --- |
| FastAPI | `9000` |
| MongoDB | `27018` |
| InfluxDB | `8087` |
| Kafka | `29093` |
| ZooKeeper | `2182` |
| Redis | `6379` |

---

## 8. 文件同步注意事項

- 即時通道請描述為 `SSE`，不要再寫成 WebSocket
- 後端設定與 `.env.example` 並非完全一一對應，特別是 Kafka 參數需再以程式碼為準
- `GET /health` 與 `GET /debug` 為維運輔助端點，但健康檢查內容仍應以實作狀態判讀
- 若文件提到 Discord、Slack、Celery 或完全落地的 Redfish 控制，需視為舊描述，不應再當作現況

---

*文件更新日期：2026-04-21*
