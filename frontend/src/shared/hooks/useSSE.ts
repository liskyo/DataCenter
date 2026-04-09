"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { BACKEND_BASE_URL } from "@/shared/api";

type SSEOptions = {
  /** Fallback polling interval in ms if SSE fails (default: 3000) */
  fallbackPollingMs?: number;
  /** Called with the full metrics map on every update */
  onUpdate: (metrics: Record<string, any>) => void;
  /** URL for fallback polling */
  fallbackUrl?: string;
  /** Batch UI updates to avoid rerendering per-event */
  updateIntervalMs?: number;
};

/**
 * useSSE - connects to the backend SSE `/stream` endpoint.
 * Accumulates per-server metrics into a map and calls `onUpdate`
 * with the full map on every event.
 *
 * Falls back to polling `/metrics` if SSE connection fails.
 */
export function useSSE({ onUpdate, fallbackPollingMs = 3000, fallbackUrl, updateIntervalMs = 250 }: SSEOptions) {
  const metricsRef = useRef<Record<string, any>>({});
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState<"sse" | "polling" | "connecting">("connecting");
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(false);
  const lastMessageAtRef = useRef(0);

  const normalizeNodeId = useCallback((value: string): string => {
    const raw = (value || "").trim().toUpperCase().replace(/\s+/g, "").replace(/_/g, "-");
    const m = raw.match(/^(SERVER|SW|IMM|CDU)-?(\d+)$/);
    if (!m) return raw;
    return `${m[1]}-${String(Number(m[2])).padStart(3, "0")}`;
  }, []);

  const collectKeys = useCallback((item: any): string[] => {
    const keys = new Set<string>();
    [item?.asset_id, item?.server_id, item?.node_id, item?.device_id]
      .filter((v) => typeof v === "string")
      .forEach((id: any) => {
        keys.add(id);
        keys.add(normalizeNodeId(id));
      });
    return Array.from(keys);
  }, [normalizeNodeId]);

  const handleEvent = useCallback(
    (raw: string) => {
      try {
        const data = JSON.parse(raw);
        const keys = collectKeys(data);
        if (keys.length > 0) {
          const primaryKey = keys[0];
          const prev = metricsRef.current[primaryKey];
          const prevTs = prev?.timestamp;
          const nextTs = data?.timestamp;
          // Skip no-op updates (same timestamp payload) to reduce re-render pressure.
          if (prevTs !== undefined && nextTs !== undefined && prevTs === nextTs) {
            return;
          }
          keys.forEach((k) => {
            metricsRef.current[k] = data;
          });
          pendingRef.current = true;
          if (!flushTimerRef.current) {
            flushTimerRef.current = setTimeout(() => {
              flushTimerRef.current = null;
              if (!pendingRef.current) return;
              pendingRef.current = false;
              onUpdate(metricsRef.current);
            }, updateIntervalMs);
          }
        }
      } catch {
        // ignore malformed events
      }
    },
    [onUpdate, updateIntervalMs]
  );

  useEffect(() => {
    let cancelled = false;
    let eventSource: EventSource | null = null;
    let pollingTimer: ReturnType<typeof setInterval> | null = null;
    let silentCheckTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setInterval> | null = null;
    const pollUrl = fallbackUrl || `${BACKEND_BASE_URL}/metrics`;
    const reconnectMs = 10000;

    const pollOnce = async () => {
      try {
        const res = await fetch(pollUrl);
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          const map: Record<string, any> = {};
          json.data.forEach((item: any) => {
            collectKeys(item).forEach((k) => {
              map[k] = item;
            });
          });
          metricsRef.current = map;
          if (Object.keys(map).length > 0) {
            lastMessageAtRef.current = Date.now();
          }
          onUpdate(map);
        }
      } catch {
        // ignore polling errors
      }
    };

    const stopPolling = () => {
      if (pollingTimer) {
        clearInterval(pollingTimer);
        pollingTimer = null;
      }
    };

    const stopReconnect = () => {
      if (reconnectTimer) {
        clearInterval(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const switchToPolling = () => {
      if (cancelled) return;
      eventSource?.close();
      eventSource = null;
      setConnected(false);
      setMode("polling");
      void pollOnce();
      if (!pollingTimer) {
        pollingTimer = setInterval(pollOnce, fallbackPollingMs);
      }
      if (silentCheckTimer) {
        clearInterval(silentCheckTimer);
        silentCheckTimer = null;
      }
      // Keep retrying SSE in background while polling.
      if (!reconnectTimer) {
        reconnectTimer = setInterval(() => {
          if (cancelled || eventSource) return;
          openSSE();
        }, reconnectMs);
      }
    };

    const openSSE = () => {
      if (cancelled || eventSource) return;
      const url = `${BACKEND_BASE_URL}/stream`;
      const es = new EventSource(url);
      eventSource = es;

      es.onopen = () => {
        if (cancelled) return;
        setConnected(true);
        setMode("sse");
      };

      es.onmessage = (e) => {
        if (cancelled) return;
        // First message confirms stream is healthy, switch back from polling.
        stopPolling();
        stopReconnect();
        lastMessageAtRef.current = Date.now();
        handleEvent(e.data);
      };

      es.onerror = () => {
        if (cancelled) return;
        switchToPolling();
      };
    };

    // Seed initial data quickly even before first SSE message arrives.
    void pollOnce();

    // Try SSE first
    openSSE();

    // If SSE connects but remains silent, proactively switch to polling.
    silentCheckTimer = setInterval(() => {
      if (cancelled || !eventSource || pollingTimer) return;
      const idleMs = Date.now() - lastMessageAtRef.current;
      if (lastMessageAtRef.current === 0 || idleMs > Math.max(8000, fallbackPollingMs * 2)) {
        switchToPolling();
      }
    }, 2000);

    return () => {
      cancelled = true;
      eventSource?.close();
      stopPolling();
      if (silentCheckTimer) clearInterval(silentCheckTimer);
      stopReconnect();
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      pendingRef.current = false;
    };
  }, [collectKeys, fallbackPollingMs, fallbackUrl, handleEvent, onUpdate]);

  return { connected, mode };
}
