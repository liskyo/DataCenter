# DataCenter 整體全端架構及開發環境流程指南 (1150325)

本文件提供前端、後端、資料流與開發環境的整體視角，適合作為新成員閱讀的第一份全端架構摘要。

---

## 1. 全端架構摘要

本系統由四個核心區塊組成：

1. 採集來源：Agent、模擬資料、設備整合
2. 後端入口與處理：FastAPI、背景工作、告警與分析
3. 儲存與中介：Kafka、InfluxDB、MongoDB、Redis
4. 前端展示：Next.js、3D 視覺化、監控與操作頁面

---

## 2. 全端資料主幹

```text
Agent / Device / Simulation
   -> FastAPI /ingest
   -> Kafka telemetry
   -> Backend processing
   -> InfluxDB + MongoDB
   -> SSE / metrics API
   -> Next.js frontend
```

重點：

- 採集端主動上送資料
- Kafka 用於解耦接收與處理
- 前端即時更新依賴 SSE，Polling 為備援

---

## 3. 前端概要

- `Next.js 16.2.0`
- `React 19`
- `Tailwind CSS v4`
- `Recharts`
- `React Three Fiber`
- `zustand`

主要頁面：

- Dashboard
- Analysis
- Control
- Twins
- Maintenance
- Network
- Logs

---

## 4. 後端概要

- `FastAPI`
- `uvicorn`
- `backend/services/*`
- `backend/routers/*`
- `backend/core/container.py`

主要能力：

- `/ingest` 資料入口
- `/stream` SSE 即時推播
- `/metrics`、`/alerts`、`/history` 查詢
- 模擬模式與維護排程
- 通知、告警與異常分析

---

## 5. 開發環境

必要條件：

- Docker Desktop
- Node.js `>= 20.9`
- Python `>= 3.10`

常用埠：

- Frontend：`9001`
- Backend：`9000`
- MongoDB：`27018`
- InfluxDB：`8087`
- Kafka：`29093`
- Grafana：`3002`

---

## 6. 啟動方式

### 一鍵啟動

執行 `start.bat`

### 手動啟動

```bash
docker compose up -d
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 9000 --reload
cd frontend
npm run dev -- -p 9001
```

---

## 7. 與舊版差異

相較於早期教學式文件，現況需特別注意：

- 前端版本已升至 Next 16
- 即時通道是 SSE，不是 WebSocket
- 對外埠已採偏移配置
- Redfish / SNMP / gNMI 等多協定描述需區分「現況已實作」與「設計/預留」

---

*文件更新日期：2026-04-21*
