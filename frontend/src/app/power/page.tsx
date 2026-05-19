"use client";

import { useState, useMemo, useCallback } from "react";
import {
  ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import {
  Zap, Cpu, ShieldAlert, Sparkles, Sliders, CheckCircle, RefreshCw, AlertOctagon,
  Settings, Users, Layers, TrendingUp, Info, Activity, Gauge, BatteryCharging
} from "lucide-react";
import { ClientOnlyChart } from "@/components/ClientOnlyChart";
import { usePolling } from "@/shared/hooks/usePolling";
import { apiUrl } from "@/shared/api";
import { authFetch } from "@/shared/auth";
import { useLanguage } from "@/shared/i18n/language";

// ── Types ──────────────────────────────────────────────────
type PowerServer = {
  server_id: string;
  gpu_model: string | null;
  priority: "critical" | "normal" | "background";
  max_cap: number;
  min_cap: number;
  cap_value: number;
  capped: boolean;
  power_state: "on" | "off";
  cpu_usage: number;
  flops: number;
  power_kw: number;
};

type TimelinePoint = {
  time_label: string;
  total_power_kw: number;
  it_power_kw: number;
  facility_power_kw: number;
  grid_limit: number;
  carbon_rate: number;
  capped_count: number;
};

// ── Priority Badge Helper ─────────────────────────────────
const priorityBadge = (priority: string) => {
  switch (priority) {
    case "critical":
      return <span className="text-[9px] px-2 py-0.5 rounded bg-red-950/40 text-red-400 border border-red-800/30 font-bold uppercase tracking-wider">Tier 1 - Critical</span>;
    case "normal":
      return <span className="text-[9px] px-2 py-0.5 rounded bg-blue-950/40 text-blue-400 border border-blue-800/20 font-bold uppercase tracking-wider">Tier 2 - Normal</span>;
    case "background":
      return <span className="text-[9px] px-2 py-0.5 rounded bg-yellow-950/30 text-yellow-500 border border-yellow-800/20 font-bold uppercase tracking-wider">Tier 3 - Background</span>;
    default:
      return null;
  }
};

// ── Tooltip ───────────────────────────────────────────────
function PowerChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#020b1a]/95 border border-cyan-800/50 p-3 rounded-lg shadow-xl text-xs font-mono backdrop-blur-sm">
      <div className="text-cyan-300 font-bold mb-2">{label}</div>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex justify-between gap-4" style={{ color: entry.color }}>
          <span>{entry.name}</span>
          <span className="font-bold">{entry.value.toFixed(1)} {entry.name.includes("Capped") ? "nodes" : "kW"}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────
export default function PowerCappingPage() {
  const { language } = useLanguage();

  // Translations
  const t = useMemo(() => language === "en" ? {
    title: "DYNAMIC POWER CAPPING & CARBON TRACKING",
    subtitle: "Closed-loop Energy Allocation × Dynamic Carbon Auditing",
    headroom: "Grid Capacity & Headroom",
    servers: "Server Cluster Grid",
    timeline: "Dynamic Energy & Carbon Analytics",
    emergency: "GRID CAPACITY CRISIS SIMULATOR",
    emergencyDesc: "Simulate a severe grid drop to observe automated self-healing power limits.",
    activeEmergency: "EMERGENCY ACTIVE",
    triggerEmergency: "SIMULATE GRID CAPACITY DROP (COMPUTEX DEMO)",
    resolveEmergency: "RESOLVE GRID EMERGENCY & RESTORE CAPACITY",
    contractLimit: "Contract Grid Limit",
    safetyLimit: "Safety Margin (95%)",
    totalPower: "Total Load",
    itPower: "IT Load",
    facilityPower: "Facility/CDU Load",
    carbonRate: "Carbon Emission Rate",
    cumCarbon: "Cumulative Carbon",
    cappedDevices: "Capped Devices",
    batchTitle: "Redfish Batch Policy Drawer",
    applyBtn: "Apply Redfish Capping Policy",
    targetSelected: "Selected",
    successMsg: "Policy deployed successfully via Redfish API BMC.",
    allOnline: "ALL POWERED ON",
    searchPlaceholder: "Search by Server ID..."
  } : {
    title: "動態電力限制與碳排管理系統",
    subtitle: "閉環式電力分配調度 × 即時動態碳足跡追踪",
    headroom: "電網容量與電力餘裕 (Headroom)",
    servers: "伺服器群組原則管理矩陣",
    timeline: "動態電力與碳排時序分析",
    emergency: "電網緊急限電自癒模擬器 (Computex 專屬)",
    emergencyDesc: "模擬外部電網限制事件，實時展示系統「閉環式調度自癒降頻」全自動過程。",
    activeEmergency: "⚡ 電網緊急限電中 ⚡",
    triggerEmergency: "模擬電網容量暴跌 50% (COMPUTEX 現場互動)",
    resolveEmergency: "解除電網限制 ➜ 恢復全額供電與算力",
    contractLimit: "契約用電容量",
    safetyLimit: "安全警戒容量 (95%)",
    totalPower: "總耗電功率",
    itPower: "IT 設備功率",
    facilityPower: "冷卻與廠務功耗",
    carbonRate: "即時碳排放率",
    cumCarbon: "累計碳排放量",
    cappedDevices: "已限電設備數",
    batchTitle: "Redfish 批次群組原則控制面板",
    applyBtn: "對選取設備派發 Redfish Capping 原則",
    targetSelected: "已選取",
    successMsg: "電力原則已順利透過 BMC 接口套用成功",
    allOnline: "正常運作中",
    searchPlaceholder: "輸入伺服器名稱篩選..."
  }, [language]);

  // States
  const [servers, setServers] = useState<PowerServer[]>([]);
  const [status, setStatus] = useState<any>({});
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Policy Form States
  const [targetPriority, setTargetPriority] = useState<"critical" | "normal" | "background" | "">("");
  const [targetCap, setTargetCap] = useState<number>(0);
  const [deploying, setDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState(false);

  // Dynamic Polling
  usePolling(async () => {
    try {
      const [statusRes, serversRes] = await Promise.all([
        authFetch(apiUrl("/api/power/status")),
        authFetch(apiUrl("/api/power/servers"))
      ]);
      
      if (statusRes.ok) {
        const sData = await statusRes.json();
        setStatus(sData);
        setTimeline(sData.timeline || []);
      }
      
      if (serversRes.ok) {
        const svData = await serversRes.json();
        setServers(svData.servers || []);
      }
    } catch {}
  }, { intervalMs: 2000, immediate: true });

  // Grid Emergency Trigger
  const handleEmergency = async (active: boolean) => {
    try {
      await authFetch(apiUrl("/api/power/emergency"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active })
      });
    } catch {}
  };

  // Batch Policy Submission (Simulates Redfish API execution progress bar)
  const handleBatchDeploy = async () => {
    if (selectedIds.length === 0) return;
    setDeploying(true);
    setDeploySuccess(false);
    
    // Simulating the Redfish API deployment lag (1.5s)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    try {
      const body: any = { server_ids: selectedIds };
      if (targetPriority) body.priority = targetPriority;
      if (targetCap > 0) body.cap_value = targetCap;
      
      const res = await authFetch(apiUrl("/api/power/batch-policy"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        setDeploySuccess(true);
        setSelectedIds([]);
        setTimeout(() => setDeploySuccess(false), 3000);
      }
    } catch {} finally {
      setDeploying(false);
    }
  };

  // Selection toggle
  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Filtered servers list
  const filteredServers = useMemo(() => {
    return servers.filter(s =>
      s.server_id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [servers, searchQuery]);

  // Headroom Bullet Chart Math
  const totalPower = status.total_power_kw || 0;
  const gridLimit = status.grid_limit_kw || 250;
  const safetyLimit = gridLimit * (status.safety_margin || 0.95);
  const powerPercentage = Math.min((totalPower / gridLimit) * 100, 100);
  const safetyPercentage = (safetyLimit / gridLimit) * 100;
  const remainingHeadroom = Math.max(0, gridLimit - totalPower);

  return (
    <div className="p-4 md:p-6 w-full h-full flex flex-col gap-6 overflow-y-auto custom-scrollbar">
      {/* Dynamic Header */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-[#0a1e3f]/30 p-4 rounded-xl border border-cyan-900/40">
        <div className="flex items-center gap-4">
          <BatteryCharging size={32} className="text-cyan-400 animate-pulse" />
          <div>
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400 tracking-widest uppercase">
              {t.title}
            </h1>
            <p className="text-slate-400 text-xs font-mono tracking-widest mt-1">{t.subtitle}</p>
          </div>
        </div>
        
        {/* Core dynamic KPIs */}
        <div className="flex gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-[#020b1a] border border-cyan-800/40 px-3 py-1.5 rounded-lg">
            <Zap size={14} className="text-cyan-400" />
            <span className="text-cyan-300 font-mono font-bold text-xs">{t.totalPower}:</span>
            <span className="text-white font-mono font-bold text-sm">{totalPower.toFixed(1)} kW</span>
          </div>
          <div className="flex items-center gap-2 bg-[#020b1a] border border-emerald-800/40 px-3 py-1.5 rounded-lg">
            <TrendingUp size={14} className="text-emerald-400" />
            <span className="text-emerald-300 font-mono font-bold text-xs">{t.carbonRate}:</span>
            <span className="text-white font-mono font-bold text-sm">{(status.carbon_coefficient * totalPower).toFixed(2)} kg/h</span>
          </div>
          <div className="flex items-center gap-2 bg-[#020b1a] border border-violet-800/40 px-3 py-1.5 rounded-lg">
            <Sparkles size={14} className="text-violet-400" />
            <span className="text-violet-300 font-mono font-bold text-xs">{t.cumCarbon}:</span>
            <span className="text-white font-mono font-bold text-sm">{(status.cumulative_carbon_kg || 0).toFixed(2)} kg</span>
          </div>
          <div className="flex items-center gap-2 bg-yellow-950/30 border border-yellow-800/40 px-3 py-1.5 rounded-lg">
            <ShieldAlert size={14} className="text-yellow-400" />
            <span className="text-yellow-300 font-mono font-bold text-xs">{t.cappedDevices}:</span>
            <span className="text-white font-mono font-bold text-sm">{status.capped_device_count}</span>
            <span className="text-slate-500 font-mono text-[10px]">/{status.total_device_count}</span>
          </div>
        </div>
      </header>

      {/* Computex Interactive Grid emergency simulator */}
      <section className={`border rounded-xl p-4 transition-all duration-500 ${status.grid_emergency_active ? 'bg-red-950/20 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]' : 'bg-[#020b1a] border-cyan-900/30'}`}>
        <div className="flex items-center gap-3 mb-2">
          {status.grid_emergency_active ? (
            <AlertOctagon className="text-red-500 animate-bounce" size={24} />
          ) : (
            <Activity className="text-cyan-400" size={24} />
          )}
          <h2 className="text-sm font-bold text-white tracking-widest uppercase">
            {t.emergency}
          </h2>
          {status.grid_emergency_active && (
            <span className="text-[10px] font-black bg-red-500 text-black px-2 py-0.5 rounded animate-pulse">{t.activeEmergency}</span>
          )}
        </div>
        <p className="text-xs text-slate-400 font-mono mb-4">{t.emergencyDesc}</p>
        
        {status.grid_emergency_active ? (
          <button
            onClick={() => handleEmergency(false)}
            className="w-full py-3 rounded-lg font-bold text-xs uppercase tracking-widest bg-emerald-500 text-black hover:bg-emerald-400 transition-all font-mono"
          >
            {t.resolveEmergency}
          </button>
        ) : (
          <button
            onClick={() => handleEmergency(true)}
            className="w-full py-3 rounded-lg font-bold text-xs uppercase tracking-widest bg-red-600 hover:bg-red-500 text-white transition-all font-mono animate-pulse shadow-lg"
          >
            {t.triggerEmergency}
          </button>
        )}
      </section>

      {/* 2-Column Dashboard layout */}
      <div className="flex-1 grid grid-cols-12 gap-6 min-h-0">
        
        {/* Left Side: Bullet Chart, Analytics Graph, Batch Policy Drawer */}
        <div className="col-span-8 flex flex-col gap-6">
          
          {/* Section 1: Bullet Chart & Headroom */}
          <div className="bg-[#020b1a] border border-cyan-900/30 rounded-xl p-4">
            <h2 className="text-xs font-bold text-cyan-400 tracking-widest uppercase flex items-center gap-2 mb-4">
              <Gauge size={14} /> {t.headroom}
            </h2>
            
            {/* Custom High-fidelity Bullet Chart */}
            <div className="space-y-4">
              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span>{t.totalPower}: <strong className="text-white">{totalPower.toFixed(1)} kW</strong></span>
                <span>{t.contractLimit}: <strong className="text-cyan-400">{gridLimit.toFixed(0)} kW</strong></span>
              </div>
              
              {/* The Bullet Bar */}
              <div className="relative h-6 w-full bg-slate-900/80 rounded-md border border-slate-800 overflow-hidden">
                {/* Visual safety zones */}
                <div className="absolute top-0 left-0 h-full bg-emerald-950/20 border-r border-emerald-500/20" style={{ width: `${safetyPercentage}%` }}></div>
                <div className="absolute top-0 right-0 h-full bg-red-950/10" style={{ left: `${safetyPercentage}%` }}></div>
                
                {/* Active current power value */}
                <div
                  className={`absolute top-0 left-0 h-full rounded-l-md transition-all duration-1000 bg-gradient-to-r ${totalPower > safetyLimit ? 'from-yellow-500 to-red-500' : 'from-cyan-500 to-emerald-400'}`}
                  style={{ width: `${powerPercentage}%` }}
                ></div>
                
                {/* Safety marker (dashed line) */}
                <div className="absolute top-0 h-full border-l-2 border-dashed border-yellow-500/60 z-20" style={{ left: `${safetyPercentage}%` }} title={t.safetyLimit}></div>
              </div>
              
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-emerald-400">● 0 - 80% Safe zone</span>
                <span className="text-yellow-400">▲ 95% Safety Limit ({safetyLimit.toFixed(0)} kW)</span>
                <span className="text-red-400">● Overload (&gt;95%)</span>
              </div>
              
              {/* Headroom calculation panel */}
              <div className="bg-[#0a1e3f]/20 border border-cyan-900/40 rounded-lg p-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Info size={16} className="text-cyan-400" />
                  <span className="text-[11px] font-mono text-slate-300">
                    {language === "en"
                      ? `Available Power Headroom: `
                      : `剩餘安全電力調度餘裕: `}
                    <strong className="text-emerald-400 font-bold">{remainingHeadroom.toFixed(1)} kW</strong>
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                  {remainingHeadroom > 20 
                    ? (language === "en" ? "✓ Stable Grid Capacity" : "✓ 供電安全容量充裕")
                    : (language === "en" ? "⚠ Capping Active to Safeguard Grid" : "⚠ 啟動降頻限制以防跳電")}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Time-series analytics chart */}
          <div className="bg-[#020b1a] border border-cyan-900/30 rounded-xl p-4 flex-1 min-h-[300px]">
            <h2 className="text-xs font-bold text-cyan-400 tracking-widest uppercase flex items-center gap-2 mb-3">
              <TrendingUp size={14} /> {t.timeline}
            </h2>
            <ClientOnlyChart placeholderClassName="h-full w-full">
              <div className="h-[calc(100%-24px)] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 100, height: 230 }}>
                  <ComposedChart data={timeline} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="time_label" stroke="#334155" tick={{ fill: "#64748b" }} fontSize={9} />
                    <YAxis stroke="#06b6d4" tick={{ fill: "#06b6d4" }} fontSize={9} domain={[0, 300]} label={{ value: "Power Load (kW)", angle: -90, position: "insideLeft", fill: "#06b6d4", fontSize: 10 }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#eab308" tick={{ fill: "#eab308" }} fontSize={9} domain={[0, "auto"]} label={{ value: "Capped Devices", angle: 90, position: "insideRight", fill: "#eab308", fontSize: 10 }} />
                    <Tooltip content={<PowerChartTooltip />} />
                    <ReferenceLine y={120} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "120kW Limit", fill: "#ef4444", fontSize: 8, position: "top" }} />
                    <Area type="monotone" dataKey="total_power_kw" name="Total Power" stroke="#06b6d4" strokeWidth={2} fill="url(#powerGrad)" isAnimationActive={false} />
                    <Line type="monotone" dataKey="it_power_kw" name="IT Power" stroke="#34d399" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                    <Line yAxisId="right" type="step" dataKey="capped_count" name="Capped Nodes" stroke="#eab308" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </ClientOnlyChart>
          </div>
        </div>

        {/* Right Side: Server Policy Matrix & Multi-select panel */}
        <div className="col-span-4 flex flex-col gap-4">
          <div className="flex-1 bg-[#020b1a] border border-cyan-900/30 rounded-xl p-4 overflow-hidden flex flex-col">
            <h2 className="text-xs font-bold text-cyan-400 tracking-widest uppercase flex items-center gap-2 mb-3 shrink-0">
              <Layers size={14} /> {t.servers}
              {selectedIds.length > 0 && (
                <span className="text-[10px] font-black bg-cyan-500 text-black px-2 py-0.5 rounded-sm ml-auto">
                  {selectedIds.length} {t.targetSelected}
                </span>
              )}
            </h2>
            
            {/* Search filter */}
            <div className="mb-3 shrink-0">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full bg-[#0a1e3f]/40 border border-cyan-800/40 rounded px-2.5 py-1.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Servers Grid */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
              {filteredServers.map(s => (
                <div
                  key={s.server_id}
                  onClick={() => toggleSelect(s.server_id)}
                  className={`border rounded-lg p-3 transition-all cursor-pointer relative overflow-hidden group select-none ${
                    selectedIds.includes(s.server_id)
                      ? "border-cyan-400 bg-cyan-950/20"
                      : s.power_state === "off"
                      ? "border-slate-800/80 bg-slate-950/10 opacity-50"
                      : s.capped
                      ? "border-yellow-600/40 bg-yellow-950/10"
                      : "border-cyan-900/20 bg-[#0a1e3f]/20 hover:border-cyan-800/50"
                  }`}
                >
                  {/* Decorative Cap tag indicator */}
                  {s.capped && s.power_state !== "off" && (
                    <div className="absolute top-0 right-0 bg-yellow-500 text-black font-bold text-[7px] px-1.5 py-0.5 rounded-bl select-none uppercase tracking-wider font-mono">
                      Capped
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3">
                    {/* Checkbox */}
                    <div className={`w-3.5 h-3.5 rounded border transition-all flex items-center justify-center shrink-0 ${
                      selectedIds.includes(s.server_id)
                        ? "border-cyan-400 bg-cyan-500 text-black"
                        : "border-slate-700"
                    }`}>
                      {selectedIds.includes(s.server_id) && <CheckCircle size={10} className="stroke-[3]" />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold font-mono text-slate-200">{s.server_id}</span>
                        {priorityBadge(s.priority)}
                      </div>
                      
                      <div className="text-[9px] text-slate-500 mt-1 flex justify-between">
                        <span>{s.gpu_model ? s.gpu_model.slice(0, 15) : "CPU Node"}</span>
                        <span className="font-mono text-slate-400">{s.power_state === "off" ? "OFF" : `${(s.power_kw ?? 0.0).toFixed(1)} kW`}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Batch Capping Drawer (Visible only when servers are selected) */}
            {selectedIds.length > 0 && (
              <div className="mt-4 pt-4 border-t border-cyan-900/40 shrink-0 bg-[#020b1a] space-y-3">
                <div className="text-[11px] font-bold text-cyan-300 uppercase tracking-widest font-mono flex items-center gap-2">
                  <Sliders size={12} /> {t.batchTitle}
                </div>
                
                {/* Priority Selection */}
                <div>
                  <label className="block text-[9px] text-slate-500 uppercase tracking-wider mb-1 font-mono">Set priority tier</label>
                  <select
                    value={targetPriority}
                    onChange={e => setTargetPriority(e.target.value as any)}
                    className="w-full bg-[#0a1e3f]/60 border border-cyan-800/40 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none"
                  >
                    <option value="">No Change</option>
                    <option value="critical">Tier 1 - Critical</option>
                    <option value="normal">Tier 2 - Normal</option>
                    <option value="background">Tier 3 - Background</option>
                  </select>
                </div>

                {/* Power Cap Target */}
                <div>
                  <label className="block text-[9px] text-slate-500 uppercase tracking-wider mb-1 font-mono">
                    Limit Power Cap: {targetCap > 0 ? `${targetCap.toFixed(1)} kW` : "Uncapped"}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0.6"
                      max="8.0"
                      step="0.1"
                      value={targetCap}
                      onChange={e => setTargetCap(parseFloat(e.target.value))}
                      className="flex-1 accent-cyan-500 bg-slate-800 h-1 rounded-lg cursor-pointer"
                    />
                    <button
                      onClick={() => setTargetCap(0)}
                      className="text-[9px] text-slate-400 hover:text-white border border-slate-700 px-1.5 py-0.5 rounded font-mono"
                    >
                      Reset
                    </button>
                  </div>
                  <span className="text-[8px] text-slate-600 block mt-1 font-mono">
                    * Physical limits: GPU: 3.0~8.0 kW | CPU: 0.6~1.5 kW
                  </span>
                </div>

                {/* Submit button */}
                <button
                  onClick={handleBatchDeploy}
                  disabled={deploying}
                  className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-black font-bold rounded-lg text-xs uppercase tracking-widest font-mono flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                >
                  {deploying ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      BMC Redfish Dispatching...
                    </>
                  ) : (
                    <>
                      <Sliders size={14} />
                      {t.applyBtn}
                    </>
                  )}
                </button>

                {deploySuccess && (
                  <div className="bg-emerald-950/20 border border-emerald-500/40 text-emerald-400 text-[10px] py-1.5 px-3 rounded flex items-center gap-2 font-mono">
                    <CheckCircle size={12} />
                    {t.successMsg}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
