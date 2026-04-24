# DataCenter 整體架構及開發環境及流程指南 (1150325)

本文件以目前專案實作為準，說明 `D:/dcim-system` 的整體系統架構、資料流、開發環境與啟動方式。若與舊版文件衝突，請以本文件與實際程式碼為準。

---

## 1. 系統定位

本系統是一套以資料中心監控為核心的全端 DCIM 平台，整合以下能力：

- Agent 或設備上送遙測資料
- Kafka 串流解耦與背景處理
- FastAPI 提供 API、SSE 與業務邏輯
- InfluxDB 與 MongoDB 分工儲存
- Next.js 16 前端提供即時監控、3D 視覺化與操作介面

目前架構主軸是 **Push-based Telemetry + 後端集中處理 + 前端即時展示**。

---

## 2. 系統分層

### 2.1 採集層

主要元件：

- `client_agent.py`
- `backend/mock_sensor_data.py`
- 其他可整合的設備來源

職責：

- 收集 CPU、溫度、記憶體與設備狀態
- 以 HTTP `POST /ingest` 將資料送入後端
- 在模擬模式下由背景 worker 產生測試資料

### 2.2 訊息與緩衝層

主要元件：

- Kafka
- ZooKeeper

職責：

- 作為遙測事件匯流排
- 解耦入口接收與後續處理
- 提供高頻資料的緩衝與擴充空間

### 2.3 後端服務層

主要元件：

- `backend/main.py`
- `backend/core/container.py`
- `backend/services/*`
- `backend/routers/*`

職責：

- 接收 `/ingest`、`/metrics`、`/alerts`、`/history`、`/stream`
- 執行告警判斷、AI 異常偵測、維運排程、通知與 SSE 廣播
- 統一管理 Kafka、InfluxDB、MongoDB、Redis 與通知服務

### 2.4 儲存與展示層

主要元件：

- InfluxDB：時間序列資料
- MongoDB：告警、使用者、維運資料
- Redis：SSE Pub/Sub 輔助
- Next.js 16.2.0 前端

職責：

- 保存歷史指標與事件
- 提供 Dashboard、3D Twins、Control、Maintenance、Network 等畫面
- 透過 SSE 優先、Polling 保底的方式更新 UI

---

## 3. 端到端資料流

```text
Agent / Device / Simulation
          |
          v
   FastAPI POST /ingest
          |
          v
      Kafka topic
          |
          v
   Consumer / Processing
      |          |        |
      v          v        v
   InfluxDB   MongoDB   SSE/Redis
                         |
                         v
                    Next.js Frontend
```

補充說明：

- 前端即時資料通道以 `GET /stream` 的 SSE 為主
- 若 SSE 中斷或靜默，前端會退回 `/metrics` 輪詢
- 控制類 API 目前已有介面與 stub，但真實 Redfish 控制仍屬預留整合點

---

## 4. 專案目錄摘要

- `backend/`：FastAPI、服務層、背景工作、資料處理
- `frontend/`：Next.js App Router、3D 元件、狀態管理、頁面
- `layout/`：機房佈局與展示資料
- `docker-compose.yml`：基礎設施容器
- `start.bat`：本機一鍵啟動腳本
- `.env.example`：環境變數範例

---

## 5. 開發與部署環境

必要條件：

- Node.js `>= 20.9`
- Python `>= 3.10`
- Docker Desktop

`docker-compose.yml` 目前主要服務與對外埠如下：

| 服務 | Host Port | 用途 |
| --- | --- | --- |
| Backend | `9000` | FastAPI API / SSE |
| Frontend | `9001` | Next.js 開發站台 |
| MongoDB | `27018` | 文件型資料庫 |
| InfluxDB | `8087` | 時序資料庫 |
| Kafka | `29093` | 遙測事件匯流排 |
| ZooKeeper | `2182` | Kafka 協調 |
| Redis | `6379` | SSE Pub/Sub |
| Mailpit | `1025` / `8025` | 本機郵件測試 |
| Grafana | `3002` | 視覺化驗證 |

---

## 6. 啟動流程

### 6.1 建議方式

直接執行根目錄 `start.bat`。

### 6.2 手動方式

1. 啟動基礎設施

```bash
docker compose up -d
```

2. 啟動後端

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 9000 --reload
```

3. 啟動前端

```bash
cd frontend
npm install
npm run dev -- -p 9001
```

4. 啟動資料來源

- 模擬模式：由後端背景 worker 產生資料
- 真機模式：執行 `client_agent.py` 指向 `http://<backend-host>:9000/ingest`

---

## 7. 目前實作注意事項

- 前端框架實際版本為 `Next.js 16.2.0`，不是舊文件中的 Next 15
- 即時通訊以 `SSE` 為主，不是 WebSocket
- Grafana 對外位址為 `http://127.0.0.1:3002`
- `.env.example` 中部分 Kafka / Postgres 參數與目前 compose 不完全一致，設定時應以實際程式與容器配置為準
- Redfish、SNMP、Modbus、gNMI 等屬於整合方向，其中部分仍是預留或文件層設計，非全部都已在程式內落地

---

*文件更新日期：2026-04-21*
