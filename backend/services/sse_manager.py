"""SSE (Server-Sent Events) broadcast manager.

Maintains a set of asyncio.Queue instances, one per connected frontend client.
When `broadcast()` is called (from process_message), each queue receives a copy
of the data, which the corresponding SSE endpoint generator yields as an event.
"""
from __future__ import annotations

import asyncio
import json
from typing import AsyncGenerator, Set


class SSEManager:
    def __init__(self) -> None:
        self._queues: Set[asyncio.Queue] = set()

    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._queues.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._queues.discard(q)

    def broadcast(self, data: dict) -> None:
        """Push data to every connected client queue (non-blocking)."""
        payload = json.dumps(data, ensure_ascii=False)
        dead: list[asyncio.Queue] = []
        for q in self._queues:
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            self._queues.discard(q)

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
