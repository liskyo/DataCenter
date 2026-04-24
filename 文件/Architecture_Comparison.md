# 現代 DataCenter 監控架構演進：從 Pull 到 Push

本文件用來說明傳統輪詢式監控與現代推播式監控的差異，並標示本專案目前採用的主幹架構。

---

## 1. Pull-based 架構

典型代表：

- `SNMP`
- `IPMI`
- `Redfish Polling`

特性：

- 監控中心主動向設備查詢狀態
- 需要維護設備清單、位址與認證資訊
- 隨設備數量增加，輪詢成本與延遲會提高

適合：

- 傳統網通設備
- 僅提供管理介面的設備
- 以標準協定定期盤點為主的場景

---

## 2. Push-based 架構

典型代表：

- Agent Push
- Event Streaming
- Kafka 類型事件平台
- OpenTelemetry 類型管線

特性：

- 資料來源主動把事件送到平台
- 平台可解耦接收、處理、落庫與展示
- 較適合高頻遙測與即時畫面

適合：

- 高頻監控
- 即時告警
- 多資料來源整合

---

## 3. 本專案採用方式

本專案目前主幹偏向 Push-based：

```text
Agent / Simulation
   -> HTTP /ingest
   -> Kafka
   -> Backend processing
   -> InfluxDB / MongoDB
   -> SSE to frontend
```

補充說明：

- 前端即時畫面以 `SSE` 為主
- `SNMP`、`Redfish`、`Modbus` 等屬可整合協定，但不是目前主資料流核心

---

## 4. 混合模式的必要性

實務上通常不會只用單一路徑：

- Server OS 指標：Agent Push
- 硬體健康或電源控制：Redfish
- 網通與機電設備：SNMP / Modbus
- 前端即時更新：SSE

因此本專案是以 Push-based 為主幹，再保留 Pull-based 與異質設備整合空間。

---

## 5. 結論

- Pull-based 適合標準查詢與既有設備納管
- Push-based 適合即時、高頻、可擴充的資料主幹
- 本專案目前以 `HTTP ingest + Kafka + SSE` 為核心設計

---

*文件更新日期：2026-04-21*
