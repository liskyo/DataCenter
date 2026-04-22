import time
import smtplib
import httpx
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
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


class EmailNotificationService:
    def __init__(
        self,
        host: str,
        port: int,
        username: str,
        password: str,
        from_email: str,
        from_name: str = "DCIM System",
        use_tls: bool = True,
    ):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.from_email = from_email
        self.from_name = from_name
        self.use_tls = use_tls

    @property
    def is_configured(self) -> bool:
        return bool(self.host and self.port and self.from_email)

    def send_email(self, *, to_email: str, subject: str, html_content: str) -> tuple[bool, str]:
        if not self.is_configured:
            return False, "SMTP settings are incomplete"

        recipient = str(to_email).strip()
        if not recipient:
            return False, "Recipient email is empty"

        content = MIMEMultipart("mixed")
        content["Subject"] = Header(subject, "utf-8").encode()
        content["From"] = formataddr((str(Header(self.from_name, "utf-8")), self.from_email))
        content["To"] = recipient
        content.attach(MIMEText(html_content, "html", "utf-8"))

        try:
            with smtplib.SMTP(self.host, self.port, timeout=10) as smtp:
                smtp.ehlo()
                if self.use_tls:
                    smtp.starttls()
                    smtp.ehlo()
                if self.username and self.password:
                    smtp.login(self.username, self.password)
                smtp.sendmail(self.from_email, recipient, content.as_string())
            return True, ""
        except Exception as exc:
            return False, str(exc)

    def send_maintenance_reminder(self, schedule: dict) -> tuple[bool, str]:
        to_email = str(schedule.get("reminder_email", "")).strip()
        recurrence_days = int(schedule.get("recurrence_days", 0) or 0)
        recurrence_label = f"{recurrence_days} 天" if recurrence_days > 0 else "單次"
        return self.send_email(
            to_email=to_email,
            subject=f"[DCIM] 維護排程提醒 - {schedule.get('target', 'Unknown Target')}",
            html_content=f"""
<html>
  <body>
    <h2>DCIM 維護排程提醒</h2>
    <p><strong>維護對象:</strong> {schedule.get('target', '')}</p>
    <p><strong>維護項目:</strong> {schedule.get('task_type', '')}</p>
    <p><strong>排程時間:</strong> {schedule.get('scheduled_at', '')}</p>
    <p><strong>發送週期:</strong> {recurrence_label}</p>
    <p><strong>負責人:</strong> {schedule.get('assignee_name', '')} ({schedule.get('assignee_username', '')})</p>
    <p><strong>通知信箱:</strong> {to_email}</p>
    <p><strong>備註:</strong> {schedule.get('notes', '') or '無'}</p>
    <hr />
    <p>請依排程時間完成維護作業。</p>
  </body>
</html>
""".strip(),
        )
