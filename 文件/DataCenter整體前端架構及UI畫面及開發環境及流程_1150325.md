# DataCenter 整體前端架構及 UI 畫面及開發環境及流程 (1150325)

本文件整理目前前端實際技術棧、頁面分層、資料流與開發方式。若與舊版文件衝突，請以 `frontend/` 現況與本文件為準。

---

## 1. 前端定位

前端負責以下任務：

- 顯示即時監控儀表板
- 呈現 3D 數位孿生與機房配置
- 提供控制、維運、網路與設定頁面
- 在 SSE 與 Polling 間進行即時資料容錯切換

---

## 2. 技術棧

### 2.1 核心框架

- `Next.js 16.2.0`
- `React 19`
- `TypeScript`
- App Router 架構

### 2.2 UI 與圖形

- `Tailwind CSS v4`
- `Recharts`
- `three`
- `@react-three/fiber`
- `@react-three/drei`
- `lucide-react`

### 2.3 狀態與工具

- `zustand`
- `idb-keyval`
- 共用 API 與 hooks 位於 `src/shared/`

---

## 3. 目錄結構

主要目錄如下：

- `src/app/`：頁面路由與入口
- `src/components/`：共用元件與 3D 元件
- `src/features/twins/`：數位孿生場景組裝
- `src/shared/`：API、hooks、auth、i18n、工具函式
- `src/store/`：前端狀態管理

重要檔案：

- `src/shared/api.ts`：後端 API 基底設定
- `src/shared/hooks/useSSE.ts`：SSE 連線與 fallback 邏輯
- `src/shared/hooks/usePolling.ts`：輪詢封裝
- `src/store/useDcimStore.ts`：機房與頁面狀態

---

## 4. 核心頁面

目前主要頁面包含：

- `/`：總覽與監控矩陣
- `/analysis`：歷史趨勢與分析
- `/control`：設備控制介面
- `/maintenance`：維運與排程頁面
- `/twins`：3D 數位孿生
- `/facility`：廠務監控
- `/network`：網路與通訊配置說明
- `/logs`：告警與事件檢視
- `/engineering`：工程模式
- `/settings`、`/backup`：設定與備份相關畫面

---

## 5. 即時資料流

前端目前採用 **SSE 優先、Polling 保底**：

1. 優先嘗試連線 `GET /stream`
2. 收到事件後更新前端狀態與畫面
3. 若 SSE 中斷或長時間無事件，退回 `GET /metrics`
4. 在 Polling 期間背景重試 SSE
5. SSE 恢復後再切回即時串流模式

這代表目前即時通道應描述為 **SSE**，不是 WebSocket。

---

## 6. 3D 與視覺層說明

- 3D 場景以 React Three Fiber 建構
- 佈局與設備資料由前端狀態與配置資料驅動
- 支援機櫃、伺服器、CDU、浸沒槽等設備視覺元件
- `zustand` 持久化用於保存部分前端互動與布局狀態

UI 風格延續深色戰情室設計，但文件應以功能與架構為主，不再以舊版概念圖說作為唯一依據。

---

## 7. 開發方式

```bash
cd frontend
npm install
npm run dev -- -p 9001
```

預設網址：

- `http://127.0.0.1:9001`

必要條件：

- Node.js `>= 20.9.0`
- npm `>= 10`

---

## 8. 實作注意事項

- 實際框架版本是 `Next.js 16.2.0`，不是舊文件中的 Next 15
- 部分頁面仍混合使用即時串流、輪詢與展示資料，文件應明確標示哪些是正式資料流、哪些仍偏展示層
- `layout/` 與 3D 配置相關資料仍是前端體驗的重要一環，但不代表所有配置都已持久化到後端
- 若 API 位址要變更，應先確認 `src/shared/api.ts` 與環境變數設定

---

*文件更新日期：2026-04-21*
