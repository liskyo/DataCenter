# DataCenter 整體後端架構及開發環境與流程指南 (1150325)

本文件詳解 DataCenter 監控系統的後端核心架構，適用於 1150325 版本之**偏移連接埠 (Port Offset)** 配置。

---

## 🧠 第一部分：後端「接單與廚房」架構

後端採用 **FastAPI (Python)** 框架，透過非同步 (Asynchronous) 特性處理高併發數據。

### 1. 接單台 (REST API 層) - Port 9000
- **`/ingest`**: 數據入口。負責接收來自 Agent 的 JSON 數據並立即推入 Kafka，實現「即收即走」，不阻塞 API。
- **`/metrics` / `/alerts`**: 前端數據出口。從記憶體快取或 MongoDB 提取狀態供 Next.js (Port 9001) 使用。

### 2. 廚房後場 (Background Workers)
- **Kafka Consumer**: 背景監聽 `telemetry` Topic，進行數據解碼、AI 異常分析、並寫入資料庫。
- **Simulation Worker**: 在模擬模式下，自動產生隨機的伺服器負載數據與突發異常。

---

## 🤖 第二部分：智慧預警與 AI 演算法

### 1. 雙重存儲機制 (Hybrid Storage)
- **InfluxDB (8087)**: 存儲時序數值（溫度、CPU），供前端繪製歷史曲線。
- **MongoDB (27018)**: 存儲系統告警（Alerts），記錄異常發生時間、類型與伺服器 ID。

### 2. AI 異常檢測 (Anomaly Detection)
- **滑動視窗 (Sliding Window)**: 紀錄伺服器最近 5 次的歷史數值。
- **演算法**: 若當前 CPU 超過 60% 且高於歷史平均 **1.5 倍**，則判定為 `AI_ANOMALY` 並觸發告警。

---

## ⚙️ 第三部分：1150325 連線配置 (Connection Settings)

**重要：為避免本地環境衝突，所有服務連接埠已進行偏移。**

| 服務項目 | 內部連接埠 | 外部映射埠 (Host) |
| :--- | :--- | :--- |
| **FastAPI Backend** | 9000 | **9000** |
| **MongoDB** | 27017 | **27018** |
| **InfluxDB** | 8086 | **8087** |
| **Kafka (Broker)** | 29092 | **29093** |
| **Zookeeper** | 2181 | **2182** |

---

## 🛠️ 第四部分：開發環境啟動

### 1. 依賴安裝
```bash
cd backend
pip install -r requirements.txt
```

### 2. 啟動指令 (Uvicorn)
```bash
uvicorn main:app --host 127.0.0.1 --port 9000 --reload
```

### 3. 常見問題 (FAQ)
- **Q: 為什麼顯示連不上 MongoDB？**
  請確認已在 `main.py` 配置 `mongodb://admin:adminpassword@localhost:27018/`。
- **Q: 數據沒更新？**
  請確認後端視窗是否顯示 `Kafka Consumer started and polling...`，這代表後處理執行緒已就緒。

---
*文件更新日期：2026-03-25 (1150325 修訂版)*
