# DataCenter 環境混合開發策略及效能優化 (1150325)

本文件說明目前專案採用的混合式開發模式，以及在 Windows + Docker Desktop 環境下的實務注意事項。

---

## 1. 混合開發策略

### 1.1 容器內執行的基礎設施

目前以 Docker 啟動的服務包含：

- Kafka
- ZooKeeper
- InfluxDB
- MongoDB
- Redis
- Mailpit
- Grafana

原因：

- 降低本機安裝與版本衝突
- 讓資料層環境一致
- 便於重建與清空測試資料

### 1.2 主機上執行的應用層

目前在本機直接執行：

- FastAPI 後端
- Next.js 前端
- `client_agent.py`

原因：

- 保留熱重載與開發效率
- 方便直接除錯
- Agent 需要更接近真實作業系統與硬體環境

---

## 2. 目前開發環境要點

- 作業系統：Windows
- Docker Desktop：必須先就緒
- Node.js：`>= 20.9`
- Python：`>= 3.10`

對外常用埠：

- Frontend：`9001`
- Backend：`9000`
- MongoDB：`27018`
- InfluxDB：`8087`
- Kafka：`29093`
- Grafana：`3002`

---

## 3. 效能與穩定性建議

### 3.1 WSL2 / Docker 資源控制

若本機使用 WSL2，建議限制 Docker 可用資源，避免背景容器吃滿記憶體。

### 3.2 前端記憶體控制

`start.bat` 已包含前端啟動流程；若 Next 開發模式記憶體過高，可視情況調整 `NODE_OPTIONS`。

### 3.3 連接埠偏移策略

本專案刻意避開常見預設埠：

- MongoDB：`27018`
- InfluxDB：`8087`
- Kafka：`29093`
- Grafana：`3002`

這有助於避免與本機其他資料服務衝突。

---

## 4. 建議啟動順序

1. 確認 Docker Desktop 已就緒
2. 啟動 `docker compose up -d`
3. 啟動後端 `9000`
4. 啟動前端 `9001`
5. 再開始真機 Agent 或模擬資料測試

---

## 5. 常見問題

### Docker 已啟動但系統仍無資料

請先檢查：

- Kafka 是否正常
- 後端是否成功啟動 consumer
- 前端是否正確連向 `9000`

### 前端開發模式卡頓

可優先檢查：

- `.next` 快取
- Docker / WSL2 記憶體佔用
- 是否同時開啟過多終端與熱重載程序

---

*文件更新日期：2026-04-21*
