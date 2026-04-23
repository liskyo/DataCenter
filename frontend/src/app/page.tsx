"use client";

import { memo, useDeferredValue, useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from "recharts";
import { Activity, AlertTriangle, Cpu, Thermometer, Clock, Database, Power, LayoutGrid, Box, Link2, Wifi, WifiOff, Zap, Droplets, Gauge } from "lucide-react";
import { useDcimStore } from "@/store/useDcimStore";
import { ClientOnlyChart } from "@/components/ClientOnlyChart";
import { useSSE } from "@/shared/hooks/useSSE";
import { apiUrl } from "@/shared/api";
import { authFetch } from "@/shared/auth";
import { useLanguage } from "@/shared/i18n/language";
// 與 3D 視圖共用狀態判斷，閾值定義於 @/shared/status。
import { getDeviceStatus } from "@/shared/status";
import { normalizeNodeId, buildTelemetryKeys } from "@/shared/nodeId";

/** 機房配置 ID 與後端 metrics 鍵（大小寫／補零／asset vs server）對齊 */
function findTelemetryForItem(
  m: Map<string, ServerTelemetry>,
  assetId: string | undefined,
  name: string | undefined,
): ServerTelemetry | undefined {
  const candidates = [assetId, name].flatMap((v) => {
    if (!v || typeof v !== "string" || !v.trim()) return [];
    const t = v.trim();
    return [t, normalizeNodeId(t)];
  });
  for (const k of candidates) {
    const hit = m.get(k);
    if (hit) return hit;
  }
  return undefined;
}

type ServerTelemetry = {
  server_id: string;
  asset_id?: string;
  cpu_usage: number;
  temperature: number;
  timestamp: number;
  traffic_gbps?: number;
  ports_active?: number;
  ports_total?: number;
  power_state?: 'on' | 'off';
};

type TrendPoint = {
  time: string;
  avgCpu: number;
  avgTemp: number;
};

type MatrixItem = {
  id: string;
  assetId?: string;
  name: string;
  rackName: string;
  type: string;
};

type MatrixRow = {
  item: MatrixItem;
  srv?: ServerTelemetry;
  liveStatus: string;
  isOff: boolean;
};

const MATRIX_ITEMS_PER_PAGE = 20;
const MAX_ALARM_RENDER = 180;
const MAX_BAR_RENDER = 180;
const DASHBOARD_SSE_UPDATE_MS = 500;

function buildTelemetrySignature(rows: ServerTelemetry[]): string {
  return rows
    .map((row) => {
      const id = normalizeNodeId(String(row.server_id || row.asset_id || "").trim());
      return `${id}:${row.timestamp ?? 0}:${row.power_state ?? ""}`;
    })
    .sort()
    .join("|");
}

const TechPanel = memo(({ title, children, className = "" }: { title: string, children: React.ReactNode, className?: string }) => (
  <div className={`relative bg-[#020b1a] border border-[#1e3a8a] flex flex-col ${className}`}>
    {/* 科幻角落裝飾 */}
    <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-cyan-400"></div>
    <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-cyan-400"></div>
    <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-cyan-400"></div>
    <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-cyan-400"></div>

    <div className="px-4 py-2 border-b border-[#1e3a8a] bg-gradient-to-r from-[#0a1e3f] to-transparent">
      <h3 className="text-cyan-400 font-bold text-sm tracking-widest flex items-center gap-2">
        <Activity size={16} />
        {title}
      </h3>
    </div>
    {/* min-h-0：flex 子項預設 min-height:auto 會卡住高度計算，Recharts 會量到 -1 */}
    <div className="flex-1 min-h-0 p-4 relative overflow-hidden w-full">
      {children}
    </div>
  </div>
));

const LiquidCoolingPanel = memo(({ title, cduData, className = "" }: { title: string, cduData: any[], className?: string }) => (
  <TechPanel title={title} className={className}>
    <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
      <div className="flex flex-col gap-4">
      {cduData.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-slate-600 italic text-xs font-mono tracking-widest">
          NO CDU DETECTED IN ZONE
        </div>
      ) : (
        cduData.map((cdu, idx) => (
          <div key={idx} className="bg-[#03112b] border border-blue-900/40 rounded p-3 relative overflow-hidden group">
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/5 blur-3xl rounded-full -mr-10 -mt-10 group-hover:bg-blue-500/10 transition-colors"></div>
            
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>
                <span className="font-mono font-bold text-cyan-100 text-sm">{cdu.name || cdu.server_id}</span>
              </div>
              <div className="text-[10px] bg-blue-950 border border-blue-800 px-1.5 py-0.5 rounded text-blue-400 font-mono">
                DLC-MODE
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px]">
              {[
                {
                  label: "SUPPLY",
                  icon: <Thermometer size={10} />,
                  value: cdu.inlet_temp?.toFixed(1) ?? "--",
                  suffix: "°C",
                  color: "text-sky-400",
                },
                {
                  label: "RETURN",
                  icon: <Thermometer size={10} />,
                  value: cdu.outlet_temp?.toFixed(1) ?? "--",
                  suffix: "°C",
                  color: cdu.outlet_temp > 45 ? "text-red-400" : "text-orange-400",
                },
                {
                  label: "FLOW",
                  icon: <Droplets size={10} />,
                  value: cdu.flow_rate_lpm?.toFixed(1) ?? "--",
                  suffix: " LPM",
                  color: cdu.flow_rate_lpm < 5 ? "text-red-400" : "text-cyan-400",
                },
                {
                  label: "PRESSURE",
                  icon: <Gauge size={10} />,
                  value: cdu.pressure_bar?.toFixed(2) ?? "--",
                  suffix: " bar",
                  color: "text-violet-400",
                },
                {
                  label: "PUMP A",
                  icon: <Activity size={10} />,
                  value: cdu.pump_a_rpm ?? "---",
                  suffix: " RPM",
                  color: "text-emerald-400",
                },
                {
                  label: "PUMP B",
                  icon: <Activity size={10} />,
                  value: cdu.pump_b_rpm ?? "---",
                  suffix: " RPM",
                  color: "text-emerald-400",
                },
                {
                  label: "TANK",
                  icon: <Zap size={10} />,
                  value: cdu.reservoir_level ?? "--",
                  suffix: "%",
                  color: cdu.reservoir_level < 30 ? "text-red-400" : "text-slate-300",
                },
                {
                  label: "VALVE",
                  icon: <Gauge size={10} />,
                  value: cdu.valve_position ?? "---",
                  suffix: "%",
                  color: "text-slate-300",
                },
                {
                  label: "CHW↓",
                  icon: <Thermometer size={10} />,
                  value: cdu.facility_supply_temp?.toFixed(1) ?? "--",
                  suffix: "°C",
                  color: "text-sky-300",
                },
                {
                  label: "CHW↑",
                  icon: <Thermometer size={10} />,
                  value: cdu.facility_return_temp?.toFixed(1) ?? "--",
                  suffix: "°C",
                  color: "text-sky-300",
                },
              ].map((row) => (
                <div key={row.label} className="flex justify-between items-center gap-2">
                  <span className="text-slate-500 flex items-center gap-1">
                    {row.icon}
                    {row.label}
                  </span>
                  <span className={`font-mono font-bold ${row.color}`}>{row.value}{row.suffix}</span>
                </div>
              ))}
            </div>

            {cdu.leak_detected && (
              <div className="mt-3 bg-red-900/30 border border-red-500/50 rounded py-1 px-2 flex items-center justify-center gap-2 animate-pulse">
                <AlertTriangle size={12} className="text-red-500" />
                <span className="text-[10px] font-black text-red-500 tracking-tighter">LEAKAGE DETECTED - EMERGENCY STOP</span>
              </div>
            )}
          </div>
        ))
      )}
      </div>
    </div>
  </TechPanel>
));

const ImmersionCoolingPanel = memo(({ title, immersionData, className = "" }: { title: string, immersionData: any[], className?: string }) => (
  <TechPanel title={title} className={className}>
    <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
      <div className="flex flex-col gap-4">
      {immersionData.length === 0 ? (
        <div className="flex items-center justify-center py-10 text-slate-600 italic text-xs font-mono tracking-widest">
          NO DUAL-PHASE TANKS DETECTED
        </div>
      ) : (
        immersionData.map((tank, idx) => (
          <div key={idx} className="bg-[#03112b] border border-purple-900/40 rounded p-3 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-20 h-20 bg-purple-500/5 blur-3xl rounded-full -mr-10 -mt-10 group-hover:bg-purple-500/10 transition-colors"></div>
            
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></div>
                <span className="font-mono font-bold text-purple-100 text-sm">{tank.server_id}</span>
              </div>
              <div className="text-[10px] bg-purple-950 border border-purple-800 px-1.5 py-0.5 rounded text-purple-400 font-mono">
                {tank.isDemo ? "DEMO-MODE" : "IMM-2P-PHASE"}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-500 flex items-center gap-1"><Droplets size={10} /> INLET FLOW</span>
                  <span className="font-mono text-purple-400 font-bold">{tank.flow_rate_lpm?.toFixed(1) ?? "--"} LPM</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-500 flex items-center gap-1"><Thermometer size={10} /> FLUID TEMP</span>
                  <span className="font-mono text-purple-300 font-bold">{tank.temperature?.toFixed(1) ?? "--"}°C</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-500 flex items-center gap-1"><Gauge size={10} /> VAPOR PRESS</span>
                  <span className="font-mono text-violet-400 font-bold">{tank.pressure_bar?.toFixed(2) ?? "--"} bar</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-500 flex items-center gap-1"><Database size={10} /> FLUID LEVEL</span>
                  <span className="font-mono text-emerald-400 font-bold">{tank.coolant_level ?? "--"}%</span>
                </div>
              </div>
            </div>
          </div>
        ))
      )}
      </div>
    </div>
  </TechPanel>
));

const DashboardHeader = memo(function DashboardHeader({
  title,
  simMode,
  connected,
  onToggleMode,
  simLabel,
  liveLabel,
}: {
  title: string;
  simMode: string;
  connected: boolean;
  onToggleMode: () => void;
  simLabel: string;
  liveLabel: string;
}) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString("zh-TW", { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="relative flex justify-between items-end px-8 py-3 mb-4 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
      <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent shadow-[0_0_10px_#06b6d4]"></div>

      <div className="flex items-center gap-4">
        <Database className="text-cyan-400 animate-pulse" size={32} />
        <h1 className="text-3xl font-black italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 uppercase drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]">
          {title}
        </h1>
      </div>

      <div className="flex gap-8 items-center text-sm font-bold font-mono text-cyan-500">
        <button
          onClick={onToggleMode}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all duration-300 ${simMode === 'simulation' ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.5)] hover:bg-cyan-900' : 'bg-[#0a1e3f] border-slate-600 text-slate-400 hover:border-slate-400'} text-[10px] uppercase tracking-widest`}
        >
          <div className={`w-2 h-2 rounded-full ${simMode === 'simulation' ? 'bg-cyan-400 animate-pulse' : 'bg-rose-500'}`}></div>
          {simMode === 'simulation' ? simLabel : liveLabel}
        </button>

        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            {connected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
            <span className={`relative inline-flex rounded-full h-3 w-3 ${connected ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-amber-500 shadow-[0_0_8px_#f59e0b]'}`}></span>
          </span>
          {connected ? (
            <><Wifi size={14} className="text-emerald-400" /> <span className="text-emerald-400 text-[10px] tracking-widest">SSE LIVE</span></>
          ) : (
            <><WifiOff size={14} className="text-amber-400" /> <span className="text-amber-400 text-[10px] tracking-widest">POLLING</span></>
          )}
        </div>
        <div className="flex items-center gap-2 bg-[#0a1e3f] border border-cyan-800 px-4 py-1 rounded-bl-xl rounded-tr-xl">
          <Clock size={16} />
          <span className="text-white">{time || "00:00:00"}</span>
        </div>
      </div>
    </header>
  );
});

const ServerMatrixPanel = memo(function ServerMatrixPanel({
  title,
  pageLabel,
  pageInfo,
  prevPage,
  nextPage,
  searchPlaceholder,
  clearLabel,
  awaiting,
  noMatchLabel,
  matrixQuery,
  onMatrixQueryChange,
  onClearMatrixQuery,
  visibleMatrixItems,
  filteredServerMatrixItems,
  matrixPage,
  totalMatrixPages,
  onPrevPage,
  onNextPage,
  telemetryById,
}: {
  title: string;
  pageLabel: string;
  pageInfo: (current: number, total: number, pageCount: number, allCount: number) => string;
  prevPage: string;
  nextPage: string;
  searchPlaceholder: string;
  clearLabel: string;
  awaiting: string;
  noMatchLabel: string;
  matrixQuery: string;
  onMatrixQueryChange: (value: string) => void;
  onClearMatrixQuery: () => void;
  visibleMatrixItems: MatrixItem[];
  filteredServerMatrixItems: MatrixItem[];
  matrixPage: number;
  totalMatrixPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  telemetryById: Map<string, ServerTelemetry>;
}) {
  const matrixRows = useMemo<MatrixRow[]>(
    () =>
      visibleMatrixItems.map((item) => {
        const srv = findTelemetryForItem(telemetryById, item.assetId, item.name);
        const liveStatus = getDeviceStatus(item, srv);
        return {
          item,
          srv,
          liveStatus,
          isOff: liveStatus === "powered_off",
        };
      }),
    [telemetryById, visibleMatrixItems]
  );

  return (
    <TechPanel title={title} className="flex-1">
      <div className="px-4 pt-2 flex flex-col gap-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <input
            type="text"
            value={matrixQuery}
            onChange={(e) => onMatrixQueryChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-none border border-cyan-900/60 bg-[#03112b] px-3 py-2 text-sm text-cyan-100 outline-none transition-colors placeholder:text-cyan-700/70 focus:border-cyan-400 md:max-w-sm"
          />
          {matrixQuery && (
            <button
              type="button"
              onClick={onClearMatrixQuery}
              className="border border-cyan-800 px-3 py-2 text-[11px] text-cyan-300 transition-colors hover:bg-cyan-950/40 md:self-stretch"
            >
              {clearLabel}
            </button>
          )}
        </div>
        {(filteredServerMatrixItems.length > MATRIX_ITEMS_PER_PAGE || matrixQuery) && (
          <div className="flex items-center justify-between gap-3 text-[10px] text-cyan-500/80 font-mono">
            <div>
              {pageLabel}：{pageInfo(matrixPage + 1, totalMatrixPages, matrixRows.length, filteredServerMatrixItems.length)}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onPrevPage}
                disabled={matrixPage === 0}
                className="px-2 py-1 border border-cyan-800 text-cyan-300 disabled:text-slate-600 disabled:border-slate-800 hover:bg-cyan-950/40 transition-colors"
              >
                {prevPage}
              </button>
              <button
                onClick={onNextPage}
                disabled={matrixPage >= totalMatrixPages - 1}
                className="px-2 py-1 border border-cyan-800 text-cyan-300 disabled:text-slate-600 disabled:border-slate-800 hover:bg-cyan-950/40 transition-colors"
              >
                {nextPage}
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-2">
        {matrixRows.length === 0 ? (
          <div className="col-span-full h-full flex items-center justify-center text-cyan-800 animate-pulse font-mono tracking-widest mt-20">
            {matrixQuery ? `${noMatchLabel}${matrixQuery}` : awaiting}
          </div>
        ) : (
          matrixRows.map(({ item, srv, liveStatus, isOff }) => {
            const borderColor = isOff ? 'border-slate-700' : liveStatus === 'critical' ? 'border-red-500' : liveStatus === 'warning' ? 'border-yellow-500' : 'border-cyan-500';
            const titleColor = isOff ? 'text-slate-500' : liveStatus === 'critical' ? 'text-red-400' : liveStatus === 'warning' ? 'text-yellow-400' : 'text-cyan-100';
            const shadowCss = isOff ? 'opacity-50 grayscale' : liveStatus === 'critical' ? 'shadow-[inset_0_0_15px_rgba(239,68,68,0.2)]' : liveStatus === 'warning' ? 'shadow-[inset_0_0_15px_rgba(245,158,11,0.2)]' : 'hover:bg-[#06183a]';

            if (!srv || isOff) {
              return (
                <div key={item.id} className={`p-4 border-l-4 bg-gradient-to-r from-[#03112b] to-transparent ${borderColor} ${isOff ? 'opacity-50 grayscale' : 'opacity-60'} hover:opacity-100 transition-all`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col">
                      <div className={`font-mono font-bold ${titleColor} text-lg`}>{item.name}</div>
                      <div className="text-[10px] text-slate-600 bg-[#0a1e3f] border border-slate-800 px-1.5 py-0.5 rounded w-fit flex items-center gap-1 mt-1">
                        <LayoutGrid size={10} /> {item.rackName}
                      </div>
                    </div>
                    <Power size={16} className={`${isOff ? 'text-slate-600' : 'text-slate-700'} mt-1`} />
                  </div>
                  <div className="mt-4 flex items-center justify-center py-5 bg-slate-900/30 rounded border border-slate-800/50">
                    <span className={`text-[10px] ${isOff ? 'text-slate-400' : 'text-slate-500'} tracking-widest font-mono`}>
                      {isOff ? "POWERED OFF" : "OFFLINE / NO SIGNAL"}
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div key={item.id || item.name} className={`p-4 border-l-4 bg-gradient-to-r from-[#03112b] to-transparent ${borderColor} ${shadowCss} transition-all`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col">
                    <div className={`font-mono font-bold ${titleColor} text-lg`}>{srv.server_id}</div>
                    <div className="text-[10px] text-cyan-500 bg-[#0a1e3f] border border-cyan-800/50 px-1.5 py-0.5 rounded w-fit flex items-center gap-1 mt-1">
                      <LayoutGrid size={10} /> {item.rackName}
                    </div>
                  </div>
                  {liveStatus === 'critical' ? <AlertTriangle size={16} className="text-red-500 animate-pulse mt-1" /> : liveStatus === 'warning' ? <AlertTriangle size={16} className="text-yellow-500 mt-1" /> : <Power size={16} className="text-cyan-700 mt-1" />}
                </div>

                <div className="mt-4 space-y-3">
                  {item.type === 'switch' ? (
                    <>
                      <div className="relative">
                        <div className="flex justify-between text-[10px] text-purple-400 font-bold mb-1">
                          <span className="flex items-center gap-1"><Link2 size={10} /> TRAFFIC</span>
                          <span className={(srv.traffic_gbps || 0) > 35 ? 'text-red-400' : (srv.traffic_gbps || 0) > 25 ? 'text-yellow-400' : 'text-white'}>{(srv.traffic_gbps || 0).toFixed(1)} Gbps</span>
                        </div>
                        <div className="h-1 w-full bg-[#0a1e3f] overflow-hidden">
                          <div className={`h-full ${(srv.traffic_gbps || 0) > 35 ? 'bg-red-500' : (srv.traffic_gbps || 0) > 25 ? 'bg-yellow-400' : 'bg-purple-500'}`}
                            style={{ width: `${Math.min(((srv.traffic_gbps || 0) / 40) * 100, 100)}%` }}></div>
                        </div>
                      </div>
                      <div className="relative">
                        <div className="flex justify-between text-[10px] text-purple-400 font-bold mb-1">
                          <span className="flex items-center gap-1"><Box size={10} /> PORTS</span>
                          <span className={(srv.ports_active || 0) > 42 ? 'text-red-400' : (srv.ports_active || 0) > 35 ? 'text-yellow-400' : 'text-white'}>{srv.ports_active || 0} / {srv.ports_total || 48}</span>
                        </div>
                        <div className="h-1 w-full bg-[#0a1e3f] overflow-hidden">
                          <div className={`h-full ${(srv.ports_active || 0) > 42 ? 'bg-red-500' : (srv.ports_active || 0) > 35 ? 'bg-yellow-400' : 'bg-purple-400'}`}
                            style={{ width: `${((srv.ports_active || 0) / (srv.ports_total || 48)) * 100}%` }}></div>
                        </div>
                      </div>
                      <div className="flex gap-4 pt-1 border-t border-cyan-900/40 mt-1">
                        <div className="flex-1">
                          <div className="flex justify-between text-[8px] text-cyan-700 font-bold mb-0.5">
                            <span>CPU</span>
                            <span className={(srv.cpu_usage || 0) > 85 ? 'text-red-400' : (srv.cpu_usage || 0) > 60 ? 'text-yellow-400' : 'text-cyan-800'}>{(srv.cpu_usage || 0).toFixed(0)}%</span>
                          </div>
                          <div className="h-[2px] w-full bg-[#0a1e3f]">
                            <div className={`h-full ${(srv.cpu_usage || 0) > 85 ? 'bg-red-500' : (srv.cpu_usage || 0) > 60 ? 'bg-yellow-400' : 'bg-cyan-800'}`} style={{ width: `${srv.cpu_usage || 0}%` }}></div>
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between text-[8px] text-cyan-700 font-bold mb-0.5">
                            <span>TEMP</span>
                            <span className={(srv.temperature || 0) > 55 ? 'text-red-400' : (srv.temperature || 0) > 45 ? 'text-yellow-400' : 'text-cyan-800'}>{(srv.temperature || 0).toFixed(0)}°C</span>
                          </div>
                          <div className="h-[2px] w-full bg-[#0a1e3f]">
                            <div className={`h-full ${(srv.temperature || 0) > 55 ? 'bg-red-500' : (srv.temperature || 0) > 45 ? 'bg-yellow-400' : 'bg-blue-800'}`} style={{ width: `${srv.temperature || 0}%` }}></div>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="relative">
                        <div className="flex justify-between text-[10px] text-cyan-600 font-bold mb-1">
                          <span className="flex items-center gap-1"><Cpu size={10} /> CPU</span>
                          <span className={srv.cpu_usage > 85 ? 'text-red-400' : srv.cpu_usage > 60 ? 'text-yellow-400' : 'text-white'}>{(srv.cpu_usage || 0).toFixed(1)}%</span>
                        </div>
                        <div className="h-1 w-full bg-[#0a1e3f] overflow-hidden">
                          <div className={`h-full ${srv.cpu_usage > 85 ? 'bg-red-500' : srv.cpu_usage > 60 ? 'bg-yellow-400' : 'bg-cyan-400'}`} style={{ width: `${srv.cpu_usage || 0}%` }}></div>
                        </div>
                      </div>

                      <div className="relative">
                        <div className="flex justify-between text-[10px] text-cyan-600 font-bold mb-1">
                          <span className="flex items-center gap-1"><Thermometer size={10} /> TEMP</span>
                          <span className={(srv.temperature || 0) > 55 ? 'text-red-400' : (srv.temperature || 0) > 45 ? 'text-yellow-400' : 'text-white'}>{(srv.temperature || 0).toFixed(1)}°C</span>
                        </div>
                        <div className="h-1 w-full bg-[#0a1e3f] overflow-hidden">
                          <div className={`h-full ${(srv.temperature || 0) > 55 ? 'bg-red-500' : (srv.temperature || 0) > 45 ? 'bg-yellow-400' : 'bg-blue-400'}`} style={{ width: `${srv.temperature || 0}%` }}></div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </TechPanel>
  );
});

const CpuByNodePanel = memo(function CpuByNodePanel({
  title,
  chartData,
  totalDataCount,
  limitNotice,
}: {
  title: string;
  chartData: ServerTelemetry[];
  totalDataCount: number;
  limitNotice: string;
}) {
  const tickInterval = chartData.length > 140 ? 4 : chartData.length > 90 ? 2 : chartData.length > 45 ? 1 : 0;
  const chartHeight = Math.max(200, chartData.length * 18);

  return (
    <TechPanel title={title} className="h-[400px]">
      <ClientOnlyChart placeholderClassName="h-full w-full min-h-[200px]">
        <div className="h-full w-full overflow-y-auto pr-1 overflow-x-hidden custom-scrollbar">
          {totalDataCount > chartData.length && (
            <div className="text-[10px] text-cyan-500/80 font-mono mb-2">
              {limitNotice}
            </div>
          )}
          <div style={{ height: `${chartHeight}px` }} className="w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 100, height: 200 }}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis
                  dataKey="server_id"
                  type="category"
                  stroke="#1e3a8a"
                  fontSize={9}
                  width={75}
                  tick={{ fill: '#06b6d4' }}
                  interval={tickInterval}
                />
                <RechartsTooltip cursor={{ fill: '#1e3a8a' }} contentStyle={{ backgroundColor: '#020b1a', borderColor: '#06b6d4', color: '#fff' }} />
                <Bar dataKey="cpu_usage" isAnimationActive={false} barSize={12}>
                  {chartData.map((entry, index) => {
                    const isOff = entry.power_state === 'off';
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={isOff ? '#64748b' : (entry.cpu_usage > 85 ? '#ef4444' : '#06b6d4')}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </ClientOnlyChart>
    </TechPanel>
  );
});

export default function Dashboard() {
  const { language } = useLanguage();
  const racks = useDcimStore((s) => s.racks);
  const equipments = useDcimStore((s) => s.equipments);
  const currentLocationId = useDcimStore((s) => s.currentLocationId);
  const t = useMemo(() => {
    if (language === "en") {
      return {
        title: "DATACENTER COMMAND CENTER",
        sim: "SIMULATION MODE",
        live: "LIVE DATA MODE",
        online: "SYSTEM ONLINE",
        cpuTrend: "CPU Trend",
        tempTrend: "Temperature Trend",
        health: "Health Distribution",
        matrix: "Server Matrix",
        awaiting: "AWAITING VITAL SIGNALS...",
        cpuByNode: "CPU Usage by Node",
        alarms: "Real-time Alarms",
        noAlarms: "No Active Alarms",
        liquidCooling: "CDU Liquid Cooling",
        immersionCooling: "Immersion Monitoring",
        pageLabel: "Paging",
        pageInfo: (current: number, total: number, pageCount: number, allCount: number) =>
          `Page ${current} / ${total} (${pageCount} shown, ${allCount} total)`,
        prevPage: "Prev",
        nextPage: "Next",
        matrixSearchPlaceholder: "Search by server or rack name",
        matrixSearchClear: "Clear",
      };
    }
    return {
      title: "DATACENTER COMMAND CENTER",
      sim: "模擬模式",
      live: "真實資料模式",
      online: "系統運行中",
      cpuTrend: "全區負載趨勢 (CPU Trend)",
      tempTrend: "機房溫度趨勢 (Temp Trend)",
      health: "設備健康狀態分佈 (Health)",
      matrix: "機房伺服器陣列監控矩陣 (Server Matrix)",
      awaiting: "等待即時訊號中...",
      cpuByNode: "各節點 CPU 負載佔比",
      alarms: "即時系統警報 (Real-time Alarms)",
      noAlarms: "目前無告警",
      liquidCooling: "CDU 液冷監控 (Liquid Cooling)",
      immersionCooling: "雙相浸沒式監控 (Immersion Cooling)",
      pageLabel: "分頁顯示",
      pageInfo: (current: number, total: number, pageCount: number, allCount: number) =>
        `第 ${current} / ${total} 頁（本頁 ${pageCount} 台，總計 ${allCount} 台）`,
      prevPage: "上一頁",
      nextPage: "下一頁",
      matrixSearchPlaceholder: "可輸入伺服器名稱或所在機櫃搜尋",
      matrixSearchClear: "清除",
    };
  }, [language]);
  const [data, setData] = useState<ServerTelemetry[]>([]);
  const [history, setHistory] = useState<TrendPoint[]>([]);
  const [simMode, setSimMode] = useState("simulation");
  const [matrixQuery, setMatrixQuery] = useState("");
  const deferredMatrixQuery = useDeferredValue(matrixQuery);
  const lastHistoryAtRef = useRef(0);
  const lastDataSignatureRef = useRef("");

  // 初始化模式
  useEffect(() => {
    const fetchMode = async () => {
      try {
        const res = await authFetch(apiUrl("/api/system/mode"));
        if (res.ok) {
          const json = await res.json();
          setSimMode(json.mode);
        }
      } catch (e) { }
    };
    fetchMode();
  }, []);

  const handleToggleMode = useCallback(async () => {
    const newMode = simMode === "simulation" ? "real" : "simulation";
    try {
      await authFetch(apiUrl("/api/system/mode"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: newMode })
      });
      setSimMode(newMode);
    } catch (e) { }
  }, [simMode]);

  const handleSSEUpdate = useCallback((metricsMap: Record<string, any>) => {
    // metricsMap 同一筆資料可能掛多個 key；Object.values 會重複多份，依節點正規化 ID 去重
    const merged = new Map<string, ServerTelemetry>();
    for (const raw of Object.values(metricsMap)) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as ServerTelemetry;
      const sid = String(row.server_id || row.asset_id || "").trim();
      if (!sid) continue;
      merged.set(normalizeNodeId(sid), row);
    }
    const nextRows = Array.from(merged.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, row]) => row);
    const nextSignature = buildTelemetrySignature(nextRows);
    if (nextSignature === lastDataSignatureRef.current) return;
    lastDataSignatureRef.current = nextSignature;
    setData(nextRows);
  }, []);

  useEffect(() => {
    if (data.length === 0) return;
    const nowTs = Date.now();
    if (nowTs - lastHistoryAtRef.current < 2000) return;

    const validCpu = data
      .map((cur) => Number(cur.cpu_usage))
      .filter((v) => Number.isFinite(v));
    const validTemp = data
      .map((cur) => Number(cur.temperature))
      .filter((v) => Number.isFinite(v));
    if (validCpu.length === 0 || validTemp.length === 0) return;

    lastHistoryAtRef.current = nowTs;
    const now = new Date(nowTs);
    const avgCpu = validCpu.reduce((acc, cur) => acc + cur, 0) / validCpu.length;
    const avgTemp = validTemp.reduce((acc, cur) => acc + cur, 0) / validTemp.length;
    const newPoint = {
      time: now.toLocaleTimeString("zh-TW", { hour12: false, minute: "2-digit", second: "2-digit" }),
      avgCpu: Number(avgCpu.toFixed(1)),
      avgTemp: Number(avgTemp.toFixed(1)),
    };
    setHistory((prev) => {
      const next = [...prev, newPoint];
      if (next.length > 30) next.shift();
      return next;
    });
  }, [data]);

  const { connected } = useSSE({
    onUpdate: handleSSEUpdate,
    fallbackPollingMs: 5000,
    updateIntervalMs: DASHBOARD_SSE_UPDATE_MS,
  });

  const telemetryById = useMemo(() => {
    const m = new Map<string, ServerTelemetry>();
    data.forEach((d) => {
      buildTelemetryKeys(d).forEach((k) => {
        m.set(k, d);
      });
    });
    return m;
  }, [data]);

  const locationRacks = useMemo(
    () => racks.filter((r) => r.locationId === currentLocationId),
    [racks, currentLocationId]
  );
  const locationEquipments = useMemo(
    () => equipments.filter((e) => e.locationId === currentLocationId),
    [equipments, currentLocationId]
  );

  // Calculate stats based on store servers (Filtered by location)
  const allGridItems = useMemo(() => {
    const rackServers = locationRacks
      .flatMap(r => r.servers.map(s => ({ ...s, assetId: s.assetId || normalizeNodeId(s.name), rackName: r.name, rackType: r.type })));
    
    const standaloneEquips = locationEquipments
      .map(e => ({ id: e.id, assetId: normalizeNodeId(e.name), name: e.name, type: e.type, rackName: 'Facility', rackType: 'equipment' }));
      
    return [...rackServers, ...standaloneEquips];
  }, [locationRacks, locationEquipments]);

  const totalServers = allGridItems.length;

  // Precompute per-item telemetry + status once, reuse across panels.
  const gridStatusRows = useMemo(
    () =>
      allGridItems.map((item) => {
        const srv = findTelemetryForItem(telemetryById, item.assetId, item.name);
        const status = getDeviceStatus(item, srv);
        return { item, srv, status };
      }),
    [allGridItems, telemetryById]
  );

  const { healthData, pieData } = useMemo(() => {
    const health = gridStatusRows.reduce((acc, row) => {
      const status = row.status;
      if (status === 'critical') acc.critical++;
      else if (status === 'warning') acc.warning++;
      else acc.normal++;
      return acc;
    }, { normal: 0, warning: 0, critical: 0 });

    const pie = [
      { name: '正常 (Normal)', value: health.normal, color: '#06b6d4' },
      { name: '警告 (Warning)', value: health.warning, color: '#fbbf24' },
      { name: '異常 (Critical)', value: health.critical, color: '#ef4444' }
    ].filter(d => d.value > 0);

    return { healthData: health, pieData: pie };
  }, [gridStatusRows]);

  const itemNameSet = useMemo(() => {
    const set = new Set<string>();
    const add = (raw?: string) => {
      if (!raw || typeof raw !== "string" || !raw.trim()) return;
      const t = raw.trim();
      set.add(t);
      set.add(normalizeNodeId(t));
    };
    allGridItems.forEach((i) => {
      add(i.assetId);
      add(i.name);
    });
    locationEquipments.forEach((e) => add(e.name));
    locationRacks.forEach((r) => add(r.name));
    return set;
  }, [allGridItems, locationEquipments, locationRacks]);

  const simulationTargetSet = useMemo(() => {
    const set = new Set<string>();
    const add = (raw?: string) => {
      if (!raw || typeof raw !== "string" || !raw.trim()) return;
      const t = raw.trim().toUpperCase().replace(/\s+/g, "").replace(/_/g, "-");
      if (!t) return;
      set.add(t);
    };
    allGridItems.forEach((i) => add(i.name || i.assetId));
    equipments.forEach((e) => add(e.name));
    racks.forEach((r) => add(r.name));
    return set;
  }, [allGridItems, equipments, racks]);

  const filteredActiveStoreData = useMemo(
    () =>
      data
        .filter((d) => buildTelemetryKeys(d).some((k) => itemNameSet.has(k)))
        .sort((a, b) => (a.server_id || "").localeCompare(b.server_id || "")),
    [data, itemNameSet]
  );
  const activeStoreData = useMemo(
    () => filteredActiveStoreData.slice(0, MAX_BAR_RENDER),
    [filteredActiveStoreData]
  );
  const deferredActiveStoreData = useDeferredValue(activeStoreData);
  const cpuChartLimitNotice = language === "en"
    ? `Chart shows first ${MAX_BAR_RENDER} nodes (sorted by node ID)`
    : `圖表僅顯示前 ${MAX_BAR_RENDER} 台（依節點 ID 排序）`;

  const cduPanelData = useMemo(() => {
    const expectedCdus = locationEquipments.filter((e) => e.type === "cdu");
    return expectedCdus.map((e) => {
      const row = findTelemetryForItem(telemetryById, normalizeNodeId(e.name), e.name);
      return { ...row, ...e, server_id: e.name, asset_id: e.name };
    });
  }, [locationEquipments, telemetryById]);

  const immersionPanelData = useMemo(() => {
    const expectedTanks = locationRacks.filter((r) => r.type === "immersion_dual");
    if (expectedTanks.length > 0) {
      return expectedTanks.map((r) => {
        const row = findTelemetryForItem(telemetryById, normalizeNodeId(r.name), r.name);
        return { ...r, server_id: r.name, ...row };
      });
    }
    if (simMode === "simulation") {
      const agentData = telemetryById.get("IMM-TAN-001");
      if (agentData) return [{ ...agentData, isDemo: true }];
    }
    return [];
  }, [locationRacks, telemetryById, simMode]);

  const serverMatrixItems = useMemo(
    () =>
      locationRacks
        .flatMap((r) => (r.servers || []).map((s) => ({ ...s, rackName: r.name })))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [locationRacks]
  );
  const filteredServerMatrixItems = useMemo(() => {
    const query = deferredMatrixQuery.trim().toLowerCase();
    if (!query) return serverMatrixItems;
    return serverMatrixItems.filter((item) =>
      item.name.toLowerCase().includes(query) || item.rackName.toLowerCase().includes(query)
    );
  }, [serverMatrixItems, deferredMatrixQuery]);
  const [matrixPage, setMatrixPage] = useState(0);
  const totalMatrixPages = Math.max(1, Math.ceil(filteredServerMatrixItems.length / MATRIX_ITEMS_PER_PAGE));
  const visibleMatrixItems = useMemo(
    () =>
      filteredServerMatrixItems.slice(
        matrixPage * MATRIX_ITEMS_PER_PAGE,
        (matrixPage + 1) * MATRIX_ITEMS_PER_PAGE
      ),
    [filteredServerMatrixItems, matrixPage]
  );
  const handlePrevMatrixPage = useCallback(() => {
    setMatrixPage((p) => Math.max(0, p - 1));
  }, []);
  const handleNextMatrixPage = useCallback(() => {
    setMatrixPage((p) => Math.min(totalMatrixPages - 1, p + 1));
  }, [totalMatrixPages]);
  const handleClearMatrixQuery = useCallback(() => {
    setMatrixQuery("");
  }, []);

  useEffect(() => {
    if (matrixPage > totalMatrixPages - 1) {
      setMatrixPage(totalMatrixPages - 1);
    }
  }, [matrixPage, totalMatrixPages]);

  useEffect(() => {
    setMatrixPage(0);
  }, [matrixQuery]);

  const alertDevices = useMemo(
    () => gridStatusRows.filter((row) => row.status === "critical" || row.status === "warning"),
    [gridStatusRows]
  );
  const visibleAlertDevices = useMemo(
    () => alertDevices.slice(0, MAX_ALARM_RENDER),
    [alertDevices]
  );

  useEffect(() => {
    if (simMode !== "simulation") return;
    const targets = Array.from(simulationTargetSet);
    if (targets.length === 0) return;
    authFetch(apiUrl("/api/system/simulate_targets"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targets })
    }).catch(() => {});
  }, [simulationTargetSet, simMode]);

  return (
    <div className="w-full bg-[#010613] text-slate-300 font-sans flex flex-col overflow-x-hidden selection:bg-cyan-900">
      <DashboardHeader
        title={t.title}
        simMode={simMode}
        connected={connected}
        onToggleMode={handleToggleMode}
        simLabel={t.sim}
        liveLabel={t.live}
      />

      {/* Main Grid */}
      <main className="flex-1 p-6 grid grid-cols-12 gap-6">

        {/* Left Column (Charts) */}
        <div className="col-span-3 flex flex-col gap-6">
          <TechPanel title={t.cpuTrend} className="h-[280px]">
            <ClientOnlyChart>
            <div className="h-full w-full min-h-[180px]">
            {history.length === 0 ? (
              <div className="h-full flex items-center justify-center text-cyan-700/80 text-[11px] font-mono tracking-widest">
                {t.awaiting}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 100, height: 180 }}>
                <AreaChart data={history} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#1e3a8a" fontSize={10} tickMargin={5} />
                  <YAxis stroke="#1e3a8a" fontSize={10} domain={[0, 100]} />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#020b1a', borderColor: '#06b6d4', color: '#fff' }} />
                  <Area type="monotone" dataKey="avgCpu" stroke="#06b6d4" fillOpacity={1} fill="url(#colorCpu)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
            </div>
            </ClientOnlyChart>
          </TechPanel>

          <TechPanel title={t.tempTrend} className="h-[280px]">
            <ClientOnlyChart>
            <div className="h-full w-full min-h-[180px]">
            {history.length === 0 ? (
              <div className="h-full flex items-center justify-center text-cyan-700/80 text-[11px] font-mono tracking-widest">
                {t.awaiting}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 100, height: 180 }}>
                <AreaChart data={history} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" stroke="#1e3a8a" fontSize={10} tickMargin={5} />
                  <YAxis stroke="#1e3a8a" fontSize={10} domain={[10, 60]} />
                  <RechartsTooltip contentStyle={{ backgroundColor: '#020b1a', borderColor: '#ef4444', color: '#fff' }} />
                  <Area type="monotone" dataKey="avgTemp" stroke="#ef4444" fillOpacity={1} fill="url(#colorTemp)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
            </div>
            </ClientOnlyChart>
          </TechPanel>

          {/* Liquid Cooling Panel */}
          <LiquidCoolingPanel 
            title={t.liquidCooling} 
            cduData={cduPanelData}
            className="flex-1 min-h-[250px]"
          />

          <ImmersionCoolingPanel 
            title={t.immersionCooling} 
            immersionData={immersionPanelData}
            className="flex-1 min-h-[250px]"
          />
        </div>

        {/* Center Column (Server Grid Matrix) */}
        <div className="col-span-6 flex flex-col gap-6">
          <ServerMatrixPanel
            title={t.matrix}
            pageLabel={t.pageLabel}
            pageInfo={t.pageInfo}
            prevPage={t.prevPage}
            nextPage={t.nextPage}
            searchPlaceholder={t.matrixSearchPlaceholder}
            clearLabel={t.matrixSearchClear}
            awaiting={t.awaiting}
            noMatchLabel={language === "en" ? "NO MATCH: " : "查無符合："}
            matrixQuery={matrixQuery}
            onMatrixQueryChange={setMatrixQuery}
            onClearMatrixQuery={handleClearMatrixQuery}
            visibleMatrixItems={visibleMatrixItems}
            filteredServerMatrixItems={filteredServerMatrixItems}
            matrixPage={matrixPage}
            totalMatrixPages={totalMatrixPages}
            onPrevPage={handlePrevMatrixPage}
            onNextPage={handleNextMatrixPage}
            telemetryById={telemetryById}
          />
        </div>

        {/* Right Column (Alarms & Details) */}
        <div className="col-span-3 flex flex-col gap-6">
          <CpuByNodePanel
            title={t.cpuByNode}
            chartData={deferredActiveStoreData}
            totalDataCount={filteredActiveStoreData.length}
            limitNotice={cpuChartLimitNotice}
          />

          <TechPanel title={t.alarms} className="flex-1">
            <div className="h-full overflow-y-auto pr-2 space-y-2 custom-scrollbar">
              {visibleAlertDevices.length === 0 ? (
                <div className="text-xs text-cyan-800 font-mono text-center mt-10 uppercase tracking-widest">{t.noAlarms}</div>
              ) : (
                <>
                {alertDevices.length > MAX_ALARM_RENDER && (
                  <div className="text-[10px] text-cyan-500/80 font-mono">
                    警報列表僅顯示前 {MAX_ALARM_RENDER} 筆（共 {alertDevices.length} 筆）
                  </div>
                )}
                {visibleAlertDevices.map(({ item, srv, status }) => {
                  if (!srv) return null;

                  const traffic = srv.traffic_gbps || 0;
                  const ports = srv.ports_active || 0;
                  const cpu = srv.cpu_usage || 0;
                  const temp = srv.temperature || 0;

                  const isWarn = status === 'warning';
                  const bgClass = isWarn ? "bg-yellow-950/40 border-yellow-900" : "bg-red-950/40 border-red-900";
                  const barClass = isWarn ? "bg-yellow-500" : "bg-red-500";
                  const iconClass = isWarn ? "text-yellow-500" : "text-red-500";
                  const titleClass = isWarn ? "text-yellow-400" : "text-red-400";
                  const textClass = isWarn ? "text-yellow-200/60" : "text-red-200/60";
                  const timeClass = isWarn ? "text-yellow-900" : "text-red-900";
                  const stateTitle = isWarn ? "WARNING STATE" : "CRITICAL STATE";

                  return (
                    <div key={`alarm-${item.name}`} className={`${bgClass} border p-3 rounded-none flex gap-3 items-start relative overflow-hidden group`}>
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${barClass}`}></div>
                      <AlertTriangle className={`${iconClass} shrink-0`} size={16} />
                      <div className="flex-1">
                        <div className={`${titleClass} text-xs font-bold font-mono`}>[{item.name}] {stateTitle}</div>
                        <div className={`${textClass} text-[10px] mt-1 space-y-1`}>
                          {item.type === 'switch' ? (
                            <>
                              {traffic > 25 && <div>- Network Congestion ({traffic.toFixed(1)} Gbps)</div>}
                              {ports > 35 && <div>- Port Saturation ({ports}/48)</div>}
                              {cpu > 60 && <div>- Mgmt CPU Output ({cpu.toFixed(0)}%)</div>}
                              {temp > 45 && <div>- Chassis Heat ({temp.toFixed(0)}°C)</div>}
                            </>
                          ) : (
                            <>
                              {cpu > 60 && <div>- Processor Load ({cpu.toFixed(1)}%)</div>}
                              {temp > 45 && <div>- Core Temperature ({temp.toFixed(1)}°C)</div>}
                            </>
                          )}
                        </div>
                        <div className={`${timeClass} text-[9px] mt-2 text-right`}>{new Date(srv.timestamp).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  );
                })}
                </>
              )}
            </div>
          </TechPanel>

          {/* Health Distribution moved here */}
          <TechPanel title={t.health} className="h-[220px] shrink-0">
            <div className="h-[150px] w-full relative flex items-center justify-center">
              <ClientOnlyChart placeholderClassName="h-[150px] w-[220px]">
              <ResponsiveContainer width={220} height={150} initialDimension={{ width: 220, height: 150 }}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={54}
                    outerRadius={74}
                    paddingAngle={5}
                    dataKey="value"
                    isAnimationActive={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: '#020b1a', borderColor: '#1e3a8a', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
              </ClientOnlyChart>
              {/* 中間文字 */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1">
                <span className="text-2xl font-black text-white leading-none">{totalServers}</span>
                <span className="text-[8px] text-cyan-600 font-bold uppercase tracking-widest">Total</span>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] font-mono">
              <div className="flex items-center justify-center gap-1 border border-cyan-900/40 bg-cyan-950/20 py-1">
                <span className="inline-block h-2 w-2 bg-cyan-400 rounded-full"></span>
                <span className="text-cyan-300">{healthData.normal}</span>
              </div>
              <div className="flex items-center justify-center gap-1 border border-yellow-900/40 bg-yellow-950/20 py-1">
                <span className="inline-block h-2 w-2 bg-yellow-400 rounded-full"></span>
                <span className="text-yellow-300">{healthData.warning}</span>
              </div>
              <div className="flex items-center justify-center gap-1 border border-red-900/40 bg-red-950/20 py-1">
                <span className="inline-block h-2 w-2 bg-red-500 rounded-full"></span>
                <span className="text-red-300">{healthData.critical}</span>
              </div>
            </div>
          </TechPanel>
        </div>


      </main>

      {/* 科技感底邊界 */}
      <footer className="h-1 bg-gradient-to-r from-transparent via-[#1e3a8a] to-transparent opacity-50 mb-1"></footer>
    </div>
  );
}
