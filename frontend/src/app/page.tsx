"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from "recharts";
import { Activity, AlertTriangle, Cpu, Thermometer, Clock, Database, Power, LayoutGrid, Box, Link2 } from "lucide-react";
import { useDcimStore } from "@/store/useDcimStore";
import { ClientOnlyChart } from "@/components/ClientOnlyChart";
import { usePolling } from "@/shared/hooks/usePolling";
import { apiUrl } from "@/shared/api";
import { useLanguage } from "@/shared/i18n/language";

type ServerTelemetry = {
  server_id: string;
  cpu_usage: number;
  temperature: number;
  timestamp: number;
  traffic_gbps?: number;
  ports_active?: number;
  ports_total?: number;
};

const TechPanel = ({ title, children, className = "" }: { title: string, children: React.ReactNode, className?: string }) => (
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
);

export default function Dashboard() {
  const { language } = useLanguage();
  const store = useDcimStore();
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
    };
  }, [language]);
  const [data, setData] = useState<ServerTelemetry[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [time, setTime] = useState("");
  const [simMode, setSimMode] = useState("simulation");

  // 初始化模式
  useEffect(() => {
    const fetchMode = async () => {
      try {
        const res = await fetch(apiUrl("/api/system/mode"));
        if (res.ok) {
          const json = await res.json();
          setSimMode(json.mode);
        }
      } catch (e) { }
    };
    fetchMode();
  }, []);

  const toggleMode = async () => {
    const newMode = simMode === "simulation" ? "real" : "simulation";
    try {
      await fetch(apiUrl("/api/system/mode"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: newMode })
      });
      setSimMode(newMode);
    } catch (e) { }
  };

  useEffect(() => {
    // 時間更新
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString("zh-TW", { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  usePolling(async () => {
    try {
      const res = await fetch(apiUrl("/metrics"));
      if (!res.ok) return;
      const json = await res.json();

      const sortedData = (json.data || []).sort((a: ServerTelemetry, b: ServerTelemetry) =>
        a.server_id.localeCompare(b.server_id)
      );
      setData(sortedData);

      // 更新歷史紀錄供圖表使用
      setHistory(prev => {
        const avgCpu = sortedData.reduce((acc: number, cur: ServerTelemetry) => acc + cur.cpu_usage, 0) / (sortedData.length || 1);
        const avgTemp = sortedData.reduce((acc: number, cur: ServerTelemetry) => acc + cur.temperature, 0) / (sortedData.length || 1);
        const newPoint = {
          time: new Date().toLocaleTimeString("zh-TW", { hour12: false, minute: "2-digit", second: "2-digit" }),
          avgCpu: Number(avgCpu.toFixed(1)),
          avgTemp: Number(avgTemp.toFixed(1))
        };
        const newHistory = [...prev, newPoint];
        if (newHistory.length > 20) newHistory.shift(); // 保持最後 20 筆
        return newHistory;
      });
    } catch (e) {
      // 靜默處理錯誤以維持畫面
    }
  }, { intervalMs: 5000, immediate: true });

  // --- Unified Health Scoring Logic ---
  const getDeviceStatus = (item: any, srv: ServerTelemetry | undefined) => {
    if (!srv) return 'offline';

    // Switch specific thresholds (Dynamic)
    if (item.type === 'switch' || item.rackType === 'network') {
      const traffic = srv.traffic_gbps || 0;
      const ports = srv.ports_active || 0;
      const cpu = srv.cpu_usage || 0;
      const temp = srv.temperature || 0;
      if (traffic > 35 || ports > 42 || cpu > 85 || temp > 55) return 'critical';
      if (traffic > 25 || ports > 35 || cpu > 60 || temp > 45) return 'warning';
      return 'normal';
    }
    // Server thresholds
    else {
      const cpu = srv.cpu_usage || 0;
      const temp = srv.temperature || 0;
      if (cpu > 85 || temp > 55) return 'critical';
      if (cpu > 60 || temp > 45) return 'warning';
      return 'normal';
    }
  };

  const telemetryById = useMemo(
    () => new Map(data.map((d) => [d.server_id, d])),
    [data]
  );

  // Calculate stats based on store servers (Filtered by location)
  const allGridItems = useMemo(() =>
    store.racks
      .filter(r => r.locationId === store.currentLocationId)
      .flatMap(r => r.servers.map(s => ({ ...s, rackName: r.name, rackType: r.type }))),
    [store.racks, store.currentLocationId]
  );
  const totalServers = allGridItems.length;

  const { healthData, pieData } = useMemo(() => {
    const health = allGridItems.reduce((acc, item) => {
      const srv = telemetryById.get(item.name);
      const status = getDeviceStatus(item, srv);
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
  }, [allGridItems, telemetryById]);

  const itemNameSet = useMemo(() => new Set(allGridItems.map((i) => i.name)), [allGridItems]);
  const activeStoreData = useMemo(
    () => data.filter((d) => itemNameSet.has(d.server_id)),
    [data, itemNameSet]
  );

  return (
    <div className="w-full bg-[#010613] text-slate-300 font-sans flex flex-col overflow-x-hidden selection:bg-cyan-900">
      {/* HUD Header */}
      <header className="relative flex justify-between items-end px-8 py-3 mb-4 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
        {/* 底部霓虹光束 */}
        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent shadow-[0_0_10px_#06b6d4]"></div>

        <div className="flex items-center gap-4">
          <Database className="text-cyan-400 animate-pulse" size={32} />
          <h1 className="text-3xl font-black italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 uppercase drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]">
            {t.title}
          </h1>
        </div>

        <div className="flex gap-8 items-center text-sm font-bold font-mono text-cyan-500">
          <button
            onClick={toggleMode}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all duration-300 ${simMode === 'simulation' ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.5)] hover:bg-cyan-900' : 'bg-[#0a1e3f] border-slate-600 text-slate-400 hover:border-slate-400'} text-[10px] uppercase tracking-widest`}
          >
            <div className={`w-2 h-2 rounded-full ${simMode === 'simulation' ? 'bg-cyan-400 animate-pulse' : 'bg-rose-500'}`}></div>
            {simMode === 'simulation' ? t.sim : t.live}
          </button>

          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500 shadow-[0_0_8px_#06b6d4]"></span>
            </span>
            {t.online}
          </div>
          <div className="flex items-center gap-2 bg-[#0a1e3f] border border-cyan-800 px-4 py-1 rounded-bl-xl rounded-tr-xl">
            <Clock size={16} />
            <span className="text-white">{time || "00:00:00"}</span>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 p-6 grid grid-cols-12 gap-6">

        {/* Left Column (Charts) */}
        <div className="col-span-3 flex flex-col gap-6">
          <TechPanel title={t.cpuTrend} className="h-[280px]">
            <ClientOnlyChart>
            <div className="h-full w-full min-h-[180px]">
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
            </div>
            </ClientOnlyChart>
          </TechPanel>

          <TechPanel title={t.tempTrend} className="h-[280px]">
            <ClientOnlyChart>
            <div className="h-full w-full min-h-[180px]">
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
            </div>
            </ClientOnlyChart>
          </TechPanel>

          <TechPanel title={t.health} className="flex-1 min-h-[220px]">
            <div className="h-[180px] w-full relative flex items-center justify-center">
              <ClientOnlyChart placeholderClassName="h-[180px] w-[200px]">
              <ResponsiveContainer width={200} height={180} initialDimension={{ width: 200, height: 180 }}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
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
                <span className="text-3xl font-black text-white leading-none">{totalServers}</span>
                <span className="text-[10px] text-cyan-600 font-bold uppercase tracking-widest">Total</span>
              </div>
            </div>
          </TechPanel>
        </div>

        {/* Center Column (Server Grid Matrix) */}
        <div className="col-span-6 flex flex-col gap-6">
          <TechPanel title={t.matrix} className="flex-1">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-2">
              {(() => {
                const filteredRacks = store.racks.filter(r => r.locationId === store.currentLocationId);
                const storeServers = filteredRacks.flatMap(r => r.servers.map(s => ({ ...s, rackName: r.name })));
                const items = storeServers.sort((a, b) => a.name.localeCompare(b.name));

                if (items.length === 0) {
                  return (
                    <div className="col-span-full h-full flex items-center justify-center text-cyan-800 animate-pulse font-mono tracking-widest mt-20">
                      {t.awaiting}
                    </div>
                  );
                }

                return items.map(item => {
                  const srv = telemetryById.get(item.name);
                  const liveStatus = getDeviceStatus(item, srv);

                  const borderColor = liveStatus === 'critical' ? 'border-red-500' : liveStatus === 'warning' ? 'border-yellow-500' : 'border-cyan-500';
                  const titleColor = liveStatus === 'critical' ? 'text-red-400' : liveStatus === 'warning' ? 'text-yellow-400' : 'text-cyan-100';
                  const shadowCss = liveStatus === 'critical' ? 'shadow-[inset_0_0_15px_rgba(239,68,68,0.2)]' : liveStatus === 'warning' ? 'shadow-[inset_0_0_15px_rgba(245,158,11,0.2)]' : 'hover:bg-[#06183a]';

                  if (!srv) {
                    return (
                      <div key={item.id} className="p-4 border-l-4 bg-gradient-to-r from-[#03112b] to-transparent border-slate-700 opacity-60 hover:opacity-100 transition-all">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex flex-col">
                            <div className="font-mono font-bold text-slate-500 text-lg">{item.name}</div>
                            <div className="text-[10px] text-slate-600 bg-[#0a1e3f] border border-slate-800 px-1.5 py-0.5 rounded w-fit flex items-center gap-1 mt-1">
                              <LayoutGrid size={10} /> {item.rackName}
                            </div>
                          </div>
                          <Power size={16} className="text-slate-700 mt-1" />
                        </div>
                        <div className="mt-4 flex items-center justify-center py-5 bg-slate-900/30 rounded border border-slate-800/50">
                          <span className="text-[10px] text-slate-500 tracking-widest font-mono">OFFLINE / NO SIGNAL</span>
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

                      {/* Metrics Mini-Bar */}
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
                            {/* Mgmt Info: CPU & Temp */}
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
                                <span className={srv.temperature > 50 ? 'text-red-400' : srv.temperature > 40 ? 'text-yellow-400' : 'text-white'}>{(srv.temperature || 0).toFixed(1)}°C</span>
                              </div>
                              <div className="h-1 w-full bg-[#0a1e3f] overflow-hidden">
                                <div className={`h-full ${srv.temperature > 50 ? 'bg-red-500' : srv.temperature > 40 ? 'bg-yellow-400' : 'bg-blue-400'}`} style={{ width: `${((srv.temperature || 0) / 100) * 100}%` }}></div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </TechPanel>
        </div>

        {/* Right Column (Alarms & Details) */}
        <div className="col-span-3 flex flex-col gap-6">
          <TechPanel title={t.cpuByNode} className="h-[300px]">
            <ClientOnlyChart placeholderClassName="h-full w-full min-h-[200px]">
            <div className="h-full w-full min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 100, height: 200 }}>
              <BarChart data={activeStoreData} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis dataKey="server_id" type="category" stroke="#1e3a8a" fontSize={10} width={70} tick={{ fill: '#06b6d4' }} />
                <RechartsTooltip cursor={{ fill: '#1e3a8a' }} contentStyle={{ backgroundColor: '#020b1a', borderColor: '#06b6d4', color: '#fff' }} />
                <Bar dataKey="cpu_usage" isAnimationActive={false}>
                  {activeStoreData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.cpu_usage > 85 ? '#ef4444' : '#06b6d4'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            </div>
            </ClientOnlyChart>
          </TechPanel>

          <TechPanel title={t.alarms} className="flex-1">
            <div className="h-full overflow-y-auto pr-2 space-y-2 custom-scrollbar">
              {(() => {
                const criticalDevices = allGridItems.filter(item => {
                  const srv = telemetryById.get(item.name);
                  return getDeviceStatus(item, srv) === 'critical';
                });

                if (criticalDevices.length === 0) {
                  return <div className="text-xs text-cyan-800 font-mono text-center mt-10 uppercase tracking-widest">{t.noAlarms}</div>;
                }

                return criticalDevices.map(item => {
                  const srv = telemetryById.get(item.name);
                  if (!srv) return null;

                  const traffic = srv.traffic_gbps || 0;
                  const ports = srv.ports_active || 0;
                  const cpu = srv.cpu_usage || 0;
                  const temp = srv.temperature || 0;

                  return (
                    <div key={`alarm-${item.name}`} className="bg-red-950/40 border border-red-900 p-3 rounded-none flex gap-3 items-start relative overflow-hidden group">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                      <AlertTriangle className="text-red-500 shrink-0" size={16} />
                      <div className="flex-1">
                        <div className="text-red-400 text-xs font-bold font-mono">[{item.name}] CRITICAL STATE</div>
                        <div className="text-red-200/60 text-[10px] mt-1 space-y-1">
                          {item.type === 'switch' ? (
                            <>
                              {traffic > 35 && <div>- Network Congestion ({traffic.toFixed(1)} Gbps)</div>}
                              {ports > 42 && <div>- Port Saturation ({ports}/48)</div>}
                              {cpu > 85 && <div>- Mgmt CPU Critical ({cpu.toFixed(0)}%)</div>}
                              {temp > 55 && <div>- Chassis Overheat ({temp.toFixed(0)}°C)</div>}
                            </>
                          ) : (
                            <>
                              {cpu > 85 && <div>- Processor Overload ({cpu.toFixed(1)}%)</div>}
                              {temp > 55 && <div>- High Core Temperature ({temp.toFixed(1)}°C)</div>}
                            </>
                          )}
                        </div>
                        <div className="text-red-900 text-[9px] mt-2 text-right">{new Date(srv.timestamp).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </TechPanel>
        </div>

      </main>

      {/* 科技感底邊界 */}
      <footer className="h-1 bg-gradient-to-r from-transparent via-[#1e3a8a] to-transparent opacity-50 mb-1"></footer>
    </div>
  );
}
