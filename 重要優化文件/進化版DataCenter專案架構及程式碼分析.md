# 【技術存檔】進化版 DataCenter 2.0 專案架構及程式碼深度分析 (2026-04-01)

## 1. 系統全域架構 (System Architecture)
本系統採用 **Cyberpunk SCADA** 設計理念，結合了「實體硬體採集 (In-Band)」、「模擬環境 (Simulated)」與「3D 數位孿生 (Digital Twin)」三大維度。

### ◈ 核心技術棧
*   **前端 (Frontend)**: Next.js + React Three Fiber (Three.js) + Tailwind CSS + Zustand (狀態管理)。
*   **後端 (Backend)**: FastAPI (高效異步框架) + Kafka (訊息調度) + InfluxDB/MongoDB (時序與警報持久化)。
*   **數據流 (Data Pipeline)**: 伺服器 Agent -> Kafka -> FastAPI -> SSE (Server-Sent Events) -> Frontend。

---

## 2. 後端核心邏輯分析 (Backend Deep Dive)

### ◈ `AppContainer (core/container.py)`
這是整個後端的「大腦」，負責跨模組的數據協調。
*   **電源狀態注入 (Power Injection)**: 在 `process_message` 階段，系統會攔截所有遙測數據，並根據 `power_states` 字典注入開關機狀態。如果設備處於 `off`，會自動將遙測數值（CPU、溫度、流速）歸零，防止前端出現殘留數據。
*   **真實數據優先權 (Real Data Priority)**: 新增了 `last_real_data_at` 追蹤機制。當實體 `client_agent.py` 發送數據時，系統會自動在接下來的 10 秒內「屏蔽」針對該節點的所有模擬心跳，解決數據衝突導致的延遲。

###   ◈ `KafkaRuntimeService (services/kafka_service.py)`
*   **動態頻率心跳**: 模擬器工作執行緒現在具備「變頻」功能。在真實模式下，每 2 秒發送一次模擬節點的「快照」，確保 3D 機房中的過期模擬節點能快速「反黑」。

### ◈ `SSEManager (services/sse_manager.py)`
*   **低延遲廣播**: 採用異步隊列 (asyncio.Queue) 技術，確保數百個監測點同時變動時，前端仍能維持 200ms 以內的感官延遲。

---

## 3. 前端數位孿生分析 (Frontend & Digital Twin)

### ◈ `page.tsx` (Dashboard 核心)
*   **混合渲染邏輯**: 
    - **2D Grid**: 負責大規模概覽，支援 40+ 節點。
    - **動態節流 (Throttling)**: 將歷史曲線的渲染頻率限制在 2 秒一次，避免過度消耗 Client 端瀏覽器的 GPU 資源。
*   **捲軸式佈局**: 針對高密度監測圖表（如各節點 CPU 負載），採用動態高度計算技術，解決了標籤重疊的視覺問題。

### ◈ 3D 監控組件 (`components/3d/`)
*   **CDUModel.tsx**: 
    - **CanvasTexture HUD**: 實作了「數位抬頭顯示」，將即時數據畫入 3D 紋理，顯著提升專業感。
    - **X-Ray & Hover**: 利用 Three.js 的 `MeshStandardMaterial` 透明度切換，達成透視效果。
*   **視覺反饋機制**: 
    - **Grayscale Filter**: 當設備 `power_state === 'off'` 時，前端會自動套用去色濾鏡，模擬設備完全斷電的黑白狀態。
*   **浸沒式冷卻模組 (`ImmersionTankModel.tsx`)**:
    - **縱向插槽系統**: 不同於傳統機架，實作了基於 `uPosition` 的 Z 軸縱向排列邏輯。
    - **動態液態渲染**: 使用 `useFrame` 實作半透明冷卻液位波動效果。
    - **雙相相變模擬**: 實作了頂部冷凝器 (Condenser) 與蒸氣發光效果。
    - **管路自動連線**: 擴充了 `CoolantFlow` 邏輯，使單相浸沒槽能自動對接至 CDU。

---

## 4. 關鍵優化清單 (Optimization Summary)

| 功能模組 | 優化前 (Before) | 優化後 (Evolution 1.1) | 技術亮點 |
| :--- | :--- | :--- | :--- |
| **數據同步** | 頁面間狀態不一致 | **全域電源狀態同步** | 利用 SSE 全區廣播連動所有 UI |
| **真實模式** | 模擬節點依然發光 | **模擬數據自動過濾** | 認主機制，讓模擬節點正確反黑 |
| **高頻渲染** | 40 節點時 CPU 標籤擠壓 | **動態捲軸佈局** | 動態高度計算 + Overflow 滾動 |
| **CDU 視覺** | 靜態模型 | **3D 抬頭顯示 + X-Ray** | CanvasTexture 即時紋理渲染 |
| **數據顯示** | 5 秒延遲感 | **2 秒更新週期 + 衝突排除** | 消除模擬與真實數據的競態 (Race) |
| **液冷架構** | 僅支援 CDU ↔ RACK | **浸沒式冷卻生態系整合** | 支援單相/雙相浸沒槽與縱向伺服器部署 |

---

## 5. 未來擴展方向 (Future Roadmap)
1.  **Redfish/IPMI 實體接入**: 目前後端 `control.py` 已留有 stub 接口，未來可直接對接網管晶片 (BMC)。
2.  **3D 空間編修器**: 開發者可即時拖曳機架位置並儲存至 MongoDB。
3.  **AI 預測維護**: 結合 `InfluxDB` 的歷史數據進行 LSTN/Transformer 模型訓練，預測流量高峰。

---
**本文件旨在記錄 DataCenter 專案在 2026 年 4 月份的重大進化過程。**
**發布者：Antigravity 技術專家組**
