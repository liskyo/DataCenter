# DataCenter 前端效能與架構更新紀錄 (115/03/30)

## 一、 最新版本整合功能概述
今日成功將 `origin/leia0` 分支進度與 `main` 主分支合併，主要包含：

1. **中英文多語系支援 (i18n)**：在所有前端頁面與 Navbar 導入 `language.tsx` 全域語系切換管理。
2. **核心模組整合**：確認之前完成的 `notification_service.py` 警報引擎以及新撰寫之多份部署與架構文件已完美匯入。

---

## 二、 核心前端架構與效能優化項目
為了確保系統能在真實機房環境 (如管理超過 50+ 座機櫃與上千台伺服器) 的高負載下穩定運作，並具備「企業級SCADA系統」等級的擴充性，今日在程式碼層級針對以下三大痛點進行了架構優化：

### 1. 統一輪詢機制 (Polling Consistency) - 預防後端崩潰
- **目標檔案**：`frontend/src/app/twins/page.tsx` (3D 動態機房頁面)
- **優化前**：使用 React 原生的 `useEffect` 搭配 `setInterval`，固定每 5 秒強制抓取一次。若網路不穩或伺服器回應較慢，這將導致未完成的 API 請求不斷重疊、堆積，最終引發前端卡死或對後端 API 造成高併發癱瘓 (DDOS)。
- **優化後**：全面導入並收斂使用專案內建的 Hooks `usePolling`。
- **效益評估**：`usePolling` 由於內部實作了 `inFlightRef` 鎖定防爆機制，若上一筆 API 任務尚未回來，將會自動捨棄重疊的輪詢抓取，徹底根絕「請求雪崩 (Race Condition)」引發的災難，確保資料庫連線數永遠維持在安全範圍。

### 2. React 陣列重算效能優化 (Recharts)
- **目標檔案**：`frontend/src/app/page.tsx` (總覽戰情首頁)
- **優化前**：用來歸納機房總體健康度 (`healthData`) 與渲染圓餅圖 (`pieData`) 的 `Array.reduce` 等迴圈邏輯直接寫在元件流程內。這將導致畫面任何風吹草動（如 5 秒跳一次更新），所有設備的陣列就被強迫重算一次。
- **優化後**：將這些吃重 CPU 資源的陣列歸納過程包裝進 `useMemo` 中，並綁定精確的 Dependency `[allGridItems, telemetryById]`。
- **效益評估**：大幅減輕瀏覽器 V8 引擎負擔。當未來系統規模擴張，即使面對上千台設備，畫面依舊能維持完全順暢的 60 FPS 體驗，不會有肉眼可見的卡頓。

### 3. 導覽列極速切換 (Navbar Prefetch)
- **目標檔案**：`frontend/src/components/Navbar.tsx`
- **優化前**：分頁選單上的 `<Link prefetch={false}>` 關閉了後台預取與緩存功能。
- **優化後**：改為 `<Link prefetch={true}>` 重啟 Next.js 路由預取。
- **效益評估**：考量此 SCADA 作業系統會部署在局域網或主頻寬下，在不用過度節省一丁點網路頻寬的前提下，開啟 Prefetch 讓使用者點擊導覽列分頁時，帶來「零延遲、無白畫面的瞬間切換」，大幅提升操作回饋體驗。
