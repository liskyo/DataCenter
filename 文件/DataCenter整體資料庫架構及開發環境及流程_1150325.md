# DataCenter 整體資料庫架構及開發環境及流程指南 (1150325)

本文件說明目前專案的資料儲存架構與實際連線資訊，內容以 `docker-compose.yml` 與 `backend/services/storage_service.py` 現況為準。

---

## 1. 儲存架構總覽

本系統採用分工式儲存：

- `Kafka`：事件匯流排與緩衝層
- `InfluxDB`：時序資料
- `MongoDB`：告警、使用者、維運等文件資料
- `Redis`：SSE 事件傳遞輔助
- `LocalStorage / IndexedDB`：前端局部狀態保存

---

## 2. 主要資料流

```text
Telemetry payload
   -> /ingest
   -> Kafka(topic: telemetry)
   -> Consumer / Processing
   -> InfluxDB(server_metrics)
   -> MongoDB(alerts / maintenance / users)
   -> SSE to frontend
```

資料分工如下：

- 高頻數值與趨勢查詢放在 InfluxDB
- 事件、告警、帳號、維運資料放在 MongoDB
- Redis 不作為主要業務資料庫，而是即時事件通道輔助

---

## 3. 連線資訊

### 3.1 MongoDB

- Host：`localhost`
- Port：`27018`
- Auth DB：`admin`
- 主要 DB：`datacenter`

常見集合：

- `alerts`
- `users`
- `maintenance_schedules`

### 3.2 InfluxDB

- URL：`http://localhost:8087`
- 主要 bucket：`telemetry`
- 常見 measurement：`server_metrics`

常見欄位：

- `temperature`
- `cpu_usage`

常見 tag：

- `server_id`

### 3.3 Kafka

- Host Port：`29093`
- Topic：`telemetry`

### 3.4 其他基礎服務

- ZooKeeper：`2182`
- Redis：`6379`
- Grafana：`http://localhost:3002`
- Mailpit：`http://localhost:8025`

---

## 4. 資料模型摘要

### 4.1 InfluxDB

適合：

- CPU、溫度、流量、壓力等連續型指標
- 歷史走勢與圖表查詢

### 4.2 MongoDB

適合：

- 告警事件
- 使用者資料
- 維護排程
- 通知與稽核資料

### 4.3 前端本地儲存

前端部分狀態會保存在本地：

- 版面與操作狀態
- 某些互動設定或快取資料

這些資料不等同後端正式資料來源，文件應避免混淆。

---

## 5. 常用操作

### 啟動基礎設施

```bash
docker compose up -d
```

### 重建資料環境

```bash
docker compose down -v
docker compose up -d
```

注意：`down -v` 會刪除卷宗資料，僅適用於開發或測試重置。

---

## 6. 文件同步注意事項

- 舊版文件若仍寫 `MongoDB 27017`、`InfluxDB 8086`、`Kafka 29092`，請視為過時描述；目前對外埠已偏移為 `27018`、`8087`、`29093`
- `.env.example` 仍可見部分與實際容器不完全一致的設定，部署前應先核對程式與 compose
- 專案目前沒有主 compose 中的 Postgres 正式資料路徑，若文件提到 Postgres 主資料庫，應另行確認是否屬外部或舊規劃

---

*文件更新日期：2026-04-21*
