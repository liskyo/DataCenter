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
};

/**
 * useSSE - connects to the backend SSE `/stream` endpoint.
 * Accumulates per-server metrics into a map and calls `onUpdate`
 * with the full map on every event.
 *
 * Falls back to polling `/metrics` if SSE connection fails.
 */
export function useSSE({ onUpdate, fallbackPollingMs = 3000, fallbackUrl }: SSEOptions) {
  const metricsRef = useRef<Record<string, any>>({});
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState<"sse" | "polling" | "connecting">("connecting");

  const normalizeNodeId = (value: string): string => {
    const raw = (value || "").trim().toUpperCase().replace(/\s+/g, "").replace(/_/g, "-");
    const m = raw.match(/^(SERVER|SW|IMM|CDU)-?(\d+)$/);
    if (!m) return raw;
    return `${m[1]}-${String(Number(m[2])).padStart(3, "0")}`;
  };

  const collectKeys = (item: any): string[] => {
    const keys = new Set<string>();
    [item?.asset_id, item?.server_id, item?.node_id, item?.device_id]
      .filter((v) => typeof v === "string")
      .forEach((id: any) => {
        keys.add(id);
        keys.add(normalizeNodeId(id));
      });
    return Array.from(keys);
  };

  const handleEvent = useCallback(
    (raw: string) => {
      try {
        const data = JSON.parse(raw);
        const keys = collectKeys(data);
        if (keys.length > 0) {
          const next = { ...metricsRef.current };
          keys.forEach((k) => {
            next[k] = data;
          });
          metricsRef.current = next;
          onUpdate(metricsRef.current);
        }
      } catch {
        // ignore malformed events
      }
    },
    [onUpdate]
  );

  useEffect(() => {
    let cancelled = false;
    let eventSource: EventSource | null = null;
    let pollingTimer: ReturnType<typeof setInterval> | null = null;

    // Try SSE first
    const url = `${BACKEND_BASE_URL}/stream`;
    eventSource = new EventSource(url);

    eventSource.onopen = () => {
      if (cancelled) return;
      setConnected(true);
      setMode("sse");
    };

    eventSource.onmessage = (e) => {
      if (cancelled) return;
      handleEvent(e.data);
    };

    eventSource.onerror = () => {
      if (cancelled) return;
      // SSE failed - fall back to polling
      eventSource?.close();
      eventSource = null;
      setConnected(false);
      setMode("polling");

      const pollUrl = fallbackUrl || `${BACKEND_BASE_URL}/metrics`;
      const poll = async () => {
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
            onUpdate(map);
          }
        } catch {
          // ignore polling errors
        }
      };

      void poll();
      pollingTimer = setInterval(poll, fallbackPollingMs);
    };

    return () => {
      cancelled = true;
      eventSource?.close();
      if (pollingTimer) clearInterval(pollingTimer);
    };
  }, [handleEvent, fallbackPollingMs, fallbackUrl, onUpdate]);

  return { connected, mode };
}
