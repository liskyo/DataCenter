# DataCenter 整體架構及開發環境與流程指南

本文件旨在為新進開發者、維運工程師 (DevOps) 以及系統架構師提供一份**最詳盡且淺顯易懂**的專案入門手冊。
請依照本文件的指引，逐步了解「資料中心監控系統 (DataCenter Monitoring System)」的全貌。

---

## 🌟 第一部分：專案總覽與設計理念 (Project Overview)

### 1. 什麼是 DataCenter Monitoring System？
這是一套專門用來監控大型伺服器機房（Data Center）的現代化軟體系統。想像一下電影中那些充滿螢幕、亮著各種科技圖表的「戰情室」，我們這套系統就是在做這件事！
它能夠：
- **每秒 (Real-time)** 接收數以千計伺服器的「心跳」（如：CPU 溫度、系統負載）。
- **自動過濾與報警**：當某台伺服器溫度飆高時，不需要人工盯著看，系統會自動在終端機或聊天軟體（如 Discord/Slack）發出警報！
- **AI 智慧檢測**：除了死板的設定「超過 40 度就報警」之外，系統內建 AI 演算法，能判斷一台平時只有 10% 負載的機器，如果突然飆升到 50% 究竟是不是異常。

### 2. 為什麼要拆分成這麼多模組？ (微服務架構的優點)
新手可能會問：「為什麼不直接寫一個簡單的網頁加上一個 MySQL 資料庫就好？」
因為在真實的機房中，一秒鐘可能有數萬筆資料湧入，如果只用一個系統來扛，伺服器會立刻當機。因此我們採用了**雲原生微服務架構 (Cloud-Native Microservices)**：
- **各司其職**：Kafka 負責接客（收資料），InfluxDB 負責記帳（存數據），FastAPI 負責思考（算 AI），Next.js 負責畫畫（給客人看）。
- **不會一垮全垮**：如果前端網頁當機了，後端收集數據的腳步完全不會停止。這對工業級系統來說是保命的關鍵。

---

## 🏗️ 第二部分：系統巨觀架構 (Macro-Architecture)

本系統的核心運作軌跡，可以想像成一條「精密加工的生產線」，並拆分為四大核心群集：

### 1. 訊息分發層 (Message Broker) : 緩衝區設計
- **核心主角：Apache Kafka + Zookeeper**
- **淺顯比喻**：Kafka 就像是機房入口處的「超級大郵筒」。所有的感測器 (Sensors) 都盲目地把數據信件塞進這個郵筒。它能確保信件絕不遺失，且一秒鐘能吞吐百萬封信。即使後端處理信件的員工去上廁所了，信件依然會乖乖排在郵筒裡。

### 2. 後端服務層 (Backend API & Workers) : 智慧大腦
- **核心主角：FastAPI (Python)**
- **淺顯比喻**：郵差把 Kafka 裡的信件拿出來，交給 Python 員工。Python 員工會看信：「哦！這台機器 80 度了！立刻發警告信給老闆！」同時，他還會把這份數據抄寫兩份，一份送到檔案室 (InfluxDB)，一份送到異常紀錄清單 (MongoDB)。

### 3. 巨量數據儲存層 (Data Persistence) : 異質雙庫
- **核心主角：InfluxDB + MongoDB**
- **淺顯比喻 (InfluxDB)**：專門用來畫折線圖的「流水帳」。它只看重時間與數字，存取極快！
- **淺顯比喻 (MongoDB)**：專門用來放「結案報告」的資料夾。當異常發生時，我們把完整的事件包含人、事、時、地、物存放在這裡，方便未來主管查閱。

### 4. 前端展示層 (Frontend Viewer) : 最終畫板與編輯介面
- **核心主角：Next.js + TailwindCSS v4 + Zustand (LocalStorage)**
- **淺顯比喻**：給長官看的高科技面板 (Cyberpunk SCADA介面)。除了每秒向 Python 大腦拿取最新數據之外，它還內建了一套**「編輯模式 (Edit Mode)」**，讓管理員可以隨意拖拉架設機房平面圖，並且自動存進瀏覽器的空間中，提供 F5 不洗白的持久化體驗。

---

## 💻 第三部分：開發環境與依賴 (Development Environment)

要讓這套龐大的系統跑在你的私人電腦上，你需要準備以下武器庫：

### 必備軟體清單
1. **作業系統 (OS)**：嚴格推薦在 Windows 環境使用 PowerShell 或是 CMD 終端機進行操作。
2. **容器化引擎 (Docker Desktop)**：
   - 為什麼需要？因為我們不想在你的電腦上安裝繁瑣的 Kafka、MongoDB 伺服器軟體。Docker 可以一鍵把這些軟體像「虛擬機」一樣跑起來，乾淨又衛生。
   - 確認 Docker 在背景常駐運行且顯示綠色小亮點。
3. **Node.js (v20+ 版本)**：
   - 負責執行前端 Next.js 網頁與下載 NPM 套件。
4. **Python (3.10+ 版本)**：
   - 負責執行後端的 AI 演算法與 FastAPI。

### 檔案資料夾結構預覽
```text
DataCenter/
┣ backend/                # 👉 後端 Python 程式碼專區
┃ ┣ main.py               # (核心大腦)
┃ ┣ mock_sensor_data.py   # (假裝自己是感測器的小程式)
┃ ┗ requirements.txt      # (Python 依賴包名單)
┣ frontend/               # 👉 前端 Next.js 程式碼專區
┃ ┣ src/app/              # (各個分頁的路由)
┃ ┣ package.json          # (Node 依賴包名單)
┃ ┗ tailwind.config.ts    # (UI 樣式配置)
┣ docker-compose.yml      # 👉 教 Docker 該怎麼把資料庫跑起來的指令單
┗ start.bat               # 👉 寫給懶人(包含你我)的一鍵啟動腳本
```

---

## 🚀 第四部分：從零開始！系統一鍵啟動流程 (Step-by-Step Workflow)

第一次拿到專案該怎麼辦？別擔心，跟著以下詳細步驟操作，保證 5 分鐘內看見酷炫的監控面板。

### 步驟一：讓基礎設施 (資料庫) 甦醒
專案根目錄中配置了 `start.bat` 一鍵啟動腳本。
如果你喜歡手動來，請打開 PowerShell，進入專案目錄，輸入：
```bash
docker-compose down
docker-compose up -d
```
> **發生什麼事？** 
> 系統會自動下載 Kafka、Zookeeper、InfluxDB、MongoDB 的映像檔，並在背景 (`-d`) 靜默啟動。你可以打開 Docker Desktop 視窗，看到它們綠色亮起就代表成功了！

### 步驟二：啟動後端心臟 (Python API)
再次打開一個全新的 PowerShell 視窗：
1. 切換目錄： `cd backend`
2. 安裝裝備： `pip install -r requirements.txt` (這會安裝 FastAPI 等必備套件)
3. 點火啟動： `uvicorn main:app --host 0.0.0.0 --port 9000 --reload`
> **發生什麼事？** 
> 你會看到螢幕上印出 `Kafka Producer initialized successfully` 的綠字。此時，伺服器大腦已經在 `localhost:9000` 待命了。

### 步驟三：啟動高科技前端面板 (Next.js)
再開第三個全新的 PowerShell 視窗：
1. 切換目錄： `cd frontend`
2. 安裝裝備： `npm install` (會自動把 Tailwind 等酷炫裝備下載回來)
3. 點火啟動： `npm run dev -p 9001`
> **發生什麼事？** 
> 網頁伺服器啟動成功。現在請打開你的瀏覽器，輸入網址：`http://localhost:9001`。
> 你會看到全黑的科幻 UI，但目前數字全都是空的，因為機房還沒有資料進來！

### 步驟四：發送模擬數據 (Simulate Sensors)
再開第四個全新的 PowerShell 視窗：
1. 切換目錄： `cd backend`
2. 啟動模擬器： `python mock_sensor_data.py`
> **發生什麼事？** 
> 恭喜！這個腳本會假裝自己是 10 台伺服器，瘋狂向後端吐出溫度與 CPU 數值。
> 現在切換回你的瀏覽器 `http://localhost:9001`，折線圖開始跳動，紅色告警開始閃爍，一切大功告成！

---

## 🛠️ 常見問題與除錯手冊 (FAQ & Troubleshooting)

**Q1：為什麼我執行 `docker-compose` 時出現 `port is already allocated` 錯誤？**
> **解答**：這代表你的電腦上已經有其他程式（可能你自己裝過 MySQL 或 MongoDB）佔用了該 Port (`27017` 或 `8086`)。請打開工作管理員，把本地的資料庫服務關閉，將舞台讓給 Docker。

**Q2：後端 FastAPI 視窗閃現一大串紅字 `NoBrokersAvailable`？**
> **解答**：這通常代表 Docker 重啟太慢，Kafka 還在夢鄉，但 Python 程式已經醒來急著要連線了。系統內部有撰寫重試機制 (Retry Model)，你只要耐心等個 30 秒，通常它自己會重新連上。若真的不行，在終端機按下 `Ctrl+C` 再重開一次後端即可。

**Q3：前端網頁呈現空白 404 或樣式跑版？**
> **解答**：這通常是因為 Tailwind CSS v4 的緩存問題。請在 frontend 資料夾中，手動刪除隱藏的 `.next` 資料夾，接著重新執行 `npm run dev -p 9001`，保證煥然一新。

**Q4：我想關閉所有系統去追劇了，該怎麼做？**
> **解答**：
> 1. 到所有運行中的終端機視窗，瘋狂按下 `Ctrl+C` 強制中止小黑窗。
> 2. 下 `docker-compose down` 指令把佔用記憶體的虛擬機資料庫全數關閉收工。
