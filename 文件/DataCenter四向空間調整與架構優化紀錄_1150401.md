# DataCenter 四向空間調整與架構優化紀錄

**日期：** 115/04/01 (2026/04/01)
**專案：** DataCenter 3D Digital Twin

## 1. 核心優化項目

### A. 機房四向邊界調整系統 (Multi-Directional Resizing)
- **資料結構升級：** 於 `useDcimStore.ts` 的 `LocationData` 中捨棄單純的 `width/depth`，改為 `xMin`, `xMax`, `zMin`, `zMax` 絕對座標邊界系統。
- **3D 渲染邏輯重構：** 修改 `RoomContext.tsx`，牆面與地板不再以中心點推算，而是根據絕對座標邊界進行渲染。
- **UI 操作直覺化：** 更新 `TwinsPage.tsx` 中的 Room Settings，提供 West (-X), East (+X), North (-Z), South (+Z) 四向獨立平移控制。
- **優點：** 當機房牆面擴張或縮小時，內部的機櫃與設備可保持在原有的絕對位置，不會因中心點位移而產生偏移。

### B. Next.js 開發環境整合
- **設定檔整合：** 為解決前端頻繁出現 404 (Not Found) 的問題，將 `next.config.mjs` 中的 Turbopack 設定整合至 `next.config.ts`。
- **路由穩定性：** 確保在 `npx next dev --turbo` 環境下，路由解析與熱更新 (HMR) 運作正常。

### C. 存儲層 migration 邏輯優化
- **自動補完機制：** 在 `useDcimStore.ts` 的 `persist` 選項中加入 `merge` 邏輯，確保舊版瀏覽器緩存中的機房資料能自動補上缺失的 `xMin`, `xMax`, `zMin`, `zMax` 預設值，防止 3D 渲染出錯。

## 2. 視覺實驗與還原紀錄

### 設備配色實驗 (Visual Identity Experiment)
- **實驗內容：** 曾測試將網路機櫃改為「科技銀白 (Tech-White/Silver)」與 PDU 加入「A/B 路電源色標」。
- **反饋處理：**
    *   **閃爍修復：** 針對白色機櫃與底座產生的 Z-fighting 進行過幾何偏移修復。
    *   **最終決定：** 根據使用者反饋，已將「伺服器機櫃」與「網路機櫃」完整 **還原為原始的藍、紫色半透明樣式**，以符合原有的視覺美感與穩定感。

---

## 3. 下一步操作建議
- [ ] 驗證機房縮放時，設備與牆面的相對距離是否符合預期。
- [ ] 準備實體伺服器到貨後的 IPMI/Redfish 硬體數據對接。
