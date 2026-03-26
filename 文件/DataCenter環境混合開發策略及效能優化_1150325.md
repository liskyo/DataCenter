# DataCenter 環境混合開發策略及效能優化 (1150325)

本文件解釋了 DataCenter 專案採用「混合式開發模式 (Hybrid Development)」的核心邏輯，以及 1150325 版本中實施的效能優化措施。

---

## 🏗️ 第一部分：混合開發架構 (Host vs. Docker)

本專案將系統拆分為兩個維度運行，以達到開發效率與環境隔離的平衡：

### 1. 基礎設施層 (Infrastructure Layer) -> **Docker (WSL2)**
- **包含組件**：Kafka, MongoDB, InfluxDB, Zookeeper, Grafana。
- **原因**：這些資料庫與中間件安裝繁瑣且易污染主機環境。利用 Docker 可以實現「一鍵啟動、即用即走」，且能保證所有開發者的資料庫版本完全一致。

### 2. 應用邏輯層 (Application Layer) -> **主機 (Host/Local)**
- **包含組件**：Next.js 前端、FastAPI 後端、Python 採集代理。
- **原因**：
  - **極速開發 (Hot Reload)**：直接在主機運行可享受毫秒級的代碼重載，提升開發效率。
  - **偵錯便利 (Debugging)**：方便直接掛載 VS Code 偵錯器，無需處理複雜的遠端橋接。
  - **硬體存取**：採集代理需要讀取主機實體 CPU/溫度數據，Docker 隔離後無法獲取真實值。

---

## ⚡ 第二部分：效能優化措施 (Performance Optimization)

針對筆電開發環境，1150325 版本採取了以下關鍵優化：

### 1. WSL2 記憶體限制
- **檔案**：`C:\Users\<User>\.wslconfig`
- **操作**：將 `memory` 限制為 **4GB**。
- **效果**：防止 Docker (VmmemWSL) 無止盡吞噬實體記憶體，預留至少 40%-50% 資源給 Windows 系統與開發工具。

### 2. 前端 Node.js 資源優化
- **檔案**：`start.bat`
- **操作**：將 `NODE_OPTIONS=--max-old-space-size` 調降至 **2048 (2GB)**。
- **效果**：減少 Next.js 在開發模式下因緩存導致的記憶體溢出，確保開發時介面反應流暢。

### 3. 連接埠偏移 (Port Offset)
- **策略**：避開常用埠號（如 8086, 27017），全數向後偏移。
- **效果**：徹底解決開發者電腦中已有舊版服務或 SQL Server 造成的連接埠衝突問題。

---

## 💡 第三部分：開發者建議
- **資源監控**：建議開發時保持「工作管理員」開啟，若記憶體再次超過 90%，請確認是否有無用的背景服務（如 BarTender, SQL Express）尚未關閉。
- **啟動順序**：務必先確認 Docker Desktop 已轉為**綠燈**狀態，再執行 `start.bat` 以確保連線成功。

---
*文件更新日期：2026-03-25 (1150325 修訂版)*
