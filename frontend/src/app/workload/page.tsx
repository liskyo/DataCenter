"use client";

import { useState, useMemo, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Area, AreaChart, ComposedChart, Bar,
} from "recharts";
import {
  Cpu, Zap, Thermometer, Droplets, Play, ChevronRight,
  Clock, Activity, Server, AlertTriangle, CheckCircle2,
  Loader2, Gauge, BrainCircuit, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { ClientOnlyChart } from "@/components/ClientOnlyChart";
import { usePolling } from "@/shared/hooks/usePolling";
import { apiUrl } from "@/shared/api";
import { authFetch } from "@/shared/auth";
import { useLanguage } from "@/shared/i18n/language";

// ── Types ──────────────────────────────────────────────────
type WorkloadJob = {
  id: string;
  name: string;
  category: string;
  gpu_model: string;
  gpu_count: number;
  pflops: number;
  tdp_per_gpu_w: number;
  mfu: number;
  estimated_heat_kw: number;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  duration_s: number;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
  assigned_nodes: string[];
};

type TimelinePoint = {
  time_label: string;
  total_pflops: number;
  active_gpu_count: number;
  active_heat_kw: number;
  proactive_gpu_temp: number;
  reactive_gpu_temp: number;
  proactive_cdu_flow: number;
  reactive_cdu_flow: number;
  cdu_supply_temp: number;
  cdu_return_temp: number;
  job_events: { type: string; job_id: string; name: string }[];
};

type Template = {
  index: number;
  name: string;
  category: string;
  gpu_model: string;
  gpu_count: number;
  pflops: number;
  estimated_heat_kw: number;
};

// ── Utility ────────────────────────────────────────────────
const statusIcon = (status: string) => {
  switch (status) {
    case "running": return <Loader2 size={14} className="text-emerald-400 animate-spin" />;
    case "pending": return <Clock size={14} className="text-yellow-400" />;
    case "completed": return <CheckCircle2 size={14} className="text-cyan-500" />;
    case "failed": return <AlertTriangle size={14} className="text-red-400" />;
    default: return null;
  }
};

const statusColor = (status: string) => {
  switch (status) {
    case "running": return "border-emerald-500/40 bg-emerald-950/30";
    case "pending": return "border-yellow-600/30 bg-yellow-950/20";
    case "completed": return "border-cyan-800/30 bg-cyan-950/10";
    case "failed": return "border-red-800/30 bg-red-950/20";
    default: return "border-slate-800";
  }
};

const categoryBadge = (cat: string) => {
  if (cat === "training") return <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-violet-900/50 text-violet-300 font-bold uppercase tracking-wider">Train</span>;
  return <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-blue-900/50 text-blue-300 font-bold uppercase tracking-wider">Infer</span>;
};

// ── Custom Tooltip ─────────────────────────────────────────
function DualAxisTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#020b1a]/95 border border-cyan-800/50 p-3 rounded-lg shadow-xl text-xs font-mono backdrop-blur-sm">
      <div className="text-cyan-300 font-bold mb-2">{label}</div>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex justify-between gap-4" style={{ color: entry.color }}>
          <span>{entry.name}</span>
          <span className="font-bold">{typeof entry.value === "number" ? entry.value.toFixed(1) : entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────
export default function WorkloadPage() {
  const { language } = useLanguage();
  const t = useMemo(() => language === "en" ? {
    title: "JOB-AWARE POWER MANAGEMENT",
    subtitle: "AI Workload Scheduling × Proactive Thermal Control",
    jobQueue: "Workload Queue",
    timeline: "Compute × Thermal Correlation",
    simulator: "Cooling Strategy Comparison",
    dispatch: "DISPATCH JOB",
    noJobs: "No active workloads",
    proactive: "Proactive (Feed-forward)",
    reactive: "Reactive (Feedback PID)",
    pflops: "PFLOPS",
    gpuTemp: "GPU Temp (°C)",
    cduFlow: "CDU Flow (LPM)",
    heat: "Heat Load (kW)",
    gpus: "GPUs",
    nodes: "Nodes",
    progress: "Progress",
    mfu: "MFU",
    heatLabel: "Est. Heat",
  } : {
    title: "算力與任務感知調度",
    subtitle: "AI 工作負載排程 × 前饋式主動冷卻控制",
    jobQueue: "工作負載佇列",
    timeline: "算力 × 溫度時序關聯",
    simulator: "冷卻策略對比模擬",
    dispatch: "派發任務",
    noJobs: "目前無活動工作負載",
    proactive: "主動式 (前饋控制)",
    reactive: "被動式 (反饋 PID)",
    pflops: "PFLOPS",
    gpuTemp: "GPU 溫度 (°C)",
    cduFlow: "CDU 流量 (LPM)",
    heat: "熱負載 (kW)",
    gpus: "GPU 數量",
    nodes: "節點",
    progress: "進度",
    mfu: "算力利用率",
    heatLabel: "預估熱負載",
  }, [language]);

  const [jobs, setJobs] = useState<WorkloadJob[]>([]);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [dispatching, setDispatching] = useState(false);

  // Polling
  usePolling(async () => {
    try {
      const [jobsRes, timelineRes] = await Promise.all([
        authFetch(apiUrl("/api/workload/jobs")),
        authFetch(apiUrl("/api/workload/timeline")),
      ]);
      if (jobsRes.ok) {
        const j = await jobsRes.json();
        setJobs(j.jobs || []);
      }
      if (timelineRes.ok) {
        const tl = await timelineRes.json();
        setTimeline(tl.timeline || []);
      }
    } catch {}
  }, { intervalMs: 2000, immediate: true });

  // Fetch templates once
  usePolling(async () => {
    try {
      const res = await authFetch(apiUrl("/api/workload/templates"));
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch {}
  }, { intervalMs: 60000, immediate: true });

  const handleDispatch = useCallback(async (templateIndex?: number) => {
    setDispatching(true);
    try {
      await authFetch(apiUrl("/api/workload/dispatch"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_index: templateIndex }),
      });
    } catch {} finally {
      setDispatching(false);
    }
  }, []);

  // Derived stats
  const stats = useMemo(() => {
    const running = jobs.filter(j => j.status === "running");
    const pending = jobs.filter(j => j.status === "pending");
    return {
      runningCount: running.length,
      pendingCount: pending.length,
      totalPflops: running.reduce((s, j) => s + j.pflops, 0),
      totalGpus: running.reduce((s, j) => s + j.gpu_count, 0),
      totalHeat: running.reduce((s, j) => s + j.estimated_heat_kw, 0),
    };
  }, [jobs]);

  // Find job start events for reference lines
  const jobEventLines = useMemo(() => {
    const events: { time: string; name: string; type: string }[] = [];
    timeline.forEach(p => {
      p.job_events?.forEach(e => {
        events.push({ time: p.time_label, name: e.name, type: e.type });
      });
    });
    return events;
  }, [timeline]);

  return (
    <div className="p-4 md:p-6 w-full h-full flex flex-col gap-6 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0a1e3f]/30 p-4 rounded-xl border border-violet-900/40">
        <div className="flex items-center gap-4">
          <BrainCircuit size={32} className="text-violet-400" />
          <div>
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400 tracking-widest uppercase">
              {t.title}
            </h1>
            <p className="text-slate-400 text-xs font-mono tracking-widest mt-1">{t.subtitle}</p>
          </div>
        </div>
        {/* Live stats badges */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-emerald-950/40 border border-emerald-800/40 px-3 py-1.5 rounded-lg">
            <Cpu size={14} className="text-emerald-400" />
            <span className="text-emerald-300 font-mono font-bold text-sm">{stats.totalPflops.toFixed(1)}</span>
            <span className="text-emerald-600 text-[10px]">PFLOPS</span>
          </div>
          <div className="flex items-center gap-2 bg-violet-950/40 border border-violet-800/40 px-3 py-1.5 rounded-lg">
            <Server size={14} className="text-violet-400" />
            <span className="text-violet-300 font-mono font-bold text-sm">{stats.totalGpus}</span>
            <span className="text-violet-600 text-[10px]">GPUs</span>
          </div>
          <div className="flex items-center gap-2 bg-orange-950/40 border border-orange-800/40 px-3 py-1.5 rounded-lg">
            <Zap size={14} className="text-orange-400" />
            <span className="text-orange-300 font-mono font-bold text-sm">{stats.totalHeat.toFixed(1)}</span>
            <span className="text-orange-600 text-[10px]">kW</span>
          </div>
          <div className="flex items-center gap-2 bg-cyan-950/40 border border-cyan-800/40 px-3 py-1.5 rounded-lg">
            <Activity size={14} className="text-cyan-400" />
            <span className="text-cyan-300 font-mono font-bold text-sm">{stats.runningCount}</span>
            <span className="text-cyan-600 text-[10px]">RUN</span>
            <span className="text-yellow-300 font-mono font-bold text-sm ml-1">{stats.pendingCount}</span>
            <span className="text-yellow-600 text-[10px]">WAIT</span>
          </div>
        </div>
      </header>

      {/* Main 2-column layout */}
      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">

        {/* Left: Job Queue */}
        <div className="col-span-4 flex flex-col gap-4">
          {/* Dispatch Panel */}
          <div className="bg-[#020b1a] border border-violet-900/40 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-violet-400 tracking-widest uppercase flex items-center gap-2">
                <Play size={14} /> {t.dispatch}
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
              {templates.map(tmpl => (
                <button
                  key={tmpl.index}
                  disabled={dispatching}
                  onClick={() => handleDispatch(tmpl.index)}
                  className="text-left bg-[#0a1e3f]/50 hover:bg-violet-900/30 border border-violet-800/20 hover:border-violet-500/50 rounded-lg p-2.5 transition-all group disabled:opacity-40"
                >
                  <div className="text-[11px] font-bold text-violet-200 group-hover:text-white truncate">{tmpl.name}</div>
                  <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-500">
                    <span>{tmpl.gpu_count}× GPU</span>
                    <span>|</span>
                    <span>{tmpl.pflops} PF</span>
                    <span>|</span>
                    <span>{tmpl.estimated_heat_kw} kW</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Job List */}
          <div className="flex-1 bg-[#020b1a] border border-cyan-900/30 rounded-xl p-4 overflow-hidden flex flex-col">
            <h2 className="text-xs font-bold text-cyan-400 tracking-widest uppercase flex items-center gap-2 mb-3 shrink-0">
              <Activity size={14} /> {t.jobQueue}
              <span className="text-slate-600 text-[10px] ml-auto font-mono">{jobs.length} jobs</span>
            </h2>
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2">
              {jobs.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-600 text-xs font-mono tracking-widest">{t.noJobs}</div>
              ) : (
                jobs.map(job => (
                  <div key={job.id} className={`border rounded-lg p-3 transition-all ${statusColor(job.status)}`}>
                    <div className="flex items-start gap-2">
                      {statusIcon(job.status)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-200 truncate">{job.name}</span>
                          {categoryBadge(job.category)}
                        </div>
                        <div className="text-[9px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                          <span className="text-slate-400">[{job.id}]</span>
                          <span>{job.gpu_count}× GPU</span>
                          <span>|</span>
                          <span className="text-emerald-500">{job.pflops} PF</span>
                          <span>|</span>
                          <span className="text-orange-400">{job.estimated_heat_kw} kW</span>
                        </div>
                        {job.status === "running" && (
                          <div className="mt-2">
                            <div className="flex justify-between text-[9px] text-slate-500 mb-0.5">
                              <span>{t.progress}</span>
                              <span className="text-emerald-400">{(job.progress * 100).toFixed(0)}%</span>
                            </div>
                            <div className="h-1 w-full bg-[#0a1e3f] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-500"
                                style={{ width: `${job.progress * 100}%` }}
                              ></div>
                            </div>
                            {job.assigned_nodes.length > 0 && (
                              <div className="text-[8px] text-slate-600 mt-1">
                                {t.nodes}: {job.assigned_nodes.join(", ")}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Charts */}
        <div className="col-span-8 flex flex-col gap-6">

          {/* Chart 1: Dual-Axis — PFLOPS + GPU Temperature */}
          <div className="bg-[#020b1a] border border-cyan-900/30 rounded-xl p-4 flex-1 min-h-[320px]">
            <h2 className="text-xs font-bold text-cyan-400 tracking-widest uppercase flex items-center gap-2 mb-3">
              <Gauge size={14} /> {t.timeline}
            </h2>
            <ClientOnlyChart placeholderClassName="h-full w-full">
              <div className="h-[calc(100%-24px)] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 100, height: 250 }}>
                  <ComposedChart data={timeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pflopsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.6} />
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="heatGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#fb923c" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#fb923c" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="time_label" stroke="#334155" tick={{ fill: "#64748b" }} fontSize={9} tickMargin={5} interval="preserveStartEnd" />
                    <YAxis yAxisId="left" stroke="#a78bfa" tick={{ fill: "#a78bfa" }} fontSize={9} domain={[0, "auto"]} label={{ value: t.pflops, angle: -90, position: "insideLeft", fill: "#a78bfa", fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#ef4444" tick={{ fill: "#ef4444" }} fontSize={9} domain={[15, 70]} label={{ value: t.gpuTemp, angle: 90, position: "insideRight", fill: "#ef4444", fontSize: 10 }} />
                    <Tooltip content={<DualAxisTooltip />} />
                    {/* Job launch reference lines */}
                    {jobEventLines.filter(e => e.type === "start").map((e, i) => (
                      <ReferenceLine key={`evt-${i}`} yAxisId="left" x={e.time} stroke="#fbbf24" strokeDasharray="5 3" strokeWidth={1.5} label={{ value: `▶ ${e.name.slice(0, 12)}`, fill: "#fbbf24", fontSize: 8, position: "top" }} />
                    ))}
                    <Area yAxisId="left" type="monotone" dataKey="total_pflops" name={t.pflops} stroke="#a78bfa" strokeWidth={2} fill="url(#pflopsGrad)" isAnimationActive={false} />
                    <Area yAxisId="left" type="monotone" dataKey="active_heat_kw" name={t.heat} stroke="#fb923c" strokeWidth={1.5} fill="url(#heatGrad)" isAnimationActive={false} />
                    <Line yAxisId="right" type="monotone" dataKey="proactive_gpu_temp" name={`${t.gpuTemp} (${t.proactive})`} stroke="#34d399" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line yAxisId="right" type="monotone" dataKey="reactive_gpu_temp" name={`${t.gpuTemp} (${t.reactive})`} stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="6 3" isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </ClientOnlyChart>
          </div>

          {/* Chart 2: CDU Flow Comparison */}
          <div className="bg-[#020b1a] border border-cyan-900/30 rounded-xl p-4 h-[240px]">
            <h2 className="text-xs font-bold text-cyan-400 tracking-widest uppercase flex items-center gap-2 mb-3">
              <Droplets size={14} /> {t.simulator}
              <div className="flex gap-4 ml-auto text-[9px]">
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-emerald-400 rounded"></span><span className="text-emerald-400">{t.proactive}</span></span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-red-400 rounded border-dashed"></span><span className="text-red-400">{t.reactive}</span></span>
              </div>
            </h2>
            <ClientOnlyChart placeholderClassName="h-full w-full">
              <div className="h-[calc(100%-24px)] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 100, height: 170 }}>
                  <ComposedChart data={timeline} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="time_label" stroke="#334155" tick={{ fill: "#64748b" }} fontSize={9} interval="preserveStartEnd" />
                    <YAxis yAxisId="flow" stroke="#06b6d4" tick={{ fill: "#06b6d4" }} fontSize={9} domain={[0, 30]} label={{ value: t.cduFlow, angle: -90, position: "insideLeft", fill: "#06b6d4", fontSize: 10 }} />
                    <YAxis yAxisId="temp" orientation="right" stroke="#f97316" tick={{ fill: "#f97316" }} fontSize={9} domain={[15, 70]} label={{ value: t.gpuTemp, angle: 90, position: "insideRight", fill: "#f97316", fontSize: 10 }} />
                    <Tooltip content={<DualAxisTooltip />} />
                    {/* CDU Flow */}
                    <Line yAxisId="flow" type="monotone" dataKey="proactive_cdu_flow" name={`CDU Flow (${t.proactive})`} stroke="#34d399" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line yAxisId="flow" type="monotone" dataKey="reactive_cdu_flow" name={`CDU Flow (${t.reactive})`} stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="6 3" isAnimationActive={false} />
                    {/* Temperature overlay */}
                    <Line yAxisId="temp" type="monotone" dataKey="proactive_gpu_temp" name={`Temp (${t.proactive})`} stroke="#10b981" strokeWidth={1} dot={false} isAnimationActive={false} opacity={0.5} />
                    <Line yAxisId="temp" type="monotone" dataKey="reactive_gpu_temp" name={`Temp (${t.reactive})`} stroke="#f97316" strokeWidth={1} dot={false} strokeDasharray="4 2" isAnimationActive={false} opacity={0.5} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </ClientOnlyChart>
          </div>

          {/* Legend/Info bar */}
          <div className="bg-[#0a1e3f]/30 border border-slate-800/50 rounded-xl p-3 flex items-center gap-6 text-[10px] font-mono text-slate-400 flex-wrap">
            <div className="flex items-center gap-2">
              <ArrowUpRight size={12} className="text-emerald-400" />
              <span className="text-emerald-400 font-bold">{t.proactive}</span>
              <span>— {language === "en" ? "CDU pre-ramps before GPU heat arrives. Temp stays flat." : "CDU 在 GPU 發熱前預先升流，溫度保持平穩"}</span>
            </div>
            <div className="flex items-center gap-2">
              <ArrowDownRight size={12} className="text-red-400" />
              <span className="text-red-400 font-bold">{t.reactive}</span>
              <span>— {language === "en" ? "CDU reacts after temp rises. Causes thermal spikes." : "CDU 等溫度升高才反應，產生熱衝擊尖峰"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
