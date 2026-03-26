# 檔案用途說明（DCIM System）

以下整理本專案中你近期關注/我在本輪更新過的關鍵檔案用途，方便日後維護與排查問題。

## 根目錄文件

### `README.md`
- 用途：專案啟動前置條件與快速上手說明，包含 `start.bat` 啟動後應開啟的前端網址、以及常見錯誤排解。
- 主要用途：新環境/重建環境時的入口文件。

### `Agent_Autorun_Guide_20260323.md`
- 用途：說明如何讓 `client_agent.py` 在「閒置伺服器」開機後自動執行。
- 主要包含：Linux 的 `systemd` 設定、Windows 的 Task Scheduler/`runner.bat` 作法。
- 主要用途：部署到真實機器後降低人工操作成本。

### `Architecture_Comparison.md`
- 用途：解釋監控架構從「Pull-based（拉取）」到「Push-based（推播/串流）」的演進，並對應到本專案採用的 Telemetry Streaming 思路。
- 主要用途：提供給新成員快速理解本系統為何使用 Kafka 串流/Agent 推送。

### `Debug_Log_20260323.md`
- 用途：記錄本系統在 Windows / Docker / Next / Kafka 可能出現的典型問題、成因與對應解法。
- 主要用途：當你遇到「前端切頁當掉」「Kafka 連不上」「前端資料空白」等問題時快速定位。

### `Idle_Server_Testing_Guide_20260323.md`
- 用途：示範如何用一台「閒置實體伺服器」跑真實 `client_agent.py`，把硬體 CPU/溫度推送到後端，讓前端畫面進入 LIVE 狀態。
- 主要包含：Dashboard 模式切換、`client_agent.py` 設定欄位、預期輸出與進階壓測建議。
- 主要用途：跨機器驗證資料是否可串接到儀表板。

### `Network_Topology_Diagram.md`
- 用途：說明資料中心監控的實體網路拓撲概念（交換器、Dashboard 主機、被監控伺服器、Agent 推送目標）。
- 主要用途：幫助理解 Agent 應連到哪台主機/哪些端口（用於部署規劃與故障排查）。

### `Server_Data_Collection_Guide_20260323.md`
- 用途：用新手友善的方式解析「資料如何被收集」：Pull 與 Push 的差異，以及本系統中 Agent 透過後端 `/ingest` 上傳，再由後端寫入 Kafka/Influx/Mongo。
- 主要用途：讓開發者/維運理解端到端資料流，避免誤把流程寫成「Agent 直接打 Kafka」的舊作法。

## 程式碼

### `client_agent.py`
- 用途：跑在閒置/被監控伺服器上的 Agent，週期性讀取 CPU 使用率與溫度，並用 HTTP `POST` 推送到控制中心後端的 `/ingest`。
- 主要輸出：控制中心前端可透過後端提供的 `/metrics`、`/history`、`/alerts` 看到資料更新。
- 主要用途：真實資料接入（模擬/真機都可用同一支邏輯）。

### `frontend/src/shared/hooks/usePolling.ts`
- 用途：封裝前端輪詢（polling）邏輯，並加入「overlap guard」避免同一時間多個 tick 同時進行，造成資源浪費或資料競態。
- 主要行為：支援 `immediate`（是否立即先執行一次）與固定 `intervalMs`；tick 中若上一輪還在進行會跳過。
- 主要用途：解決輪詢在切頁/狀態變更時可能造成的記憶體/效能問題。

## 前端設定

### `frontend/.gitignore`
- 用途：指定前端哪些產物不應被 git 追蹤，常見包含 `node_modules`、Next.js 的 `.next/`、`/out/`、以及各種 build/快取結果。
- 主要用途：避免把快取/編譯產物提交到 repo，降低 repo 大小與無關變更噪音。

---

## 系統端到端程式說明（程式怎麼跑）

本系統的程式由三大部分組成：**啟動腳本/容器**、**後端 FastAPI + 背景 Worker**、**前端 Next.js 分頁 + 輪詢/狀態**。

### 1. 啟動流程

#### `start.bat`
- 用途：一鍵啟動整個 DCIM 系統（Docker + 後端 + 前端）。
- 執行內容：
  - 先執行 `docker-compose up -d`
  - 再啟動 `backend`：`python -m uvicorn main:app --host 127.0.0.1 --port 9000 --reload`
  - 再啟動 `frontend`：`npm install --workspaces=false` 後以 Turbopack/Next.js dev server 開啟 `9001`
- 目標網址：
  - Backend API：`http://127.0.0.1:9000/docs`
  - Frontend：`http://127.0.0.1:9001`
  - Grafana：`http://127.0.0.1:3000`

#### `docker-compose.yml`
- 用途：啟動與維護資料層服務（Kafka / InfluxDB / MongoDB / Grafana / Zookeeper）。
- 服務/端口（依檔案內容）：
  - Kafka：
    - 外部對外端口：`29092:29092`
    - 內部監聽：`INSIDE://0.0.0.0:9092`
    - 外部宣告：`OUTSIDE://localhost:29092`
    - 自動建主題：`telemetry:1:1`
  - InfluxDB：`8086:8086`（`adminpassword`、bucket `telemetry`）
  - MongoDB：`27017:27017`（root `admin` / `adminpassword`）
  - Grafana：`3000:3000`

##### Kafka（訊息中介）用途
- 在此系統中，Kafka 是「事件傳遞緩衝/中介層」：先把 telemetry payload 暫存到 topic，再由後端背景 consumer 消費並寫入 InfluxDB/MongoDB、同時更新前端需要的 in-memory 快取。
- topic：目前使用 `telemetry`
- 關鍵目標：避免 `POST /ingest` 的即時接收被資料庫寫入/異常計算拖慢；即使後端 momentary busy，消息也可在 Kafka 排隊。

##### Telegraf（目前選配、但本專案未部署）
- Telegraf 通常是「metrics collector/agent」，用來從主機/服務抓取 CPU、memory、disk、network 等指標，並再輸出到目的地（最常見是 InfluxDB，或也可推到 Kafka 等）。
- 但本專案目前的 `docker-compose.yml` **沒有啟用 telegraf 服務**；因此你看到的資料寫入 InfluxDB 並不是 Telegraf 直接完成，而是由後端 consumer 呼叫 `InfluxService.write_metrics()` 完成。
- 若未來要引入 Telegraf：
  - 可讓 Telegraf 直接寫 InfluxDB（簡化流程）
  - 或將 Telegraf 的輸出改為 Kafka topic（維持現有「Kafka -> 後端背景 worker -> Influx/Mongo」的架構）

### 2. 後端 FastAPI（`backend/main.py`）

#### 角色
- 用途：提供 API 給前端，並在啟動時開背景 Worker，把資料串到 Kafka/Influx/Mongo。
- 核心背景運作：
  - `POST /ingest`：前端/Agent 推送資料進來，**立刻 emit 到 Kafka**，不在 API thread 做重運算。
  - 背景 Thread：
    - Kafka Consumer：從 Kafka 讀取事件，做 `temp>40` 閾值告警 + AI 異常偵測，最後寫入 InfluxDB 與更新記憶體快取
    - Simulation Worker：在 `system_mode == simulation` 時，模擬產生各台 `SERVER-*` 與 `SW-*` 指標

#### 主要 API
- `POST /ingest`
  - 目的：Agent 推送 telemetry payload
  - 行為：`kafka_service.emit(payload)`；Kafka 尚未就緒會回錯誤狀態
- `GET /metrics`
  - 目的：回傳前端畫面需要的「最新指標快取」（來自 `TelemetryService.latest_metrics`）
- `GET /alerts`
  - 目的：回傳 MongoDB `alerts` 集合的告警紀錄
- `GET /history`
  - 目的：回傳 `TelemetryService.server_history`（滑動視窗）用於趨勢分析
- `GET/POST /api/system/mode`
  - 目的：切換 `simulation` / `real`（切換時會清空最新快取）
- `GET /health`
  - 目的：回報依賴元件狀態（mongo / kafka producer / kafka consumer）
- `GET /debug`
  - 目的：回報目前 producer/consumer_ready、latest_metrics 長度、system_mode 等

### 3. 後端背景 Worker / Service 模組

#### `backend/services/kafka_service.py`（KafkaRuntimeService）
- 用途：統一管理 Kafka producer/consumer 與模擬產生器。
- producer：
  - `init_kafka_producer()`：重試直到成功連上 broker
  - `emit(payload)`：`send` + `flush`，讓 payload 確實送出
- consumer worker：
  - `kafka_consumer_worker(on_message)`：持續消費 `telemetry` topic
  - 每次收到訊息會呼叫 `on_message(msg.value)`，此處在 `main.py` 傳入的是 `process_message`
- simulation worker：
  - `simulation_worker(system_mode_getter)`：當模式為 `simulation` 時，週期性產生：
    - `SERVER-001~SERVER-012`：temperature / cpu_usage
    - `SW-001~SW-012`：traffic_gbps / ports_active / ports_total / cpu_usage / temperature / timestamp
  - 然後將 payload 推回 Kafka（同一個 `telemetry` topic）

#### `backend/services/storage_service.py`
- 用途：InfluxDB 寫入與 MongoDB 告警持久化。
- `InfluxService.write_metrics(server_id, temp, cpu)`
  - measurement：`server_metrics`
  - tag：`server_id`
  - field：`temperature`、`cpu_usage`
- `AlertStorageService`
  - 集合：`datacenter.alerts`
  - `timestamp` 上建立降序索引

#### `backend/services/telemetry_service.py`
- 用途：前端快取與 AI 異常偵測的 in-memory 狀態管理。
- 狀態：
  - `latest_metrics`: `server_id -> payload`（供 `/metrics`）
  - `server_history`: `server_id -> deque[(temp,cpu)]`（供 `/history`）
- `detect_anomaly(server_id, cpu, temp)`
  - 使用滑動視窗計算歷史平均 CPU
  - 判定條件包含：
    - `cpu > 60`
    - `cpu > avg_cpu * 1.5`

### 4. 前端 Next.js（`frontend/src/app/*`）

#### `frontend/src/app/layout.tsx`
- 用途：全域 Layout + 導覽列 Navbar。
- 重點：
  - 全頁用 `flex flex-col h-screen overflow-hidden`
  - 中央內容用 `min-h-0 overflow-y-auto` 避免高度計算錯誤導致切頁卡死

#### `frontend/src/components/Navbar.tsx`
- 用途：分頁導覽列（`/`, `/twins`, `/facility`, `/control`, `/analysis`, `/maintenance`, `/backup`, `/network`, `/logs`, `/engineering`, `/settings`）
- 用到的狀態：`useDcimStore`（位置/地點選擇器會影響前端畫面顯示）

#### 輪詢與圖表裝載

##### `frontend/src/shared/hooks/usePolling.ts`
- 用途：封裝前端輪詢（polling），並加入 overlap guard，避免切頁時多個 interval 同時發 request。

##### `frontend/src/components/ClientOnlyChart.tsx`
- 用途：只在瀏覽器量到容器寬高足夠（避免 Recharts ResponsiveContainer 先量到 `-1`）時才真正掛載圖表。

### 5. 前端各分頁的用途（`page.tsx`）

> 下列分頁的資料來源端點以現行程式為準（多數使用 `http://localhost:9000/...`）。

- `frontend/src/app/page.tsx`（`/` 狀態總覽 / Dashboard）
  - 角色：顯示 CPU 趨勢、健康比例（Doughnut）、並用輪詢取得 `/metrics`。
  - 連線：
    - 取得模式：`GET http://localhost:9000/api/system/mode`
    - 切換模式：`POST http://localhost:9000/api/system/mode`
    - 取得最新數據：`GET http://localhost:9000/metrics`（`usePolling intervalMs:5000`）
  - 依賴：
    - `useDcimStore`：依 `currentLocationId` 計算整體健康分佈
    - `ClientOnlyChart`：避免圖表尺寸異常

- `frontend/src/app/analysis/page.tsx`（`/analysis` 趨勢分析）
  - 角色：對每台 `server_id` 顯示 CPU/temperature 的歷史曲線
  - 連線：`GET http://localhost:9000/history`（`intervalMs:2000`）

- `frontend/src/app/logs/page.tsx`（`/logs` 系統日誌與告警）
  - 角色：列出 MongoDB 告警（並用樣式高亮 `AI_ANOMALY`）
  - 連線：`GET http://localhost:9000/alerts`（`intervalMs:2000`）

- `frontend/src/app/twins/page.tsx`（`/twins` 3D 動態機房）
  - 角色：React Three Fiber 3D 場景（Racks、Equipment、NetworkLines 等）
  - 狀態：
    - 用 `useDcimStore` 保存 racks/equipments 的 layout（並透過 Zustand `persist` 支援 export/import）
  - 連線：
    - `GET http://localhost:9000/metrics`（每 5 秒刷新，且帶 `cache:"no-store"`，避免快取造成不同步）

- `frontend/src/app/control/page.tsx`（`/control` 設備控制）
  - 角色：設備控制 UI（power/fan/reboot/config modal）
  - 注意：目前頁面邏輯主要是前端 local state（沒有在此程式片段中直接呼叫 `/ingest` 或控制 API）。

- `frontend/src/app/maintenance/page.tsx`（`/maintenance` 維護保養）
  - 角色：顯示靜態維護排程/工單（目前是固定資料陣列）

- `frontend/src/app/network/page.tsx`（`/network` 網路通訊）
  - 角色：網路拓撲 UI（目前是靜態呈現）

- `frontend/src/app/facility/page.tsx`（`/facility` 廠務監控）
  - 角色：以 mock/模擬方式展示 DCIM power/environment 指標（目前為前端 interval 模擬）

- `frontend/src/app/engineering/page.tsx`（`/engineering` 工程模式）
  - 角色：UI 對「override code」解鎖狀態（本頁面為前端狀態，不會直接改後端）

- `frontend/src/app/backup/page.tsx`（`/backup` 系統備份）
  - 角色：災備/同步概念 UI（目前為靜態資料）

- `frontend/src/app/settings/page.tsx`（`/settings` 系統設定）
  - 角色：通知/保留策略/主題的 UI（目前為前端展示）

- `frontend/src/app/error.tsx`
  - 角色：Next.js App Router 的路由層錯誤 UI（使用 `reset()` 重試）

### 6. 前端狀態管理（`frontend/src/store/useDcimStore.ts`）
- 用途：維護數位機房 layout 與選擇狀態：
  - `racks` / `equipments` / `locations` / `currentLocationId`
  - `isEditMode`、`selectedRackId`、`selectedEquipmentId`
  - 支援 LocalStorage 的持久化與 export/import（用於維護機房設定）

### 7. Agent（`client_agent.py`）
- 用途：部署在被監控機器上的 Agent，週期性抓硬體 CPU/溫度，並用 HTTP `POST` 推送到後端 `/ingest`。
- 重要提醒（依現行程式碼）：
  - `client_agent.py` 目前的 `DATACENTER_API_URL` 預設是 `http://127.0.0.1:8000/ingest`
  - 但本專案目前後端實際啟動 port 是 `9000`（在 `start.bat` 與 `backend/main.py` 端）
  - 因此實機/測試時請把 Agent 的 API URL 調整到 `http://<dashboard-ip>:9000/ingest`，否則真機資料無法進入系統。


