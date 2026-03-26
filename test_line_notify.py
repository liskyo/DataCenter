import sys
import os
import asyncio

# 將 backend 加入路徑
sys.path.append(os.path.join(os.getcwd(), "backend"))

from core.container import AppContainer, AppSettings

async def test_notification():
    # 這裡請替換成你的 LINE Notify Token 進行測試
    token = input("請輸入 LINE Notify Token: ")
    
    settings = AppSettings(line_notify_token=token)
    container = AppContainer(settings=settings)
    
    print("\n--- 測試發送第一則警報 ---")
    container.trigger_alert("Test-Server-01", "HIGH_TEMP", "溫度達到 45 度！")
    
    print("\n--- 測試連續發送相同警報 (預期會被過濾) ---")
    container.trigger_alert("Test-Server-01", "HIGH_TEMP", "溫度還是 45 度！")
    
    print("\n--- 測試發送不同類型的警報 (預期會發送) ---")
    container.trigger_alert("Test-Server-01", "FAN_FAILURE", "風扇轉速異常！")

if __name__ == "__main__":
    asyncio.run(test_notification())
