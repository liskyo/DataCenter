# DataCenter 整體架構及開發環境與流程指南 (1150325)

本文件為 **DataCenter Monitoring System** 的全系統架構手冊，適用於 1150325 版本。本版本核心演進為 **「全端推播式遙測 (Push-based Telemetry)」**。

---

## 🌟 第一部分：專案總覽與設計理念

### 1. 系統定義
這是一個工業級的資料中心監控系統，採用 **雲原生微服務架構 (Cloud-Native Microservices)** 與 **即時串流 (Streaming)** 技術，實現大規模伺服器機房的數據自動化採集、AI 異常檢測與 3D 數位分身視覺化。

### 2. 核心設計原則
- **推播式遙測 (Push-based)**：伺服器主動向上層回報，達成「隨插即用 (Plug & Play)」，大幅降低網管配置壓力。
- **高可用性 (High Availability)**：採用訊息分發層 (Kafka) 進行解耦，確保前端掛掉時數據採集不中斷。
- **數據驅動 3D (Data-Driven 3D)**：機房佈局由 JSON 定義，實現彈性的機房動態調整。

---

## 🏗️ 第二部分：系統四層架構 (System Layers)

### 1. 採集層 (Collection Layer)
- **核心主角：`client_agent.py` / `mock_sensor_data.py`**
- **功能**：部署於各伺服器的輕量化代理程式，每秒抓取硬體溫度、CPU 與記憶體數據，並透過 REST API 或 Kafka 推播至中心。

### 2. 訊息與緩衝層 (Message Broker)
- **核心主角：Apache Kafka + Zookeeper**
- **功能**：高吞吐量的數據郵筒，負責緩衝海量遙測信號，確保後端處理壓力均衡。

### 3. 後端服務層 (Backend Service)
- **核心主角：FastAPI (Python)**
- **功能**：
  - **數據攝取 (/ingest)**：接收 Agent 數據並寫入 Kafka 或資料庫。
  - **AI 處理**：對即時數據進行異常分析與警報判定。
  - **API 提供**：提供前端所需的即時狀態、歷史曲線與 3D 佈局數據。

### 4. 前端與儲存層 (Visualization & Storage)
- **儲存**：**InfluxDB** (時間序列/圖表) + **MongoDB** (系統日誌/告警)。
- **展示**：**Next.js 15 (App Router)**，提供 Cyberpunk 風格面板與 **3D 動態機房**。

---

## 💻 第三部分：開發環境與結構

### 1. 目錄結構
- `backend/`: FastAPI 後端邏輯、AI 演算與數據模擬。
- `frontend/`: Next.js 前端、3D 組件與即時監控面板。
- `layout/`: **核心佈局 JSON** (`dcim_layout.json`)，定義 3D 機房空間結構。
- `client_agent.py`: 分散式採集代理原始碼。
- `docker-compose.yml`: 資料庫與中間件的容器化配置。

### 2. 啟動準備
- **Docker Desktop**: 必須在背景運行。
- **Node.js (v20+)** & **Python (3.10+)**。

---

## 🚀 第四部分：一鍵啟動流程 (Workflow)

### 步驟一：啟動基礎設施 (Docker)
執行根目錄的 `start.bat` 或輸入：
```bash
docker-compose up -d
```

### 步驟二：啟動後端心臟 (FastAPI)
```bash
cd backend
pip install -r requirements.txt
python main.py
```

### 步驟三：啟動前端面板 (Next.js)
```bash
cd frontend
npm install
npm run dev -p 3001
```

### 步驟四：啟動數據採集 (Agent)
**本地測試**：執行 `python backend/mock_sensor_data.py` 推送模擬數據。
**真實機器**：將 `client_agent.py` 拷貝至該機，修改 `MY_SERVER_ID` 並執行。

---

## 🛠️ 常見問題 (FAQ)
- **Q：為什麼 3D 畫面沒顯示機櫃？**
  請檢查 `layout/` 目錄下的 JSON 檔案內容是否正確載入，以及前端是否有正確介接佈局 API。
- **Q：資料連不上？**
  請確認 Docker 視窗中的 Kafka 與 MongoDB 是否顯示綠燈運行。

---
*文件更新日期：2026-03-25 (1150325 更新版)*
