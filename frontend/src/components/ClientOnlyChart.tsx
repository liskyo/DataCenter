"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 1) 僅在瀏覽器執行
 * 2) 等外層容器量到寬高 > 0 後才掛載圖表，避免 Recharts ResponsiveContainer 量到 -1 而洗版警告
 */
export function ClientOnlyChart({
  children,
  placeholderClassName,
}: {
  children: React.ReactNode;
  placeholderClassName?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [hasSize, setHasSize] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    if (width > 2 && height > 2) {
      setHasSize(true);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    const onWin = () => measure();
    window.addEventListener("resize", onWin);
    const raf = requestAnimationFrame(() => measure());
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onWin);
      cancelAnimationFrame(raf);
    };
  }, [mounted, measure]);

  return (
    <div
      ref={ref}
      className={placeholderClassName ?? "h-full w-full min-h-[180px]"}
      aria-hidden={!hasSize}
    >
      {mounted && hasSize ? children : null}
    </div>
  );
}
