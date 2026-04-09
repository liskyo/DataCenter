# DCIM Frontend (Next.js)

DataCenter Command Center 前端儀表板，負責即時監控視覺化、3D 機房資產對照，以及冷卻系統（CDU / 雙相浸沒）狀態展示。

## 核心功能

- 即時遙測更新：優先使用 SSE (`/stream`)，失敗時自動切換為 polling (`/metrics`)。
- 監控總覽儀表板：包含設備矩陣、健康分布、警報列表、資源趨勢。
- 液冷監控：顯示 CDU 關鍵指標（流量、溫度等）。
- 雙相浸沒監控：動態對應 3D 機房中的 immersion rack，支援 DEMO 顯示邏輯。
- 模式切換：可切換 simulation / real，並同步下發模擬目標。

## 開發環境需求

- Node.js `>= 20.9.0`
- npm `>= 10`

## 啟動方式

在 `frontend` 目錄執行：

```bash
npm install
npm run dev
```

預設開發網址：

- [http://localhost:9001](http://localhost:9001)（若由根目錄 `start.bat` 啟動）
- 或 [http://localhost:3000](http://localhost:3000)（Next.js 預設）

## 主要檔案

- `src/app/page.tsx`
  - 監控首頁 UI 與資料整合邏輯。
  - 依設備型態（Server/SW/CDU/IMM）計算狀態與視覺區塊內容。
- `src/shared/hooks/useSSE.ts`
  - SSE 連線管理、事件去重與批次更新。
  - SSE 中斷後自動 fallback 到 polling，避免畫面無資料。
- `src/components/3d/`
  - 3D 場景與機櫃模型元件。

## 資料流說明

1. `useSSE` 嘗試連線 `${BACKEND_BASE_URL}/stream`。
2. 每筆事件會依 `asset_id/server_id/node_id/device_id` 建立 key，並做 ID 正規化（例如 `SERVER-1` -> `SERVER-001`）。
3. Hook 以短間隔批次觸發 `onUpdate`，降低高頻資料造成的重繪壓力。
4. 若 SSE 失敗，自動改為固定週期向 `${BACKEND_BASE_URL}/metrics` 拉取資料。

## 常用指令

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## 疑難排解

- 頁面顯示已連線但資料空白：
  - 先檢查後端是否有啟動，且 `BACKEND_BASE_URL` 指向正確 API 位址。
- 長時間顯示 polling：
  - 代表 SSE 通道不可用，請確認後端 `/stream` 與反向代理設定。
- 本機 git 出現大量 `.next` 變更：
  - 屬開發暫存產物，請確認 `.gitignore` 已忽略 `.next/`。
