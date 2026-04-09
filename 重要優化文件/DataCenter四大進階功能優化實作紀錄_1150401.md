# DataCenter 四大進階功能優化實作紀錄

**日期：** 115/04/01 (2026/04/01)
**專案：** DataCenter 3D Digital Twin — 混合監控架構進階功能
**驗證狀態：** ✅ 全部通過測試

---

## 一、SSE 即時推送 (Server-Sent Events)

### 問題背景
原本前端使用 `usePolling` 每 5 秒輪詢一次 `/metrics` 端點，Data 延遲最長達 5 秒，且每次請求都是浪費資源的 HTTP Full Round-Trip。

### 解決方案
導入 **Server-Sent Events (SSE)** 單向推播架構：Agent 推送數據到後端後，後端立即廣播給所有已連線的前端 Tab，延遲降低至毫秒級別。

### 新增/修改檔案

| 檔案 | 類型 | 說明 |
|------|------|------|
| `backend/services/sse_manager.py` | 新增 | SSE 廣播管理器：每個前端連線對應一個 `asyncio.Queue`，`broadcast()` 將數據推送到所有佇列 |
| `backend/routers/telemetry.py` | 修改 | 新增 `GET /stream` 端點，使用 `StreamingResponse` 持續輸出 `text/event-stream` |
| `backend/core/container.py` | 修改 | 在 `process_message()` 最後呼叫 `sse.broadcast(data)` |
| `frontend/src/shared/hooks/useSSE.ts` | 新增 | 前端 SSE hook，連線失敗時自動降級 (Fallback) 為 Polling 模式 |
| `frontend/src/app/page.tsx` | 修改 | 移除 `usePolling`，改用 `useSSE`；標題列加入 **SSE LIVE / POLLING** 連線狀態指示燈 |

### 架構示意
```
Agent ──→ POST /ingest ──→ Kafka ──→ process_message() ──→ sse.broadcast()
                                                                  │
                                              前端 EventSource ←──┘
                                          (即時渲染，無需等待輪詢)
```

### 驗證方式
- 進入 Dashboard，右上角出現 **🟢 SSE LIVE** 綠色指示燈即代表成功
- 若 SSE 斷線，自動切為 **🟡 POLLING** 並繼續正常顯示數據

---

## 二、DLC 液冷遙測擴充 (Direct Liquid Cooling Telemetry)

### 問題背景
原本 Agent 僅透過 `psutil` 抓取 OS 層級的 CPU 使用率與溫度。對於配備 DLC (Direct Liquid Cooling) 或 CDU (Coolant Distribution Unit) 的高密度機架，真正的熱管理關鍵指標（進出水溫、流量、壓力）完全缺失。

### 解決方案
擴充 Agent 支援 `--mode dlc`，新增液冷感測器數據採集（目前為模擬，預留 Modbus TCP 真實 PLC 接口）。

### 新增欄位

| 欄位 | 單位 | 說明 |
|------|------|------|
| `inlet_temp` | °C | 冷卻液進水溫度 |
| `outlet_temp` | °C | 冷卻液出水溫度 |
| `flow_rate_lpm` | LPM | 冷卻液流量（升/分鐘）|
| `pressure_bar` | bar | 系統水壓 |
| `pump_rpm` | RPM | 水泵轉速 |
| `valve_position` | % | CDU 閥門開度 |

### 連線預留 (Modbus TCP / PLC)
```python
# 未來連接 PLC 時，取消以下註解：
# from pymodbus.client import ModbusTcpClient
# client = ModbusTcpClient('192.168.1.200', port=502)
# result = client.read_holding_registers(0, 6, slave=1)
# inlet_temp = result.registers[0] / 10.0
```

### 告警閾值

| 類型 | 條件 | 告警代碼 |
|------|------|---------|
| 進水高溫 | `inlet_temp > 35°C` | `DLC_INLET_HIGH` |
| 出水高溫 | `outlet_temp > 50°C` | `DLC_OUTLET_HIGH` |
| 流量不足 | `flow_rate_lpm < 3.0` | `DLC_LOW_FLOW` |
| 壓力過高 | `pressure_bar > 3.5` | `DLC_HIGH_PRESSURE` |

### 啟動指令
```bash
# 標準模式（僅 CPU + 溫度）
python client_agent.py --server-id SERVER-015

# DLC 液冷模式
python client_agent.py --server-id CDU-001 --mode dlc
```

### 驗證結果 (實測)
```json
{
  "server_id": "CDU-001",
  "cpu_usage": 11.6,
  "temperature": 39.64,
  "inlet_temp": 23.2,
  "outlet_temp": 37.4,
  "flow_rate_lpm": 8.1,
  "pressure_bar": 1.9,
  "pump_rpm": 3180,
  "valve_position": 96
}
```

---

## 三、硬體安全互斥鎖 (Safety Interlocks)

### 問題背景
原本 `/api/control/{id}/power` 可以不加任何判斷地對任意設備下達開機/重啟指令。若設備正處於高溫、漏水或液冷系統失效狀態下強制重啟，可能造成設備損毀。

### 解決方案
在 `control.py` 中實作 **5 層 Interlock 安全閘**，任何一項觸發即回傳 `HTTP 423 Locked` 並阻擋指令執行。

### Interlock 規則一覽

| 項目 | 觸發條件 | 封鎖動作 |
|------|---------|---------|
| CPU 高溫 | `temperature > 70°C` | `on`, `reboot` |
| DLC 出水過熱 | `outlet_temp > 60°C` | 全部 |
| 液冷流量不足 | `flow_rate_lpm < 2.0 LPM` | `on`, `reboot` |
| 系統高壓 | `pressure_bar > 4.0 bar` | 全部 |
| 漏水告警 | `dlc_alert == "Leak Detected"` | 全部 |

### 回傳格式 (觸發時)
```json
HTTP 423 Locked
{
  "locked": true,
  "server_id": "CDU-001",
  "action_requested": "reboot",
  "interlock_reason": "Coolant flow rate critically low (<2.0 LPM). Power-on is locked to prevent thermal runaway."
}
```

### 驗證方式
- 正常狀態：控制指令正常通過，回傳 `{"status": "success", ...}`
- 危險狀態：回傳 HTTP 423，前端可解析 `interlock_reason` 顯示鎖定原因

---

## 四、JWT 身份驗證與 RBAC 權限控管

### 問題背景
- `/ingest` 端點完全公開，任何人都可偽造數據注入系統
- `/api/control` 端點完全公開，任何人都可觸發 Redfish 電源控制指令
- 無任何身份驗證或操作審計機制

### 解決方案
實作基於 **JWT (JSON Web Token)** 的身份驗證，搭配 **RBAC (Role-Based Access Control)** 三層角色權限模型。

### 新增檔案

| 檔案 | 說明 |
|------|------|
| `backend/core/auth_middleware.py` | JWT 簽發/驗證、RBAC 依賴注入、API Key 驗證 |
| `backend/routers/auth.py` | `POST /api/auth/login` 登入端點 |

### 角色權限矩陣

| 角色 | 帳號 | 認證方式 | 可用操作 |
|------|------|---------|---------|
| `admin` | admin | JWT Bearer Token | 完整控制（控制面板、設備管理） |
| `operator` | operator | JWT Bearer Token | 僅讀取監控數據 |
| `agent` | — | API Key Header | 僅能上傳遙測數據至 `/ingest` |

### API Key（Agent 認證）
Agent 在每次 POST 請求中帶入 Header：
```
X-API-Key: dc-agent-key-2026
```

### 登入流程
```
POST /api/auth/login
Body: {"username": "admin", "password": "admin123"}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "admin",
  "name": "系統管理員",
  "username": "admin"
}
```

Token 有效期：**24 小時**

### 驗證結果 (實測)
```bash
# 成功取得 JWT Token，role: admin 正確
{"token":"eyJhbG...","role":"admin","name":"系統管理員","username":"admin"}
```

---

## 五、start.bat 一鍵啟動更新

更新 `start.bat` 為 4 步驟啟動流程：

| 步驟 | 服務 | 視窗標題 |
|------|------|---------|
| 1/4 | Docker (Kafka / InfluxDB / MongoDB / Grafana) | — |
| 2/4 | FastAPI 後端 (port 9000) | Backend |
| 3/4 | Next.js 前端 (port 9001) | Frontend |
| 4/4 | Agent SERVER-015 (標準) + CDU-001 (DLC) | Agent-SERVER-015 / Agent-CDU-001 |

> 後端啟動後自動等待 3 秒再啟動 Agent，確保 API 完全就緒。

---

## 六、依賴套件更新

`backend/requirements.txt` 新增：

```
psutil==5.9.8    # Agent OS 指標採集
PyJWT==2.12.1    # JWT Token 簽發與驗證
```

---

## 七、快速驗證 SOP

```powershell
# 1. 確認 DLC 液冷數據
(Invoke-WebRequest "http://127.0.0.1:9000/metrics" -UseBasicParsing).Content | ConvertFrom-Json | Select-Object -ExpandProperty data | Where-Object { $_.server_id -eq "CDU-001" } | ConvertTo-Json

# 2. 測試控制指令（正常應通過）
Invoke-WebRequest -Method POST "http://127.0.0.1:9000/api/control/SERVER-015/power" -ContentType "application/json" -Body '{"action": "reboot"}' -UseBasicParsing | Select-Object -ExpandProperty Content

# 3. 取得 JWT Token
Invoke-WebRequest -Method POST "http://127.0.0.1:9000/api/auth/login" -ContentType "application/json" -Body '{"username": "admin", "password": "admin123"}' -UseBasicParsing | Select-Object -ExpandProperty Content
```

> **備忘：** 若 Terminal 出現中文亂碼，執行 `chcp 65001` 後重試。
