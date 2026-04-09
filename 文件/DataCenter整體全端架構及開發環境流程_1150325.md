# DataCenter 全端架構及開發環境流程指南 (1150325)

這份文件記錄了 DataCenter 專案從前端 Mockup 演進為 **「Telemetry Streaming (遙測串流)」** 全端架構後的完整技術細節。

---

## 🏗️ 第一部分：系統整體架構 (System Architecture)

目前的專案採用 **Push-based (推播式)** 架構，達成了「隨插即用、零配置」的監控體驗。

### 1. 三層式結構
- **採集層 (Agent Layer)**：由 `client_agent.py` 組成，部署在被監控的伺服器上。主動透過 Kafka 或特定協議將數據「推」向後端。
- **處理層 (Backend Layer)**：
  - **FastAPI (`backend/`)**：負責 API 路由、業務邏輯處理與 WebSocket 實時數據轉發。
  - **資料庫/消息隊列**：利用 MongoDB 儲存歷史數據，Kafka (選擇性) 處理高併發串流。
- **呈現層 (Frontend Layer)**：
  - **Next.js 15 (`frontend/`)**：提供 Cyberpunk 風格的戰情室介面，包含 3D 數位分身與 2D 即時圖表。

---

## 🎨 第二部分：前端 UI 與技術堆疊

### 1. 核心技術
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS v4 (採用 `@import "tailwindcss";` 語法)
- **Charts**: Recharts (客製化青藍漸層遮罩)
- **3D Engine**: `@react-three/fiber` (實現機房數位分身)

### 2. 關鍵分頁
- `/` (狀態總覽): 大腦儀表板，Doughnut Chart 與 Area Chart。
- `/control` (設備控制): 模擬重工業撥動開關。
- `/logs` (系統日誌): 終端機風格的 MongoDB 告警顯示。
- `/network` (網路通訊): 幾何拓撲圖展示。

---

## 🛠️ 第三部分：後端與 Agent 運作機制

### 1. Backend (`backend/`)
- 使用 FastAPI 驅動，內部包含 `services/` 模組化開發。
- `mock_sensor_data.py`: 用於開發階段的本地數據模擬。

### 2. Client Agent (`client_agent.py`)
- 輕量化 Python 腳本。
- 自動抓取本機 CPU、記憶體與溫度數據。
- 具備自動重連機制，確保數據串流不中斷。

---

## 🔄 第四部分：開發環境啟動 (Quick Start)

### 模式 A：單機快速啟動 (Quick Start)
1. 執行根目錄的 `start.bat`。
2. 開啟瀏覽器訪問 `http://localhost:3000` (或 3001)。

### 模式 B：手動分區啟動
- **Frontend**: `cd frontend && npm install && npm run dev`
- **Backend**: `cd backend && pip install -r requirements.txt && python main.py`
- **Agent**: `python client_agent.py`

---

## 📝 第五部分：架構演進對比 (History)
相較於 **2026-03-21** 版本，目前的架構有以下重大變動：
1. **全端化**：新增了真實的 Backend 與 Agent 邏輯，不再只是前端模擬。
2. **容器化預備**：新增 `docker-compose.yml` 支援快速部署基礎設施。
3. **自動化運算**：強化了 AI 判斷異常與即時推播邏輯。

---
*文件更新日期：2026-03-25 (1150325 版本)*
