from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from datetime import datetime
from typing import List, Optional

from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import WriteOptions
from pymongo import MongoClient
from pymongo.collection import Collection


class InfluxService:
    def __init__(self, url: str, token: str, org: str, bucket: str):
        self.org = org
        self.bucket = bucket
        self.client = InfluxDBClient(url=url, token=token, org=org)
        options = WriteOptions(
            batch_size=500,
            flush_interval=1000,
            jitter_interval=0,
            retry_interval=1000,
            max_retries=3,
            max_retry_delay=5000,
            exponential_base=2
        )
        self.write_api = self.client.write_api(write_options=options)

    def write_metrics(self, server_id: str, temp: float, cpu: float) -> None:
        point = (
            Point("server_metrics")
            .tag("server_id", server_id)
            .field("temperature", temp)
            .field("cpu_usage", cpu)
        )
        self.write_api.write(bucket=self.bucket, org=self.org, record=point)

    def close(self) -> None:
        try:
            self.client.close()
        except Exception:
            pass


class AlertStorageService:
    def __init__(self, mongo_uri: str):
        self.mongo_uri = mongo_uri
        self.mongo_client: Optional[MongoClient] = None
        self.alerts_collection: Optional[Collection] = None
        self.is_ready = False

    def init(self) -> None:
        try:
            self.mongo_client = MongoClient(self.mongo_uri, serverSelectionTimeoutMS=2000)
            db = self.mongo_client["datacenter"]
            self.alerts_collection = db["alerts"]
            self.alerts_collection.create_index([("timestamp", -1)])
            self.is_ready = True
            print("MongoDB connected and index created...")
        except Exception as exc:
            self.is_ready = False
            print(f"MongoDB connection failed: {exc}")

    def insert_alert(self, alert_doc: dict) -> None:
        if self.alerts_collection is None:
            return
        try:
            self.alerts_collection.insert_one(alert_doc)
        except Exception:
            pass

    def list_alerts(self, limit: int = 50) -> List[dict]:
        if self.alerts_collection is None:
            return []
        cursor = self.alerts_collection.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit)
        return list(cursor)

    def close(self) -> None:
        if self.mongo_client is None:
            return
        try:
            self.mongo_client.close()
        except Exception:
            pass


PBKDF2_ALGORITHM = "sha256"
PBKDF2_ITERATIONS = 310000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        PBKDF2_ALGORITHM,
        password.encode("utf-8"),
        salt,
        PBKDF2_ITERATIONS,
    )
    return f"pbkdf2_{PBKDF2_ALGORITHM}${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        scheme, iterations_raw, salt_hex, digest_hex = stored_hash.split("$", 3)
        _, algorithm = scheme.split("_", 1)
        iterations = int(iterations_raw)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
    except (ValueError, TypeError):
        return False

    actual = hashlib.pbkdf2_hmac(
        algorithm,
        password.encode("utf-8"),
        salt,
        iterations,
    )
    return hmac.compare_digest(actual, expected)


class UserStorageService:
    def __init__(self, mongo_uri: str):
        self.mongo_uri = mongo_uri
        self.mongo_client: Optional[MongoClient] = None
        self.users_collection: Optional[Collection] = None
        self.is_ready = False

    def init(self) -> None:
        try:
            self.mongo_client = MongoClient(self.mongo_uri, serverSelectionTimeoutMS=2000)
            db = self.mongo_client["datacenter"]
            self.users_collection = db["users"]
            self.users_collection.create_index([("username", 1)], unique=True)
            self.users_collection.create_index([("email", 1)], unique=True, sparse=True)
            self._seed_default_users()
            self.is_ready = True
            print("MongoDB users collection ready...")
        except Exception as exc:
            self.is_ready = False
            print(f"User storage initialization failed: {exc}")

    def _seed_default_users(self) -> None:
        if self.users_collection is None:
            return

        defaults = [
            {
                "username": "admin",
                "password": "admin123",
                "role": "admin",
                "name": "系統管理員",
                "email": "admin@datacenter.local",
                "line_id": "dcim-admin",
            },
            {
                "username": "operator",
                "password": "operator123",
                "role": "operator",
                "name": "維運人員",
                "email": "operator@datacenter.local",
                "line_id": "dcim-operator",
            },
            {
                "username": "agent",
                "password": "agent-api-key",
                "role": "agent",
                "name": "Agent Service",
                "email": "agent@datacenter.local",
                "line_id": "dcim-agent",
            },
        ]

        for user in defaults:
            self.users_collection.update_one(
                {"username": user["username"]},
                {
                    "$setOnInsert": {
                        "username": user["username"],
                        "password_hash": hash_password(user["password"]),
                        "role": user["role"],
                        "name": user["name"],
                        "email": user["email"],
                        "line_id": user["line_id"],
                    }
                },
                upsert=True,
            )
            self.users_collection.update_one(
                {"username": user["username"], "email": {"$exists": False}},
                {"$set": {"email": user["email"]}},
            )
            self.users_collection.update_one(
                {"username": user["username"], "line_id": {"$exists": False}},
                {"$set": {"line_id": user["line_id"]}},
            )

    def get_user_by_username(self, username: str) -> Optional[dict]:
        if self.users_collection is None:
            return None
        return self.users_collection.find_one(
            {"username": username},
            {
                "_id": 0,
                "password_hash": 1,
                "role": 1,
                "name": 1,
                "username": 1,
                "email": 1,
                "line_id": 1,
            },
        )

    def list_users(self) -> List[dict]:
        if self.users_collection is None:
            return []
        cursor = self.users_collection.find(
            {},
            {
                "_id": 0,
                "username": 1,
                "name": 1,
                "role": 1,
                "email": 1,
            },
        ).sort("username", 1)
        return [
            {
                "username": row.get("username", ""),
                "name": row.get("name", ""),
                "role": row.get("role", ""),
                "has_email": bool(row.get("email")),
            }
            for row in cursor
        ]

    def authenticate_user(self, username: str, password: str) -> Optional[dict]:
        user = self.get_user_by_username(username)
        if not user:
            return None

        password_hash = user.get("password_hash")
        if not isinstance(password_hash, str) or not verify_password(password, password_hash):
            return None

        return {
            "username": user["username"],
            "role": user["role"],
            "name": user["name"],
            "email": user.get("email", ""),
            "line_id": user.get("line_id", ""),
        }

    def upsert_user(self, username: str, password: str, role: str, name: str, email: str, line_id: str) -> None:
        if self.users_collection is None:
            return

        self.users_collection.update_one(
            {"username": username},
            {
                "$set": {
                    "username": username,
                    "password_hash": hash_password(password),
                    "role": role,
                    "name": name,
                    "email": email,
                    "line_id": line_id,
                }
            },
            upsert=True,
        )

    def close(self) -> None:
        if self.mongo_client is None:
            return
        try:
            self.mongo_client.close()
        except Exception:
            pass


class MaintenanceStorageService:
    def __init__(self, mongo_uri: str):
        self.mongo_uri = mongo_uri
        self.mongo_client: Optional[MongoClient] = None
        self.maintenance_collection: Optional[Collection] = None
        self.is_ready = False

    def init(self) -> None:
        try:
            self.mongo_client = MongoClient(self.mongo_uri, serverSelectionTimeoutMS=2000)
            db = self.mongo_client["datacenter"]
            self.maintenance_collection = db["maintenance_schedules"]
            self.maintenance_collection.create_index([("scheduled_at", 1)])
            self.maintenance_collection.create_index([("scheduled_at_ts", 1)])
            self.maintenance_collection.create_index([("assignee_username", 1)])
            self._backfill_existing_schedules()
            self.is_ready = True
            print("MongoDB maintenance collection ready...")
        except Exception as exc:
            self.is_ready = False
            print(f"Maintenance storage initialization failed: {exc}")

    def _backfill_existing_schedules(self) -> None:
        if self.maintenance_collection is None:
            return

        cursor = self.maintenance_collection.find(
            {
                "$or": [
                    {"scheduled_at_ts": {"$exists": False}},
                    {"reminder_sent_at": {"$exists": False}},
                    {"reminder_sent": {"$exists": False}},
                    {"reminder_last_attempt_at": {"$exists": False}},
                    {"reminder_error": {"$exists": False}},
                ]
            },
            {
                "_id": 0,
                "id": 1,
                "scheduled_at": 1,
                "scheduled_at_ts": 1,
                "reminder_sent": 1,
                "reminder_sent_at": 1,
                "reminder_last_attempt_at": 1,
                "reminder_error": 1,
            },
        )
        for row in cursor:
            update_doc: dict = {}
            scheduled_at = str(row.get("scheduled_at", "")).strip()
            if "scheduled_at_ts" not in row and scheduled_at:
                try:
                    update_doc["scheduled_at_ts"] = int(datetime.fromisoformat(scheduled_at).timestamp() * 1000)
                except ValueError:
                    pass
            if "reminder_sent" not in row:
                update_doc["reminder_sent"] = False
            if "reminder_sent_at" not in row:
                update_doc["reminder_sent_at"] = 0
            if "reminder_last_attempt_at" not in row:
                update_doc["reminder_last_attempt_at"] = 0
            if "reminder_error" not in row:
                update_doc["reminder_error"] = ""
            if update_doc:
                self.maintenance_collection.update_one({"id": row["id"]}, {"$set": update_doc})

    def list_schedules(self) -> List[dict]:
        if self.maintenance_collection is None:
            return []
        cursor = self.maintenance_collection.find({}, {"_id": 0}).sort(
            [("scheduled_at_ts", 1), ("created_at", -1)]
        )
        return list(cursor)

    def list_due_email_schedules(self, now_ts_ms: int, retry_after_ms: int = 300000, limit: int = 20) -> List[dict]:
        if self.maintenance_collection is None:
            return []
        cursor = self.maintenance_collection.find(
            {
                "notify_email": True,
                "reminder_email": {"$ne": ""},
                "reminder_sent": {"$ne": True},
                "scheduled_at_ts": {"$lte": now_ts_ms},
                "$or": [
                    {"reminder_last_attempt_at": {"$exists": False}},
                    {"reminder_last_attempt_at": {"$lte": now_ts_ms - retry_after_ms}},
                ],
            },
            {"_id": 0},
        ).sort([("scheduled_at_ts", 1), ("created_at", 1)]).limit(limit)
        return list(cursor)

    def create_schedule(
        self,
        *,
        target: str,
        task_type: str,
        scheduled_at: str,
        assignee_username: str,
        assignee_name: str,
        assignee_role: str,
        assignee_email: str,
        notify_email: bool,
        notes: str,
    ) -> dict:
        if self.maintenance_collection is None:
            raise RuntimeError("Maintenance collection unavailable")
        scheduled_at_ts = int(datetime.fromisoformat(scheduled_at).timestamp() * 1000)

        doc = {
            "id": secrets.token_hex(8),
            "target": target,
            "task_type": task_type,
            "scheduled_at": scheduled_at,
            "scheduled_at_ts": scheduled_at_ts,
            "status": "SCHEDULED",
            "assignee_username": assignee_username,
            "assignee_name": assignee_name,
            "assignee_role": assignee_role,
            "notify_email": notify_email,
            "reminder_email": assignee_email if notify_email else "",
            "reminder_sent": False,
            "reminder_sent_at": 0,
            "reminder_last_attempt_at": 0,
            "reminder_error": "",
            "notes": notes,
            "created_at": int(time.time() * 1000),
            "updated_at": int(time.time() * 1000),
        }
        self.maintenance_collection.insert_one(doc)
        return {key: value for key, value in doc.items() if key != "_id"}

    def update_schedule(
        self,
        schedule_id: str,
        *,
        target: str,
        task_type: str,
        scheduled_at: str,
        assignee_username: str,
        assignee_name: str,
        assignee_role: str,
        assignee_email: str,
        notify_email: bool,
        notes: str,
    ) -> Optional[dict]:
        if self.maintenance_collection is None:
            raise RuntimeError("Maintenance collection unavailable")

        existing = self.maintenance_collection.find_one({"id": schedule_id}, {"_id": 0})
        if existing is None:
            return None

        scheduled_at_ts = int(datetime.fromisoformat(scheduled_at).timestamp() * 1000)
        reminder_email = assignee_email if notify_email else ""
        delivery_fields_changed = (
            str(existing.get("scheduled_at", "")) != scheduled_at
            or str(existing.get("assignee_username", "")) != assignee_username
            or str(existing.get("reminder_email", "")) != reminder_email
            or bool(existing.get("notify_email", False)) != notify_email
        )

        update_doc = {
            "target": target,
            "task_type": task_type,
            "scheduled_at": scheduled_at,
            "scheduled_at_ts": scheduled_at_ts,
            "assignee_username": assignee_username,
            "assignee_name": assignee_name,
            "assignee_role": assignee_role,
            "notify_email": notify_email,
            "reminder_email": reminder_email,
            "notes": notes,
            "updated_at": int(time.time() * 1000),
        }

        if not notify_email:
            update_doc.update(
                {
                    "reminder_sent": False,
                    "reminder_sent_at": 0,
                    "reminder_last_attempt_at": 0,
                    "reminder_error": "",
                    "status": "SCHEDULED",
                }
            )
        elif delivery_fields_changed:
            update_doc.update(
                {
                    "reminder_sent": False,
                    "reminder_sent_at": 0,
                    "reminder_last_attempt_at": 0,
                    "reminder_error": "",
                    "status": "SCHEDULED",
                }
            )

        self.maintenance_collection.update_one({"id": schedule_id}, {"$set": update_doc})
        return self.maintenance_collection.find_one({"id": schedule_id}, {"_id": 0})

    def delete_schedule(self, schedule_id: str) -> bool:
        if self.maintenance_collection is None:
            raise RuntimeError("Maintenance collection unavailable")
        result = self.maintenance_collection.delete_one({"id": schedule_id})
        return result.deleted_count > 0

    def mark_email_sent(self, schedule_id: str) -> None:
        if self.maintenance_collection is None:
            return
        self.maintenance_collection.update_one(
            {"id": schedule_id},
            {
                "$set": {
                    "reminder_sent": True,
                    "reminder_sent_at": int(time.time() * 1000),
                    "reminder_last_attempt_at": int(time.time() * 1000),
                    "reminder_error": "",
                    "status": "EMAIL_SENT",
                }
            },
        )

    def mark_email_failed(self, schedule_id: str, error: str) -> None:
        if self.maintenance_collection is None:
            return
        self.maintenance_collection.update_one(
            {"id": schedule_id},
            {
                "$set": {
                    "reminder_last_attempt_at": int(time.time() * 1000),
                    "reminder_error": error[:500],
                    "status": "EMAIL_RETRY_PENDING",
                }
            },
        )

    def close(self) -> None:
        if self.mongo_client is None:
            return
        try:
            self.mongo_client.close()
        except Exception:
            pass

