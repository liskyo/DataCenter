# DataCenter 整體後端架構及開發環境與流程指南

本文件將帶領開發者深入拆解「資料中心監控系統」的大腦——**後端架構 (Backend Architecture)**。
後端扮演著承先啟後的核心角色，不僅要能承受每秒上千筆的資料湧入，還必須具備即時運算的 AI 決策能力。本指引將力求簡單易懂，即便是剛接觸 Python 的初學者也能掌握其設計精髓。

---

## 🧠 第一部分：後端架構設計大解密

我們使用的後端框架是 **FastAPI (Python)**。
為什麼選 Python？因為在做 AI 演算法、數據清洗時，Python 的生態系天下無敵。
為什麼選 FastAPI？因為它主打**非同步 (Asynchronous)** 特性，當幾萬筆資料湧入時，它不會傻傻地處理完一筆才接下一筆，而是能同時應付大量的連線請求。

### 為何沒有變成效能瓶頸？ (Architecture Split)
這是一個非常重要的概念！為了確保 API 本身不被拖垮，我們把後端拆成了「**接單台 (API 層)**」與「**廚房 (Workers 層)**」兩部分。

1. **接單台 (RESTful API 端點)**
   - 負責直接面向前端或感測器。
   - `POST /ingest`：感測器發送最新 CPU 與溫度資料的入口。接單台收到資料後，**不做任何運算判斷！** 直接把它塞給 Kafka (訊息序列) 然後秒回 `OK` 給感測器，確保資料不塞車。
   - `GET /metrics`：前端面板請求即時狀態，API 直接從記憶體 (Python Dict) 中拔出最新數據回傳。
   - `GET /alerts`：前端面板想看過往告警，API 直接去 MongoDB 撈資料。

2. **廚房後場 (Kafka Consumer Worker 背景執行緒)**
   - 在主程式一啟動時 (`@app.on_event("startup")`)，我們會偷偷開一條背景工作執行緒 (Thread)。
   - 這個執行緒就像是個不知疲倦的工人，無時無刻聽著 Kafka 裡有沒有新資料。
   - 當資料一來，工人會立刻對資料進行：**解碼 -> AI 異常分析 -> 告警判斷 -> 寫入 InfluxDB -> 更新記憶體快取**。一切都在幕後進行，完全不干擾接單台的流暢度。

---

## 🤖 第二部分：核心邏輯與 AI 演算法實作

後端不是只有死死板板地搬磚，我們在 `main.py` 裡面實作了非常強大的商業邏輯與演算法。

### 1. 雙重存儲機制 (Sink to DBs)
後場工人在拿到一筆 `{"server": "SERVER-001", "cpu": 65, "temp": 35}` 資料後：
- 動作一：將數字打包成 `Point("server_metrics")` 物件，打入 **InfluxDB**。
- 動作二：去修改記憶體裡的 `latest_metrics["SERVER-001"]`，讓前端下一次問的時候能拿到最新的數字。

### 2. 智慧預警系統 (Trigger & Webhook Logic)
工人會對溫度資料進行監控檢查：
- **門檻檢查 (Rule-based)**：如果 `temp > 40`，這是非常危險的高溫警報。
- **行動觸發**：系統會立刻呼叫 `trigger_alert()`。它會在終端機假裝打 API 給 Discord/Slack (Webhook 發送中...)，並且將這份詳細告警報告做成 JSON 格式，持久化永久存到 **MongoDB** 內部。

### 3. AI 異常檢測引擎 (Anomaly Detection Engine)
這是本系統最聰明的地方！位於 `detect_anomaly()` 函式。
- 機房的問題往往不是看絕對值，而是看「**變化率**」。
- 我們在記憶體建立了一個滑動視窗 (Sliding Window)，叫做 `server_history`。這個陣列會永遠保存每台伺服器「最近 5 次」的 CPU 紀錄！
- 當第六筆資料進來時，我們算出這台機器過去的**歷史平均負載**。
- **爆發偵測演算法**：如果這台伺服器的最新 CPU > 60%，而且比它過去的歷史平均「**多出 1.5 倍以上**」，AI 就會判定這個數字是不合理的暴衝，並貼上 `AI_ANOMALY` 的紅色標籤直接啟動最高級別告警！

---

## ⚙️ 第三部分：開發環境配置與依賴項

要開發後端，你的電腦就是一座大工廠，請確保工具齊全：

### 必備相依套件 (`requirements.txt`)
- `fastapi` & `uvicorn`: 架設 RESTful API 的黃金組合。
- `kafka-python-ng`: 用於連接 Kafka。為什麼後面有個 `-ng`？因為原版的 kafka-python 年久失修，在 Windows 上會有 C++ 編譯報錯，這是我們為了跨平台相容性特別精選的分支版本！
- `influxdb-client`: 專門處理時序數據寫入。
- `pymongo`: 連接 MongoDB 的最強驅動程式。

### 手把手環境建置教學
1. **打開 PowerShell 並安裝 Python 環境**
   如果您有使用 `conda` 或是 `venv` 虛擬環境的好習慣，強烈建議建立一個乾淨的環境。
   ```bash
   python -m venv venv
   .\venv\Scripts\activate   # 啟動虛擬環境！
   ```
2. **安裝所需依賴清單**
   確保依賴安裝無誤：
   ```bash
   pip install -r requirements.txt
   ```
3. **檢查 Docker 背景服務**
   後端程式一跑起來就會去敲 Kafka 跟 InfluxDB 的門。請確保 Docker 已經把那些基礎服務準備好了 (`docker-compose up -d`)。

---

## 🏃 第四部分：維運流程與開發除錯 (How to Run & Debug)

### 啟動與自動重啟機制
開發階段，我們最怕改一行程式碼就要重新啟動伺服器。因此我們使用 `--reload` 參數：
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
只要加上 `--reload`，當你在 VSCode 裡面編輯 `main.py` 並按下 `Ctrl+S` 存檔時，Uvicorn 監視器會瞬間發現變動，並在不到 0.01 秒的時間內自動重新啟動後端，大幅提昇開發體驗。

### 常見問題與除錯手法
**Q1：為什麼終端機一直跳 `pymongo.errors.ServerSelectionTimeoutError`？**
> **解答**：不要慌，這代表你的 Python 連不上 `localhost:27017` 的 MongoDB。
> 步驟一：檢查 Docker 裡的 MongoDB 是不是當掉了？
> 步驟二：檢查密碼是不是改錯了？(在 `docker-compose.yml` 裡面預設是 `root` / `example`)

**Q2：我要怎麼手動測試接單台 (API) 有沒有活著？**
> **解答**：FastAPI 最棒的特點就是內建 Swagger UI！
> 只要在瀏覽器打開網址 `http://localhost:8000/docs`。你會看到一個精美的圖形化介面。
> 找到 `/metrics` 點擊 **Try it out** -> **Execute**。你就能馬上看到後端傳回來的最純粹的 JSON 資料，這是釐清「到底是後端沒給資料，還是前端 Next.js 寫錯撈不到」的最快分辨方法！

**Q3：AI 異常預警的 1.5 倍標準覺得太敏感，我想調整？**
> **解答**：非常簡單。到 `backend/main.py` 找到 `detect_anomaly()` 函式。將 `threshold = 1.5` 改成 `2.0`。存檔。伺服器自動重載，設定就生效了。這個設計能讓維運工程師在不更動架構的情況下，無痛微調警報靈敏度。
