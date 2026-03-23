import time
import requests
import psutil
# 若要讀取真實硬體溫度，通常在 Linux 使用 psutil.sensors_temperatures() 或 WMI (Windows)
# 這裡簡單模擬或是抓取第一顆 CPU 溫度（依據不同 OS 需微調）

# ==========================================
# ⚙️ 必填設定區 (請在每一台真實伺服器上修改這裡)
# ==========================================

# 1. 這台真實機器的名稱 (必須跟 3D 畫面上的名字一樣，例如 SERVER-001)
MY_SERVER_ID = "SERVER-001"

# 2. 控制中心 (Dashboard 主機) 的真實 IP 位址
# 如果你的 Dashboard 主機 IP 是 192.168.1.100，就改成 "http://192.168.1.100:8000/ingest"
DATACENTER_API_URL = "http://127.0.0.1:8000/ingest"

# 3. 回報頻率 (秒)
REPORT_INTERVAL_SECONDS = 5

# ==========================================

def get_cpu_temp():
    """ 抓取真實機器溫度的通用寫法 (支援部分 Linux/Raspberry Pi) """
    if hasattr(psutil, "sensors_temperatures"):
        temps = psutil.sensors_temperatures()
        if temps and 'coretemp' in temps:
            return sum(t.current for t in temps['coretemp']) / len(temps['coretemp'])
    # 若作業系統不支援直接讀取溫度，給予一個預設值或結合第三方 CLI 讀取
    return 35.0

print(f"[{MY_SERVER_ID}] 🚀 DataCenter Agent 啟動中...")
print(f"📡 目標監控中心: {DATACENTER_API_URL}")

while True:
    try:
        # 1. 讀取真實的硬體 CPU 使用率
        cpu_usage = psutil.cpu_percent(interval=1)
        
        # 2. 讀取真實的硬體溫度
        temperature = get_cpu_temp()
        
        # 3. 打包成 JSON 格式
        payload = {
            "server_id": MY_SERVER_ID,
            "temperature": round(temperature, 1),
            "cpu_usage": round(cpu_usage, 1)
        }
        
        # 4. 透過 HTTP POST 推送到機房中心
        response = requests.post(DATACENTER_API_URL, json=payload, timeout=2)
        
        if response.status_code == 200:
            print(f"✅ 成功回報 - CPU: {cpu_usage}% | Temp: {temperature:.1f}°C")
        else:
            print(f"⚠️ 回報失敗 - 狀態碼: {response.status_code}")
            
    except requests.exceptions.ConnectionError:
        print(f"❌ 無法連線至監控中心 ({DATACENTER_API_URL})，等待重試...")
    except Exception as e:
        print(f"❌ 發生未知的錯誤: {e}")

    # 休息 5 秒後發送下一筆
    time.sleep(REPORT_INTERVAL_SECONDS)
