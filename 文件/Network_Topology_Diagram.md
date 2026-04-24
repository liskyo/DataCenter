# 機房實體網路拓撲圖 (Network Topology)

**日期：** 2026-04-21

本文件描述本專案在實體部署時的基本網路拓撲，內容以目前 `Backend 9000 + Frontend 9001 + Kafka 29093` 的開發/展示配置為準。

---

## 1. 基本拓撲

```text
                   [ Router / LAN Gateway ]
                             |
                             v
                      [ Network Switch ]
                       |      |      |
                       |      |      |
                       v      v      v
                [DCIM Host] [Server A] [Server B...]
```

其中：

- `DCIM Host`：執行前端、後端與基礎設施服務的主機
- `Server A / B`：被監控的實體伺服器或測試主機
- 所有節點需位於可互通的 LAN 內

---

## 2. 中控主機角色

中控主機通常承載：

- Frontend：`http://<host>:9001`
- Backend：`http://<host>:9000`
- Kafka：`<host>:29093`
- 其他資料服務：MongoDB / InfluxDB / Redis / Grafana

若是展示或開發環境，可集中部署在同一台主機。

---

## 3. Agent 連線建議

真機 Agent 應優先指向後端入口：

```text
http://<dcim-host>:9000/ingest
```

文件同步注意：

- 對多數情境來說，Agent 主要對接 `9000` 的 HTTP ingest
- 不應再把 Kafka `29092` 當作目前對外預設位址
- 若要跨主機使用 Kafka，請另外確認 broker 公告位址與防火牆

---

## 4. 部署建議

1. `DCIM Host` 建議使用固定 IP
2. 被監控主機可固定或 DHCP，但需能連回中控主機
3. 若需外部存取，應開放或代理對應埠號
4. 若為正式環境，應再考慮 VLAN、ACL、BMC 網段隔離與憑證安全

---

## 5. 實務重點

- 前端與後端是兩個不同埠：`9001` / `9000`
- 即時前端更新走 SSE，不需額外 WebSocket 埠
- 控制流與監控流應分清楚；即使未啟用真實 Redfish，Agent 遙測仍可獨立運作

---

*文件更新日期：2026-04-21*
