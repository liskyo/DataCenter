# DataCenter 整體資料庫架構及開發環境與流程指南 (1150325)

本文件詳細說明 DataCenter 系統的儲存架構與資料流向，並提供開發者如何「進入」資料庫進行除錯與驗證的具體步驟。

---

## 🏛️ 一、 資料庫三巨頭連線資訊 (Access Guide)

若要手動查看或修改資料庫內容，請使用以下連線設定：

### 1. MongoDB (事件與日誌)
- **連線位址**: `mongodb://localhost:27018`
- **推薦工具**: [MongoDB Compass](https://www.mongodb.com/products/compass)
- **登入資訊 (Authentication)**:
  - Method: `Username / Password`
  - Username: `admin`
  - Password: `adminpassword`
  - Auth DB: `admin`
- **主要標的**:
  - Database: `datacenter`
  - Collection: `alerts` (存儲 AI 異常與系統告警)

### 2. InfluxDB (時序數據/圖表數值)
- **連線位址**: `http://localhost:8087` (直接使用瀏覽器開啟)
- **登入帳密**:
  - User: `admin`
  - Password: `adminpassword`
- **關鍵參數**:
  - Bucket: `telemetry`
  - Token: `my-super-secret-auth-token`
- **功能**: 點擊左側「Data Explorer」即可透過 Flux 語法查詢所有伺服器的即時效能指標。

### 3. Apache Kafka (串流緩衝)
- **連線位址**: `localhost:29093` (外部存取埠)
- **預設 Topic**: `telemetry`
- **推薦工具**: [Offset Explorer](https://www.kafkatool.com/)

### 4. 其他基礎設施
- **Zookeeper**: `localhost:2182`
- **Grafana**: `http://localhost:3002` (帳密均為 `admin`)

---

## 🏗️ 二、 混合式儲存架構 (Hybrid Storage)

### 1. 遙測串流路徑 (Telemetry Flow)
1. **收集層**：`client_agent.py` 採集數據。
2. **傳輸層**：數據推播至 FastAPI 的 `/ingest` 接口，並寫入 **Kafka**。
3. **分發層**：後端 Worker 從 Kafka 讀取數據，同時寫入：
   - **InfluxDB**: 儲存 `cpu_usage` 與 `temperature` 的時間細分紀錄。
   - **MongoDB**: 若偵測到數值異常，則寫入一筆 Alert 紀錄。

### 2. 空間配置資料 (Layout Data)
- **dcim_layout.json**: 儲存機房的靜態/初始佈局（3D 機櫃位置、U 位配置）。
- **LocalStorage**: 用於暫存前端操作員的即時拖拉調整，提供無感知的持久化體驗。

---

## 🛠️ 三、 維運常用指令 (Operations)

### 一鍵啟動
```bash
docker-compose up -d
```

### 資料徹底清空 (Hard Reset)
當測試數據過亂，需要還原至純淨狀態時：
```bash
docker-compose down -v
```
*(注意：`-v` 會刪除所有磁碟卷宗中的數據，請謹慎使用。)*

---
*文件更新日期：2026-03-25 (1150325 更新版)*
