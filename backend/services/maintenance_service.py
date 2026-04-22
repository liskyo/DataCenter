from __future__ import annotations

from typing import Callable

from services.notification_service import EmailNotificationService
from services.storage_service import MaintenanceStorageService


class MaintenanceRepository:
    def __init__(self, storage: MaintenanceStorageService):
        self.storage = storage

    @property
    def is_ready(self) -> bool:
        return self.storage.is_ready

    def list_schedules(self) -> list[dict]:
        return self.storage.list_schedules()

    def list_due_email_schedules(self, schedule_date: str, limit: int = 100) -> list[dict]:
        return self.storage.list_due_email_schedules(
            schedule_date=schedule_date,
            limit=limit,
        )

    def create_schedule(self, **kwargs) -> dict:
        return self.storage.create_schedule(**kwargs)

    def update_schedule(self, schedule_id: str, **kwargs) -> dict | None:
        return self.storage.update_schedule(schedule_id, **kwargs)

    def delete_schedule(self, schedule_id: str) -> bool:
        return self.storage.delete_schedule(schedule_id)

    def mark_email_sent(self, schedule: dict) -> None:
        self.storage.mark_email_sent(schedule)

    def mark_email_failed(self, schedule_id: str, error: str) -> None:
        self.storage.mark_email_failed(schedule_id, error)


class MaintenanceService:
    def __init__(self, repository: MaintenanceRepository, email_notifier: EmailNotificationService):
        self.repository = repository
        self.email_notifier = email_notifier

    @property
    def is_ready(self) -> bool:
        return self.repository.is_ready

    @property
    def is_email_configured(self) -> bool:
        return self.email_notifier.is_configured

    def list_schedules(self) -> list[dict]:
        return self.repository.list_schedules()

    def create_schedule(
        self,
        *,
        target: str,
        task_type: str,
        scheduled_at: str,
        recurrence_days: int,
        assignee_username: str,
        assignee_name: str,
        assignee_role: str,
        assignee_email: str,
        notify_email: bool,
        notes: str,
    ) -> dict:
        return self.repository.create_schedule(
            target=target,
            task_type=task_type,
            scheduled_at=scheduled_at,
            recurrence_days=recurrence_days,
            assignee_username=assignee_username,
            assignee_name=assignee_name,
            assignee_role=assignee_role,
            assignee_email=assignee_email,
            notify_email=notify_email,
            notes=notes,
        )

    def update_schedule(
        self,
        schedule_id: str,
        *,
        target: str,
        task_type: str,
        scheduled_at: str,
        recurrence_days: int,
        assignee_username: str,
        assignee_name: str,
        assignee_role: str,
        assignee_email: str,
        notify_email: bool,
        notes: str,
    ) -> dict | None:
        return self.repository.update_schedule(
            schedule_id,
            target=target,
            task_type=task_type,
            scheduled_at=scheduled_at,
            recurrence_days=recurrence_days,
            assignee_username=assignee_username,
            assignee_name=assignee_name,
            assignee_role=assignee_role,
            assignee_email=assignee_email,
            notify_email=notify_email,
            notes=notes,
        )

    def delete_schedule(self, schedule_id: str) -> bool:
        return self.repository.delete_schedule(schedule_id)

    def send_test_email(
        self,
        *,
        triggered_by: str,
        target_user: dict,
        target_email: str = "",
    ) -> tuple[bool, str, dict]:
        recipient = str(target_email).strip() or str(target_user.get("email", "")).strip()
        if not recipient:
            return False, "Target email is required", {}

        ok, error = self.email_notifier.send_email(
            to_email=recipient,
            subject="[DCIM] Email 測試通知",
            html_content=f"""
<html>
  <body>
    <h2>DCIM Email 測試通知</h2>
    <p>這是一封 DCIM 系統測試信。</p>
    <p><strong>觸發者:</strong> {triggered_by}</p>
    <p><strong>收件對象:</strong> {target_user.get('username', triggered_by)}</p>
    <p><strong>收件地址:</strong> {recipient}</p>
    <p><strong>狀態:</strong> SMTP 測試成功觸發</p>
  </body>
</html>
""".strip(),
        )
        if not ok:
            return False, error or "Failed to send test email", {}

        return True, "", {
            "status": "success",
            "email": recipient,
            "username": target_user.get("username", triggered_by),
        }

    def process_due_email_schedules(self, schedule_date: str, log_event_cb: Callable[[str, str, str], None]) -> None:
        due_schedules = self.repository.list_due_email_schedules(schedule_date)
        for schedule in due_schedules:
            ok, error = self.email_notifier.send_maintenance_reminder(schedule)
            if ok:
                self.repository.mark_email_sent(schedule)
                log_event_cb(
                    "MAINTENANCE",
                    "MAINTENANCE_EMAIL_SENT",
                    (
                        f"維護排程提醒已寄出: {schedule.get('target', '')} / "
                        f"{schedule.get('scheduled_at', '')} / "
                        f"{schedule.get('reminder_email', '')}"
                    ),
                )
                print(f"[MaintenanceEmail] Sent reminder for {schedule.get('id')}")
            else:
                self.repository.mark_email_failed(schedule["id"], error)
                log_event_cb(
                    "MAINTENANCE",
                    "MAINTENANCE_EMAIL_FAILED",
                    (
                        f"維護排程提醒寄送失敗: {schedule.get('target', '')} / "
                        f"{schedule.get('scheduled_at', '')} / "
                        f"{schedule.get('reminder_email', '')} / {error}"
                    ),
                )
                print(f"[MaintenanceEmail] Failed reminder for {schedule.get('id')}: {error}")
