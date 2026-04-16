"""SSE (Server-Sent Events) broadcast manager.

Maintains a set of asyncio.Queue instances, one per connected frontend client.
When `broadcast()` is called (from process_message), it publishes to Redis.
The background task listens to Redis and pushes to local frontend client queues.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import AsyncGenerator, Set

try:
    import redis
    import redis.asyncio as aioredis
except ImportError:
    redis = None
    aioredis = None


class SSEManager:
    def __init__(self, redis_url: str = "redis://localhost:6379/0") -> None:
        self.redis_url = redis_url
        self._queues: Set[asyncio.Queue] = set()
        self._async_client = None
        self._pubsub = None
        self._listener_task: asyncio.Task | None = None
        
        # Sync client used for thread-safe publishing from standard threads (Kafka worker)
        self._sync_client = None
        if redis is not None:
            self._sync_client = redis.StrictRedis.from_url(self.redis_url, decode_responses=True)

    async def connect(self):
        """Called inside the FastAPI startup event loop."""
        if aioredis is None:
            logging.error("Redis library is missing. PubSub will not work.")
            return
        
        try:
            self._async_client = aioredis.from_url(self.redis_url, decode_responses=True)
            self._pubsub = self._async_client.pubsub()
            await self._pubsub.subscribe("datacenter_events")
            self._listener_task = asyncio.create_task(self._listen_redis())
            logging.info("SSEManager explicitly connected to Redis and subscribed to datacenter_events")
        except Exception as e:
            logging.error(f"Failed to connect SSEManager to Redis: {e}")

    async def disconnect(self):
        """Called inside the FastAPI shutdown event loop."""
        if self._listener_task:
            self._listener_task.cancel()
        if self._pubsub:
            await self._pubsub.unsubscribe("datacenter_events")
            await self._pubsub.close()
        if self._async_client:
            await self._async_client.aclose()
        if self._sync_client:
            self._sync_client.close()

    async def _listen_redis(self):
        try:
            async for message in self._pubsub.listen():
                if message["type"] == "message":
                    payload = message["data"]
                    self._local_broadcast(payload)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logging.error(f"Redis listen error: {e}")

    def _local_broadcast(self, payload: str) -> None:
        """Push data to every connected client queue in this worker (non-blocking)."""
        dead: list[asyncio.Queue] = []
        for q in self._queues:
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            self._queues.discard(q)

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._queues.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._queues.discard(q)

    def broadcast(self, data: dict) -> None:
        """Publish data to Redis. Called from generic sync threads."""
        payload = json.dumps(data, ensure_ascii=False)
        
        # If Redis is unavailable due to missing package or config error, fallback to local broadcast
        if not self._sync_client:
            self._local_broadcast(payload)
            return

        try:
            self._sync_client.publish("datacenter_events", payload)
        except Exception as e:
            logging.error(f"Redis publish error: {e}")
            # Fallback local broadcast if Redis is unreachable
            self._local_broadcast(payload)

    async def event_generator(self, q: asyncio.Queue) -> AsyncGenerator[str, None]:
        """Yield SSE-formatted events from the queue."""
        try:
            while True:
                payload = await q.get()
                yield f"data: {payload}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            self.unsubscribe(q)

    @property
    def client_count(self) -> int:
        return len(self._queues)
