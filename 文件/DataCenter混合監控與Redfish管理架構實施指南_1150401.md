# DataCenter 混合監控與 Redfish 管理架構實施指南

**日期：** 2026-04-21  
**用途：** 說明目前專案中「頻內遙測 + 頻外控制」的混合監控架構，並明確區分已落地與預留整合項目。

---

## 1. 核心概念

本系統的混合監控分成兩條路徑：

1. **頻內遙測 (In-band Telemetry)**  
   由 Agent 或設備資料來源提供作業系統與應用層指標，走 `/ingest -> Kafka -> 後端處理 -> 前端展示` 主幹。

2. **頻外控制 (Out-of-band Control)**  
   由控制 API 提供電源或設備控制入口，未來可進一步串接真實 BMC / Redfish。

---

## 2. 已落地的部分

### 2.1 頻內遙測

已具備：

- Agent / 模擬資料上送
- `POST /ingest`
- Kafka `telemetry` topic
- 後端背景處理
- InfluxDB / MongoDB 落庫
- SSE 對前端廣播

典型用途：

- CPU、溫度、記憶體等遙測資料
- 告警與異常分析
- Dashboard 與 3D Twins 即時更新

### 2.2 控制 API 介面

已具備：

- `POST /api/control/{server_id}/power`
- 控制狀態流與回應格式
- 前端控制畫面對應操作流程

目前狀態：

- 以應用層模擬與狀態變更為主
- Redfish 真實 BMC 呼叫仍屬預留整合點

---

## 3. 預留整合項目

下列能力可作為下一階段擴充：

- Redfish 真實電源控制
- BMC 認證與憑證管理
- Redfish Eventing / Webhook
- SNMP / Modbus / gNMI 等異質設備監控整合

文件中若提到「已直接控制真實硬體」，目前應解讀為架構方向，而非既有量產能力。

---

## 4. 實作主幹

### 4.1 遙測主幹

```text
Agent / Device
   -> POST /ingest
   -> Kafka
   -> Backend processing
   -> InfluxDB / MongoDB
   -> SSE
   -> Frontend
```

### 4.2 控制主幹

```text
Frontend Control Page
   -> POST /api/control/{server_id}/power
   -> Backend control router
   -> current stub / simulated action
   -> response to frontend
```

---

## 5. 前端控制畫面角色

前端控制頁的主要責任是：

- 發送控制請求
- 顯示 loading / success / failure 狀態
- 對應後端控制 API 回應

這部分已具備 UI 與流程意義，但不應在文件中誤寫成「已全面接管真實機櫃電源」。

---

## 6. 驗證建議

1. 啟動基礎設施與後端
2. 啟動前端
3. 啟動模擬資料或真機 Agent
4. 在 Dashboard 驗證即時資料是否更新
5. 在 Control 頁驗證控制 API 是否有回應
6. 若進行真實 Redfish 串接，再額外驗證 BMC 路徑、認證與安全性

---

## 7. 文件同步原則

- 遙測現況請以 `HTTP ingest + Kafka + SSE` 為準
- Redfish 現況請以「控制介面已預留、真實串接待整合」為準
- 若要寫客戶版或提案版文件，可描述混合監控藍圖，但要標示是否已實作

---

*文件更新日期：2026-04-21*
