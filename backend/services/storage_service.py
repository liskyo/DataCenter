from __future__ import annotations

from typing import List, Optional

from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import ASYNCHRONOUS
from pymongo import MongoClient
from pymongo.collection import Collection


class InfluxService:
    def __init__(self, url: str, token: str, org: str, bucket: str):
        self.org = org
        self.bucket = bucket
        self.client = InfluxDBClient(url=url, token=token, org=org)
        self.write_api = self.client.write_api(write_options=ASYNCHRONOUS)

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

