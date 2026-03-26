import time
import httpx
from typing import Dict, Tuple

class NotificationService:
    def __init__(self, token: str, cooldown_seconds: int = 300):
        """
        :param token: LINE Notify API Token
        :param cooldown_seconds: 同一警報類型的冷卻時間 (預設 5 分鐘)
        """
        self.token = token
        self.cooldown_seconds = cooldown_seconds
        self.api_url = "https://notify-api.line.me/api/notify"
        
        # 存儲最後一次發送時間: {(server_id, alert_type): timestamp}
        self.last_sent: Dict[Tuple[str, str], float] = {}

    def _should_throttle(self, server_id: str, alert_type: str) -> bool:
        """ 判斷是否應該過濾此警報 (是否在冷卻時間內) """
        key = (server_id, alert_type)
        now = time.time()
        
        if key in self.last_sent:
            elapsed = now - self.last_sent[key]
            if elapsed < self.cooldown_seconds:
                return True
        
        self.last_sent[key] = now
        return False

    def send_alert(self, server_id: str, alert_type: str, message: str):
        """ 發送警報至 LINE Notify """
        if not self.token:
            return

        if self._should_throttle(server_id, alert_type):
            print(f"[Notifier] Throttled alert for {server_id}: {alert_type}")
            return

        formatted_message = (
            f"\n🚨 [DataCenter 警報]\n"
            f"設備: {server_id}\n"
            f"類型: {alert_type}\n"
            f"訊息: {message}\n"
            f"時間: {time.strftime('%Y-%m-%d %H:%M:%S')}"
        )

        try:
            # 使用同步請求或放入背景執行緒 (目前維持簡單同步實作)
            headers = {"Authorization": f"Bearer {self.token}"}
            data = {"message": formatted_message}
            
            # 使用 httpx 發送
            response = httpx.post(self.api_url, headers=headers, data=data, timeout=5.0)
            
            if response.status_code == 200:
                print(f"[Notifier] Sent alert to LINE for {server_id}")
            else:
                print(f"[Notifier] Failed to send LINE Notify: {response.text}")
                
        except Exception as e:
            print(f"[Notifier] Connection error sending LINE Notify: {str(e)}")
