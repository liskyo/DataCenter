# DataCenter 動態設備同步與控制介面優化紀錄

**日期:** 2026-03-31 (1150331)

## 異動摘要設定 (Commit Message Summary)
**Feat:** 實作動態設備模擬機制與控制介面 Zustand 連動

---

## 詳細異動內容

### 1. 後端架構修改 (Backend)
**修改檔案：**
- `backend/routers/system.py`
- `backend/services/kafka_service.py`

**異動細節：**
- 新增 `POST /api/system/simulate_targets` API 接口，允許前端將畫面上實際存在的伺服器名單動態傳給後端。
- 將 `KafkaRuntimeService` 的 `simulation_worker` 從原本寫死的 `1~12` 台伺服器，改為讀取前端傳入的 `simulation_targets`。
- 達成動態新增機台時，後端能無縫接軌並即時發送該機台的假資料（模擬模式），解決新機台顯示 `OFFLINE / NO SIGNAL` 的問題。

### 2. 前端戰情看板優化 (Frontend Dashboard)
**修改檔案：**
- `frontend/src/app/page.tsx`

**異動細節：**
- 新增 `useEffect` 監聽生命週期，當 `itemNameSet` (設備名單) 變更且處於模擬模式時，會主動向後端發出 API 請求同步名單。
- 修正「各節點 CPU 負載佔比」圖表 (BarChart) 標籤省略的問題：針對 `YAxis` 加入 `interval={0}`，強制印出所有單雙號機台名稱。
- 擴充「即時系統警報 (Real-time Alarms)」模組：原本只顯示紅色 `critical` 狀態的設備，現在加入黃色 `warning` 狀態的設備預警，並套用對應的黃色渲染樣式。

### 3. 前端設備控制介面連動 (Frontend Control Interface)
**修改檔案：**
- `frontend/src/app/control/page.tsx`

**異動細節：**
- 移除原本寫死（Hardcoded）在 `useState` 中的 6 台測試機器 (`SERVER-001` ~ `SERVER-006`)。
- 引入 Zustand 狀態庫 (`useDcimStore`)，根據 `currentLocationId` 動態篩選出該區域內所有的伺服器與交換機。
- 實作列表同步邏輯：在 `useEffect` 中將新機台匯入控制清單，保留其即時操控狀態（`powerOn`, `isRebooting`, `fanSpeed`），完美銜接 3D 視覺機房與 2D 控制面板。

---

> **後續預計擴展方向 (Roadmap):** 
> 準備實作頻內擷取器 (Client Agent) 與基於 Redfish/IPMI API 的頻外硬體真實控制（Out-of-Band Control），取代目前的純 UI 模擬。
