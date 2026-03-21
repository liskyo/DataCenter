# DataCenter Command Center 系統 🚀

這是一個全棧（Full-stack）監控儀表板專案，包含前端（Next.js）、後端（Python FastAPI）、以及多個容器化資料庫服務（Kafka, MongoDB, InfluxDB）。

為了確保系統各個微服務能互相串接與成功拉取資料，**第一次啟動前，請務必詳細閱讀以下注意事項**。

---

## 🛠️ 1. 環境必備條件 (Prerequisites)

在執行專案前，你的電腦必須已經安裝好以下環境，**缺一不可**：

1. **Docker Desktop**
   - 用於啟動資料庫與訊息佇列 (Kafka, MongoDB, InfluxDB, Grafana)。
2. **Node.js (>= 20.9.0)**
   - Next.js 15+ 強制要求 Node.js 版本大於 20。若版本過低（如 18.x），前端編譯會直接報錯中斷。
   - 建議使用 `nvm` 或安裝官方最新 LTS 穩定版。
3. **Python 3.10+**
   - 用於啟動 FastAPI 與數據模擬生成器。

---

## ⚡ 2. 啟動步驟 (How to Start)

1. **【最重要的一步⚠️】開啟你的 Docker Desktop**
   - 請檢查 Windows 右下角常駐列，確保 Docker 的鯨魚圖示是綠色 (`Engine running`)。
   - 如果 Docker 沒開，後續資料庫與 Kafka 將全部啟動失敗。

2. **點擊執行 `start.bat`**
   - 雙擊專案目錄下的 `start.bat` 檔案。
   - 執行後會自動跳出額外的終端機視窗，分別處理：
     - `docker-compose up -d` (容器啟動)
     - `Backend: 8000` (Python FastAPI 啟動)
     - `Frontend: 3001` (Next.js 啟動)

3. **進入系統**
   - 啟動完成後，在瀏覽器打開：[http://localhost:3001](http://localhost:3001)

---

## 🚑 3. 常見問題與疑難排解 (Troubleshooting)

### Q1: 畫面中間一直顯示「AWAITING VITAL SIGNALS...」，兩側圖表是空的？
- **原因**：你的 **Docker 沒有啟動**，或者 Kafka 容器掛掉了。
- **原理**：這套系統的模擬數據 (Simulation) 完全依賴 Kafka。如果後端連不上 Kafka，它就會停止發送模擬數據，導致前端收不到資料而呈現空畫面。
- **解法**：關閉所有終端機畫面，打開 **Docker Desktop** 並確認運作中，再重新執行 `start.bat`。

### Q2: 終端機顯示 `Node.js version ">=20.9.0" is required`
- **原因**：目前使用的 Node.js 版本過舊。
- **解法**：去 Node.js 官網下載安裝最新的 LTS 版本 (>= 20)，安裝完畢後，**務必重開終端機或電腦**讓環境變數生效，再啟動專案。

### Q3: 終端機紅字顯示 `uvicorn 不是內部或外部命令`
- **原因**：Python 環境並沒有將 `Scripts` 路徑加入系統環境變數中，導致找不到這個執行檔。
- **解法**：`start.bat` 之中已改成使用 `python -m uvicorn` 繞過此限制，若仍出現這類模組找不到的報錯，請確認是否有安裝好 Python(`pip install -r requirements.txt`) 或手動啟用虛擬環境。

### Q4: 瀏覽器 F12 控制台報錯 `ERR_CONNECTION_REFUSED http://localhost:8000...`
- **原因**：前端 Next.js 啟動速度比 Python 後端快，提早去拿資料卻發現對方還沒準備好。
- **解法**：這是正常的。只要等另一個命名為 `Backend` 的黑色小視窗載入完成不再報錯，前端的連線警告就會自己消失並出現資料。

---
> *Tip: 如果你想要直接進入開發的除錯儀表板，也可以訪問 [http://localhost:3000](http://localhost:3000) 進入 Grafana。*
