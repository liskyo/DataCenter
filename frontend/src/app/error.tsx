"use client";

import { useEffect } from "react";

/** Next.js `app/error.tsx` 必須是 Client Component，且不可包 `<html>` / `<body>`（由 root layout 提供） */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="min-h-[40vh] flex items-center justify-center p-6">
      <div className="w-full max-w-2xl border border-rose-900 bg-[#1a0b13] p-6 rounded-lg">
        <h2 className="text-rose-400 text-xl font-bold mb-2">頁面發生錯誤</h2>
        <p className="text-slate-400 text-sm mb-4">
          請點擊下方按鈕重試此頁面。
        </p>
        <button
          type="button"
          onClick={reset}
          className="px-4 py-2 border border-cyan-700 text-cyan-300 hover:bg-cyan-900/40 transition"
        >
          重試
        </button>
      </div>
    </div>
  );
}
