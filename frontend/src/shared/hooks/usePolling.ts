"use client";

import { useEffect, useRef } from "react";

type PollingOptions = {
  intervalMs: number;
  immediate?: boolean;
};

/**
 * Reusable polling hook with overlap guard.
 * It avoids concurrent fetch loops when a previous tick is still in flight.
 */
export function usePolling(task: () => Promise<void>, options: PollingOptions) {
  const { intervalMs, immediate = true } = options;
  const inFlightRef = useRef(false);
  const taskRef = useRef(task);
  taskRef.current = task;

  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (cancelled || inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        await taskRef.current();
      } finally {
        inFlightRef.current = false;
      }
    };

    if (immediate) {
      void tick();
    }

    const timer = setInterval(() => {
      void tick();
    }, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [intervalMs, immediate]);
}

