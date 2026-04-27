"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { usePolling } from "@/shared/hooks/usePolling";
import { apiUrl } from "@/shared/api";
import { authFetch } from "@/shared/auth";
import { useLanguage } from "@/shared/i18n/language";

type AlertLog = {
  server_id: string;
  type: string;
  message: string;
  timestamp: number;
};

export default function LogsPage() {
  const { language } = useLanguage();
  const [logs, setLogs] = useState<AlertLog[]>([]);
  const t = language === "en"
    ? {
      title: "SYSTEM LOGS & ALERTS",
      subtitle: "Data persistence layer powered by MongoDB",
      waiting: "Waiting for incoming logs... System healthy.",
    }
    : {
      title: "系統日誌與告警",
      subtitle: "MongoDB 持久化告警紀錄層",
      waiting: "等待告警資料中... 目前系統健康。",
    };

  usePolling(async () => {
    try {
      const res = await authFetch(apiUrl("/alerts"));
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data);
      }
    } catch (e) { }
  }, { intervalMs: 2000, immediate: true });

  return (
    <div className="p-4 md:p-8 pb-20 w-full h-full flex flex-col">
      <header className="mb-6 flex items-center gap-4 bg-[#0a1e3f]/30 p-4 rounded-xl border border-[#1e3a8a]">
        <FileText size={32} className="text-[#4ea8de]" />
        <div>
          <h1 className="text-2xl font-black text-[#4ea8de] tracking-widest uppercase shadow-sm">
            {t.title}
          </h1>
          <p className="text-slate-400 text-xs font-mono tracking-widest mt-1">{t.subtitle}</p>
        </div>
      </header>

      <div className="flex-1 bg-black border border-cyan-900 rounded-lg overflow-hidden flex flex-col font-mono relative shadow-[0_0_20px_rgba(6,182,212,0.1)]">
        {/* Terminal Header */}
        <div className="bg-[#050f24] border-b border-cyan-900 px-4 py-2 flex items-center justify-between">
          <span className="text-cyan-500 text-xs font-bold tracking-widest">root@datacenter-core:/var/log/syslog$</span>
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
          </div>
        </div>

        {/* Console Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar text-[13px]">
          {logs.length === 0 ? (
            <div className="text-emerald-500 animate-pulse">{t.waiting}</div>
          ) : (
            logs.map((log, i) => {
              const date = new Date(log.timestamp);
              const rowStyle =
                log.type === "AI_ANOMALY"
                  ? "text-rose-400 bg-rose-950/20"
                  : log.type === "MAINTENANCE_EMAIL_FAILED"
                    ? "text-red-400 bg-red-950/20"
                    : log.type === "MAINTENANCE_EMAIL_SENT"
                      ? "text-emerald-400 bg-emerald-950/20"
                  : log.type === "HIGH_TEMPERATURE"
                    ? "text-red-400 bg-red-950/20"
                    : log.type === "HIGH_TEMPERATURE_WARNING"
                      ? "text-amber-400 bg-amber-950/15"
                      : log.type === "TEMPERATURE_NORMAL"
                        ? "text-emerald-400 bg-emerald-950/20"
                        : "text-amber-400";
              const tagStyle =
                log.type === "AI_ANOMALY"
                  ? "text-rose-500"
                  : log.type === "MAINTENANCE_EMAIL_FAILED"
                    ? "text-red-500"
                    : log.type === "MAINTENANCE_EMAIL_SENT"
                      ? "text-emerald-500"
                  : log.type === "HIGH_TEMPERATURE"
                    ? "text-red-500"
                    : log.type === "HIGH_TEMPERATURE_WARNING"
                      ? "text-amber-500"
                      : log.type === "TEMPERATURE_NORMAL"
                        ? "text-emerald-500"
                        : "text-amber-500";
              return (
                <div key={i} className={`flex gap-4 p-2 rounded hover:bg-white/5 transition-colors ${rowStyle}`}>
                  <span className="text-slate-500 shrink-0">[{date.toLocaleString('zh-TW', { hour12: false })}]</span>
                  <span className="shrink-0 font-bold w-[120px]">{log.server_id}</span>
                  <span className={`shrink-0 font-bold w-[160px] ${tagStyle}`}>[{log.type}]</span>
                  <span className="flex-1">{log.message}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
