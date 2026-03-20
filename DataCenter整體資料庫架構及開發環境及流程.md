# DataCenter 整體資料庫架構及開發環境與流程指南

資料庫是整套系統的記憶體與根基所在。這份文件是讓 DBA (資料庫管理員) 或後端工程師了解我們如何建構**「無鎖 (Lock-free)、高寫入吞吐量、無痛橫向擴展」**的混合式架構 (Polyglot Persistence) 的教學手冊。

---

## 🏛️ 第一部分：為什麼我們需要三種資料庫？

在傳統的小型網站中，我們可能只需安裝一套 MySQL 就能包打天下。
但在 IoT 或 DataCenter 等這類「每一秒都有新數據噴出來」的嚴苛環境下，把所有資料全塞給 MySQL，硬碟很快就會死機。我們必須要**拆分職責**：

1. **讓 Apache Kafka 當「快遞集運中心」** —— 接包裹極快。
2. **讓 InfluxDB 當「流水帳本」** —— 寫下純數字與時間極快。
3. **讓 MongoDB 當「檔案室」** —— 存下格式複雜、長度不一的事件報告極其靈活。

這三大天王各自處理它們最拿手的事，這就是我們的資料庫架構哲學。

---

## 🚂 第二部分：資料庫三巨頭大解密

### 1️⃣ Apache Kafka (高速事件傳輸骨幹)
#### **它在做什麼？**
Kafka 就像是高速公路上的交流道。所有的感測器 (Sensors) 只要一股腦兒地把包含溫度的 JSON 塞給它就好。
- **解耦的魔力**：感測器不需要知道後端是死是活，它只管傳進去。如果後端當機重啟，後端只要問 Kafka：「我剛處理到哪封信了？」Kafka 就會繼續把接下來的信吐給後端，這保證了**資料一滴都不會丟失**。

#### **如何設定與運作：**
- **Docker 映像檔**: 使用的是 `wurstmeister/kafka` 搭配 `wurstmeister/zookeeper`。這組映像檔針對 Windows Docker Desktop 非常友善，可以輕易綁定 `localhost` 對外暴露 `9092` 端口。
- **預先開拓道路**：在 `docker-compose.yml` 中，我們設定了啟動參數 `KAFKA_CREATE_TOPICS: "telemetry:1:1"`。這代表 Kafka 啟動時會自動開一條名為 `telemetry` 的主題車道，避免後端一開機找不到車道而報錯。

---

### 2️⃣ InfluxDB (時序資料庫主角 Time-Series DB)
#### **它在做什麼？**
時序資料庫天生為了「帶有時間戳的數據」而生。每一次的 CPU 溫度都是一筆橫列 (Row)，但它對於龐大的時間陣列壓縮優化得非常誇張。
- 如果你要問 MySQL：「請給我過去一個月，每 5 分鐘平均的溫度走勢圖」，MySQL 需要算到天荒地老。
- InfluxDB 只要下達 `aggregateWindow(every: 5m, fn: mean)`，它幾乎在毫秒間就能丟給你。

#### **如何設定與運作：**
- **對外端口**: 監聽於 `8086`。
- **懶人初始化**：為了開發便利配置，我們在 Compose 中硬寫入：
  - User: `admin`
  - Password: `adminpassword`
  - Bucket: `telemetry`
  - Token: `my-super-secret-auth-token`
- **與前端搭配**：目前我們的 Python 後端會把 Kafka 吃到的數字以 `Point("server_metrics")` 寫入。未來我們甚至可以直接使用內建的 Grafana 畫布，免寫程式直接勾選儀表板。

---

### 3️⃣ MongoDB (非關聯文檔歸檔中心 NoSQL)
#### **它在做什麼？**
並不是所有的儲存都只有數字。當發生警報時，我們想要記錄下這句話：
`{"type": "AI_ANOMALY", "message": "SERVER-001 發生不合理的 CPU 暴增，從原本的 10% 瞬間來到 85%，AI 預警判定硬碟即將滿載..."}`。
這種長度不一、可能帶有額外陣列欄位 (Schema-less) 的紀錄，非常適合存進 MongoDB。

#### **如何設定與運作：**
- **對外端口**: 監聽於標準的 `27017`。
- **權限與初始化配置**：
  設定參數了 `MONGO_INITDB_ROOT_USERNAME=root`。
  我們在 Python 後端實作了由 `pymongo` 帶領的 Lazy Instantiation (懶漢載入) 機制。也就是說，Python 第一次接到包含 `AI_ANOMALY` 的紅色警報並呼叫 `.insert_one()` 時，MongoDB 會在記憶體中瞬間動態切出名為 `datacenter` 的資料庫與 `alerts` 集合。一切都是無痕且自動的！

---

## 🛠️ 第三部分：一鍵毀滅與重建維運流程 (How to Operate)

擁有這個完美的貨櫃組合屋系統，最棒的就是它「髒了可以隨時整組換掉」。

### 如何在三分鐘內在你的新電腦啟動叢集？
1. 打開 PowerShell。
2. 確保你的電腦沒有裝其他的 MySQL (確認 Port 不衝突)。
3. 切換到 `DataCenter` 根目錄。
4. 下達魔法指令：
   ```bash
   docker-compose up -d
   ```
5. 泡一杯咖啡，它會自動完成 Zookeeper 選舉 -> Kafka 就緒 -> 兩個 DB 建立 Admin 帳戶的超級組合大招。

### 一切全毀的恐怖重置 (Hard Reset)
當你在開發過程中把資料庫弄得很亂，假資料噴得到處都是，請毫不猶豫地執行：
```bash
docker-compose down -v
```
> **注意這個 `-v` 參數！** 它代表「連同綁定在 Docker Volume 裡的虛擬硬碟一起殺掉」。
此指令一下，你的世界將歸零。再度執行 `up -d` 時，一個純淨無比、宛如新生的開發用資料庫就會還原在你的眼前。這就是現代 DevOps 的浪漫！
