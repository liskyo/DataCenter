# DataCenter 零成本雲端部署全攻略 (初學者友善版)

本指南將帶領你一步步將 DataCenter 專案部署到雲端，完全無需信用卡，適合剛接觸 B2B SaaS 開發的初學者。

---

## 🚀 第一階段：準備基礎設施 (數據中心)

我們需要三個雲端數據庫服務，分別處理：警報儲存、數據串流、以及效能指標。

### 1. MongoDB Atlas (警報與日誌)
- **網址**: [mongodb.com](https://www.mongodb.com/cloud/atlas/register)
- **步驟**:
  1. 註冊後點擊 **Create a Deployment**。
  2. 選擇 **M0 Free** (Shared Cluster)。
  3. **Security**: 
     - 創建一個 `Database User` (記得記住帳號密碼)。
     - 在 **IP Access List** 點擊 `Add Current IP Address` 或輸入 `0.0.0.0/0` (允許所有來源)。
  4. 點擊 **Connect** -> **Drivers** -> 複製 **Connection String**。
     - *範例*: `mongodb+srv://admin:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority`

### 2. Upstash (Kafka 訊息中心)
- **網址**: [upstash.com](https://upstash.com/)
- **步驟**:
  1. 註冊並在 Console 點擊 **Create Cluster**。
  2. 選擇區域 (建議與 Render 同區，如 AWS N. Virginia)。
  3. 下方找到 **REST API** 或 **Details** 頁面，複製 `BROKER_URL`, `USERNAME`, `PASSWORD`。
  4. 點擊 **Topics** 分頁 -> **Create Topic** -> Name: `telemetry`, Partitions: `1`。

### 3. InfluxDB Cloud (時間序列指標)
- **網址**: [influxdata.com](https://www.influxdata.com/)
- **步驟**:
  1. 註冊免費版。
  2. 進入後點擊 **Load Data** -> **Buckets** -> Create Bucket 名為 `telemetry`。
  3. 點擊 **API Tokens** -> Generate API Token (All Access) -> 複製 Token。
  4. 在右上角個人頭像中找到你的 **Org Name**。

---

## 🛠️ 第二階段：部署後端 API (Render)

Render 負責執行你的 Python (FastAPI) 代碼。

1. **GitHub 連動**: 
   - 登入 [Render](https://render.com/)，點擊 **New+** -> **Web Service**。
   - 連接你的 DataCenter GitHub 倉庫。
2. **基本設定**:
   - **Name**: `datacenter-backend`
   - **Runtime**: `Python`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
3. **設定環境變數 (重要)**:
   - 點擊 **Advanced** -> **Add Environment Variable**:
     | Key | Value (來源) |
     | :--- | :--- |
     | `KAFKA_BROKER` | Upstash 的 Broker 網址 |
     | `KAFKA_USERNAME` | Upstash 的 Username |
     | `KAFKA_PASSWORD` | Upstash 的 Password |
     | `MONGO_URI` | MongoDB Atlas 的連結字串 |
     | `INFLUX_URL` | InfluxDB Cloud 的 URL |
     | `INFLUX_TOKEN` | InfluxDB 生成的 Token |
     | `INFLUX_ORG` | InfluxDB 的 Org 名稱 |
     | `INFLUX_BUCKET` | `telemetry` |

---

## 🎨 第三階段：部署前端 UI (Vercel)

Vercel 是目前 Next.js 部署的最佳選擇。

1. 登入 [Vercel](https://vercel.com/)，點擊 **Add New** -> **Project**。
2. 匯入你的 GitHub 倉庫，選擇 `frontend` 資料夾。
3. **Environment Variables**:
   - 加入一個變數：
     - **Key**: `NEXT_PUBLIC_API_URL`
     - **Value**: `https://datacenter-backend.onrender.com` (你的 Render API 網址)
4. 點擊 **Deploy**。

---

## 💡 常見問題與解決方案

### 1. Render 免費版會休眠怎麼辦？
Render 的免費版若 15 分鐘無意人使用會進入「冷啟動」狀態。
**解決方案**: 
- 到 [Cron-job.org](https://cron-job.org/) 註冊一個免費帳號。
- 建立一個 Cron Job，每 10 分鐘請求一次你的 Render URL (例如: `https://.../api/system/mode`)。

### 2. 連接失敗？
請檢查各個資料庫的 **Network Access (Whitelist)**：
- MongoDB 務必設置 `0.0.0.0/0` (Allow access from anywhere)，否則 Render 的服務會被擋掉。

### 3. 如何驗證？
部署成功後，打開 Vercel 提供的網址，如果能看到 3D 機房介面且沒有跳出 API 錯誤，即代表成功！
