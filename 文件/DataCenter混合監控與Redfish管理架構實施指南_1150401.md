# DataCenter 混合監控與 Redfish 管理架構實施指南

**日期：** 115/04/01 (2026/04/01)
**專案：** DataCenter 3D Digital Twin - 混合監測與硬體控制方案

## 0. 核心設計理念 (Design Philosophy)
本系統導入了業界領先的「混合管理模式」，將監控維運拆分為兩個維度：
1. **頻內遙測 (In-band Telemetry)：** 模擬 **guchii Telemetry** 標準，透過 Agent 主動推送作業系統層級（OS Level）的高精度數據。
2. **頻外控制 (Out-of-band Control)：** 模擬 **Redfish (DMTF)** 標準，透過 BMC (Baseboard Management Controller) 介面對硬體下達強制指令。

---

## 1. 實作流程第一階段：頻內遙測擷取 (In-band Agent)
這部分由 `backend/client_agent.py` 負責，透過 `psutil` 庫對作業系統進行非侵入式採樣。

### 技術細節：
- **傳輸模式：** 支援 HTTP PUSH。Agent 會將封裝好的 JSON 數據發送至中控伺服器的 `/ingest` 端點。
- **數據內容：** 包含 `cpu_usage`, `temperature`, `memory_usage` 等即時數值。
- **實作邏輯：**
    ```python
    # 核心邏輯架構 (client_agent.py)
    data = {
        "server_id": args.server_id,
        "cpu_usage": psutil.cpu_percent(),
        "temperature": get_temp(), # 抓取 CPU Core Temp
        "timestamp": time.time()
    }
    requests.post(f"{SERVER_URL}/ingest", json=data)
    ```

### 執行指南：
在任何要監測的實體伺服器上執行：
```bash
python backend/client_agent.py --server-id SERVER-015 --server-url http://[中控IP]:9000
```

---

## 2. 實作流程第二階段：頻外控制介面 (Out-of-band / Redfish)
這部分由 `backend/routers/control.py` 負責，定義了標準化的控制流程，對應 Redfish 的 `ComputerSystem.Reset` 動作。

### 技術細節：
- **API 路由：** `POST /api/control/{device_id}/power`
- **控制動作：** 支援 `on`, `off`, `reboot` 三種狀態。
- **非同步設計：** 為了模擬真實硬體反應時間並提供前端 Loading 顯示，我們引入了 1.5s 的非同步延遲。
- **Redfish 對接預留點：**
    *   **技嘉伺服器 BMC 路徑：** `/redfish/v1/Systems/Self/Actions/ComputerSystem.Reset`
    *   目前使用 `time.sleep` 模擬，未來只需移除註解並填入 BMC 憑證即可真正控制硬體電源。

---

## 3. 實作流程第三階段：前端控制編排 (Frontend Orchestration)
這部分在 `frontend/src/app/control/page.tsx` 中實作，將複雜的後端連線狀態視覺化。

### 技術介接細節：
- **狀態管理：** 使用 React `useState` 追蹤每個設備的 `isChanging` (正在切換中) 狀態。
- **Fetch 流程：**
    1. 使用者點擊按鈕 (如 Reboot)。
    2. 前端向 `control.py` 發送 POST 請求。
    3. 按鈕顯示旋轉進度條 (Spinner / Loading State)。
    4. 後端完成 Redfish 指令模擬（或真實重啟時間）。
    5. 前端收到 `Success` 回報，按鈕恢復正常，並更新狀態文字。

---

## 4. 驗證與測試流程 (Verification)
1. **啟動後端：** 執行 `python backend/main.py` 啟動 FastAPI。
2. **啟動 Agent：** 執行 `python client_agent.py --server-id SERVER-015`。
3. **進入監測：** 在首頁 Dashboard 檢查 SERVER-015 是否有真實溫度波動。
4. **執行控制：** 導航至「設備控制 (Control Console)」，對 SERVER-015 點擊「Restart」。
5. **觀察結果：** 指令發送成功後，終端機會記錄 `[Control] Sending Redfish Reset to SERVER-015`，前端按鈕同步顯示等候狀態。

---

> **架構展望：**
> 這套「DataCenter Hybrid Framework」不僅能管理虛擬機，更能無縫過渡至實體數據中心。透過標準化的 Redfish 與 Telemetry 介面，我們已經為未來的機櫃上架做好了 100% 的軟體準備。
