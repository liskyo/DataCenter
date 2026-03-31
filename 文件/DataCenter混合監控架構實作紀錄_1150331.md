# DataCenter 頻內與頻外混合監控架構實作紀錄

**日期:** 2026-03-31 (1150331)

## 異動摘要設定 (Commit Message Summary)
**Feat:** 實作頻內擷取器 (Client Agent) 與 Redfish 頻外硬體控制 (OOB Control API)

---

## 架構設計理念 (Architecture Concept)
本次更新借鏡了 CDU 與現代機房管理文件中的標準，導入了「雙管齊下」的混合式架構：
1. **頻內管理 (In-Band / Push-based):** 類似 *guchii Telemetry*，透過輕量級 Agent 安裝於作業系統內，主動且即時地將資源負載推播給 DCIM。
2. **頻外管理 (Out-of-Band / Pull-based):** 類似 *Redfish*，直接對接伺服器底層 BMC（如技嘉 AST2600 控制晶片），不受作業系統死機影響，執行強制硬體指令。

---

## 詳細異動內容

### 1. 頻內資料擷取器 (In-Band Client Agent)
**新增檔案：**
- `backend/client_agent.py`

**異動細節：**
- 實作了一支獨立的 Python 擷取腳本，做為未來實體伺服器上的代理程式 (Agent)。
- 核心邏輯使用 `psutil` 讀取實體主機真實的 CPU 負載 (CPU Usage) 與核心溫度 (Core Temperature)。
- 建立無窮迴圈（預設每 3 秒），將採樣數據以 JSON 格式 `POST` 推送至我們 FastAPI 中控台的 `/ingest` 端點。
- **測試指令：** `python backend/client_agent.py --server-id SERVER-015`

### 2. 頻外硬體控制 API (Out-of-Band Control API)
**新增與修改檔案：**
- **新增:** `backend/routers/control.py`
- **修改:** `backend/main.py` (註冊路由)

**異動細節：**
- 新增專屬硬體管理的 API 路由群組 `/api/control`。
- 實作了 `POST /api/control/{server_id}/power` 核心端點，接收 `on`, `off`, `reboot` 等動作指令。
- 程式碼內部已加上**真實硬體對接的註解區塊**（包含未來如何使用 HTTP Requests 打向 Gigabyte/Dell BMC 的 `/redfish/v1/Systems/Self/Actions/ComputerSystem.Reset`），方便硬體到位後隨時無縫解除註解直接啟用。

### 3. 前端真實 API 串接 (Frontend API Integration)
**修改檔案：**
- `frontend/src/app/control/page.tsx`

**異動細節：**
- 將原本「設備控制介面」純粹透過 `setMachines` 改變的假按鈕，全面升級為非同步 (`async`) 呼叫。
- 加入 `fetch` 邏輯：當使用者點擊「主電源」或「重新啟動」時，會實際打出 HTTP POST 請求至後端控制端點。
- 優化使用者體驗：在等待後端處理實體硬體回應時，按鈕會鎖定並顯示 `REBOOTING` 動畫，收到成功回應後才正式更新畫面狀態與變色。

---

> **未來維護指引 (Maintenance Guide):**
> 1. 當第一台實體型號 (例如 技嘉 R163-Z32-AAc1) 到貨後，請至 `routers/control.py` 取代掉 `time.sleep(1.5)` 的 mock 行為，填寫該機器的 BMC IP 即可直接使用。
> 2. `client_agent.py` 目前適合用於開發或輕量監控，後續若有成百上千台機器，可考慮使用跨平台的開源 `Telegraf` 替代，我們的 `/ingest` 依然相容。
