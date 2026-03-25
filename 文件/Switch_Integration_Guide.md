# Real-Device Integration Guide: Network Switches (交換器真實對接指南)

為了讓 DCIM 系統從模擬模式轉向真實資料，中控主機 (Backend) 需要一個機制來讀取物理交換器的數據。

## 1. 設備側設定 (Switch Side)
在你所有的實體交換器上啟用 **SNMP**。對於一般的 Cisco 設備，基本指令如下：
```bash
snmp-server community YOUR_SECRET_STRING RO
snmp-server contact admin@datacenter.com
```

## 2. 實作路徑

### 方案 A：快速整合 (Custom SNMP Poller)
在 `backend/main.py` 加入一個新的執行緒，使用 `pysnmp` 庫，每隔一段時間抓取數據。

**數據對照：**
- **流量 (Traffic)**：讀取 `ifInOctets` (輸入字節) 與 `ifOutOctets` (輸出字節)，計算兩次讀取間的差值來換算成 Gbps。
- **Port 狀態**：讀取 `ifOperStatus`，統計數值為 1 (Up) 的連接埠數量。

### 方案 B：企業標準 (SNMP Exporter)
如果你追求更強的穩定性：
1. 執行 Prometheus 的 **SNMP Exporter**。
2. 配置 Exporter 指向所有交換器的 IP。
3. 修改 FastAPI Backend 透過 API 向 Exporter 獲取最新指標。

## 3. Python 數據對接範例 (Ingestion Script)
你可以執行一個獨立的 Python 腳本，直接將資料打入現有的 API：

```python
import time, requests
# 安裝庫: pip install pysnmp
from pysnmp.hlapi import *

SWITCH_IP = "192.168.1.100"
COMMUNITY = "YOUR_SECRET_STRING"
API_URL = "http://localhost:9000/ingest"

def get_switch_data():
    # 這裡填入抓取 SNMP OID 的代碼
    # OID 參考: 1.3.6.1.2.1.2.2.1.10 (ifInOctets) -> Traffic
    # OID 參考: 1.3.6.1.2.1.2.2.1.8 (ifOperStatus) -> Ports
    
    return {
        "server_id": "SW-001",
        "traffic_gbps": 15.2, # 這裡代入抓取到的真實數值
        "ports_active": 12,   # 這裡代入 Up 的實際數量
        "ports_total": 48,
        "timestamp": int(time.time() * 1000)
    }

while True:
    try:
        data = get_switch_data()
        requests.post(API_URL, json=data)
        print(f"Sent: {data['server_id']} data to DCIM Backend")
    except Exception as e:
        print(f"Error: {e}")
    time.sleep(10)
```

## 4. 關鍵價值
透過將真實 SNMP 數據導向 `/ingest` 端點，3D 機房中的紫色線條亮度與閃爍頻率將會如實反映**機房內部的實例負載**，幫助管理者一眼看出網路瓶頸。
