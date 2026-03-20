"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from "recharts";
import { Activity, Server, AlertTriangle, Cpu, Thermometer, Clock, Database, Power } from "lucide-react";

type ServerTelemetry = {
  server_id: string;
  cpu_usage: number;
  temperature: number;
  timestamp: number;
};

const PIE_COLORS = ['#00f2fe', '#4facfe', '#00f2c3', '#f83600'];

// 邊框風格小組件 (呈現科技感角框)
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
    <div className="flex-1 p-4 relative overflow-hidden">
      {children}
    </div>
  </div>
);

export default function Dashboard() {
  const [data, setData] = useState<ServerTelemetry[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [time, setTime] = useState("");

  useEffect(() => {
    // 時間更新
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now.toLocaleTimeString("zh-TW", { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("http://localhost:8000/metrics");
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
            time: new Date().toLocaleTimeString("zh-TW", { hour12: false, minute: '2-digit', second:'2-digit' }),
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
    };

    fetchData();
    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, []);

  // 計算狀態
  const totalServers = data.length;
  const warningServers = data.filter(d => d.temperature > 50 || d.cpu_usage > 85).length;
  const healthyServers = totalServers - warningServers;

  const pieData = [
    { name: '正常運行 (Healthy)', value: healthyServers },
    { name: '高負載/異常 (Warning)', value: warningServers }
  ];

  return (
    <div className="w-full bg-[#010613] text-slate-300 font-sans flex flex-col overflow-x-hidden selection:bg-cyan-900">
      {/* HUD Header */}
      <header className="relative flex justify-between items-end px-8 py-3 mb-4 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
        {/* 底部霓虹光束 */}
        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent shadow-[0_0_10px_#06b6d4]"></div>
        
        <div className="flex items-center gap-4">
          <Database className="text-cyan-400 animate-pulse" size={32} />
          <h1 className="text-3xl font-black italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 uppercase drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]">
            DATACENTER COMMAND CENTER
          </h1>
        </div>

        <div className="flex gap-8 items-center text-sm font-bold font-mono text-cyan-500">
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500 shadow-[0_0_8px_#06b6d4]"></span>
            </span>
            SYSTEM ONLINE
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
          <TechPanel title="全區負載趨勢 (CPU Trend)" className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#1e3a8a" fontSize={10} tickMargin={5} />
                <YAxis stroke="#1e3a8a" fontSize={10} domain={[0, 100]} />
                <RechartsTooltip contentStyle={{ backgroundColor: '#020b1a', borderColor: '#06b6d4', color: '#fff' }} />
                <Area type="monotone" dataKey="avgCpu" stroke="#06b6d4" fillOpacity={1} fill="url(#colorCpu)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </TechPanel>

          <TechPanel title="機房溫度趨勢 (Temp Trend)" className="h-[280px]">
             <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#1e3a8a" fontSize={10} tickMargin={5} />
                <YAxis stroke="#1e3a8a" fontSize={10} domain={[10, 60]} />
                <RechartsTooltip contentStyle={{ backgroundColor: '#020b1a', borderColor: '#ef4444', color: '#fff' }} />
                <Area type="monotone" dataKey="avgTemp" stroke="#ef4444" fillOpacity={1} fill="url(#colorTemp)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </TechPanel>

          <TechPanel title="設備健康狀態分佈 (Health)" className="flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  isAnimationActive={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#06b6d4' : '#ef4444'} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{ backgroundColor: '#020b1a', borderColor: '#1e3a8a', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
            {/* 中間文字 */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-4">
               <span className="text-3xl font-black text-white">{totalServers}</span>
               <span className="text-[10px] text-cyan-600 font-bold uppercase tracking-widest">Total</span>
            </div>
          </TechPanel>
        </div>

        {/* Center Column (Server Grid Matrix) */}
        <div className="col-span-6 flex flex-col gap-6">
          <TechPanel title="機房伺服器陣列監控矩陣 (Server Matrix)" className="flex-1">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-2">
              {data.length === 0 ? (
                <div className="col-span-full h-full flex items-center justify-center text-cyan-800 animate-pulse font-mono tracking-widest mt-20">
                  AWAITING VITAL SIGNALS...
                </div>
              ) : (
                data.map((srv) => {
                  const isWarn = srv.cpu_usage > 85 || srv.temperature > 50;
                  return (
                    <div key={srv.server_id} className={`p-4 border-l-4 bg-gradient-to-r from-[#03112b] to-transparent ${isWarn ? 'border-red-500 shadow-[inset_0_0_15px_rgba(239,68,68,0.2)]' : 'border-cyan-500 hover:bg-[#06183a]'} transition-all`}>
                       <div className="flex justify-between items-start mb-2">
                          <div className={`font-mono font-bold ${isWarn ? 'text-red-400' : 'text-cyan-100'} text-lg`}>{srv.server_id}</div>
                          {isWarn ? <AlertTriangle size={16} className="text-red-500 animate-pulse" /> : <Power size={16} className="text-cyan-700" />}
                       </div>
                       
                       {/* Metrics Mini-Bar */}
                       <div className="mt-4 space-y-3">
                         <div className="relative">
                           <div className="flex justify-between text-[10px] text-cyan-600 font-bold mb-1">
                             <span className="flex items-center gap-1"><Cpu size={10}/> CPU</span>
                             <span className={srv.cpu_usage > 85 ? 'text-red-400' : 'text-white'}>{srv.cpu_usage.toFixed(1)}%</span>
                           </div>
                           <div className="h-1 w-full bg-[#0a1e3f] overflow-hidden">
                             <div className={`h-full ${srv.cpu_usage > 85 ? 'bg-red-500' : 'bg-cyan-400'}`} style={{width: `${srv.cpu_usage}%`}}></div>
                           </div>
                         </div>

                         <div className="relative">
                           <div className="flex justify-between text-[10px] text-cyan-600 font-bold mb-1">
                             <span className="flex items-center gap-1"><Thermometer size={10}/> TEMP</span>
                             <span className={srv.temperature > 50 ? 'text-red-400' : 'text-white'}>{srv.temperature.toFixed(1)}°C</span>
                           </div>
                           <div className="h-1 w-full bg-[#0a1e3f] overflow-hidden">
                             <div className={`h-full ${srv.temperature > 50 ? 'bg-red-500' : 'bg-yellow-400'}`} style={{width: `${(srv.temperature/100)*100}%`}}></div>
                           </div>
                         </div>
                       </div>
                    </div>
                  );
                })
              )}
            </div>
          </TechPanel>
        </div>

        {/* Right Column (Alarms & Details) */}
        <div className="col-span-3 flex flex-col gap-6">
          <TechPanel title="各節點 CPU 負載佔比" className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis dataKey="server_id" type="category" stroke="#1e3a8a" fontSize={10} width={70} tick={{fill: '#06b6d4'}} />
                <RechartsTooltip cursor={{fill: '#1e3a8a'}} contentStyle={{ backgroundColor: '#020b1a', borderColor: '#06b6d4', color: '#fff' }} />
                <Bar dataKey="cpu_usage" isAnimationActive={false}>
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.cpu_usage > 85 ? '#ef4444' : '#06b6d4'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </TechPanel>

          <TechPanel title="即時系統警報 (Real-time Alarms)" className="flex-1">
             <div className="h-full overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {data.filter(s => s.cpu_usage > 85 || s.temperature > 50).length === 0 ? (
                   <div className="text-xs text-cyan-800 font-mono text-center mt-10">NO ACTIVE ALARMS</div>
                ) : (
                  data.filter(s => s.cpu_usage > 85 || s.temperature > 50).map(srv => (
                    <div key={`alarm-${srv.server_id}`} className="bg-red-950/40 border border-red-900 p-3 rounded-none flex gap-3 items-start relative overflow-hidden group">
                       <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                       <AlertTriangle className="text-red-500 shrink-0" size={16} />
                       <div className="flex-1">
                          <div className="text-red-400 text-xs font-bold font-mono">[{srv.server_id}] CRITICAL WARNING</div>
                          <div className="text-red-200/60 text-[10px] mt-1 space-y-1">
                            {srv.cpu_usage > 85 && <div>- CPU Overload ({srv.cpu_usage.toFixed(1)}%)</div>}
                            {srv.temperature > 50 && <div>- High Temperature ({srv.temperature.toFixed(1)}°C)</div>}
                          </div>
                          <div className="text-red-900 text-[9px] mt-2 text-right">{new Date(srv.timestamp).toLocaleTimeString()}</div>
                       </div>
                    </div>
                  ))
                )}
             </div>
          </TechPanel>
        </div>

      </main>
      
      {/* 科技感底邊界 */}
      <footer className="h-1bg-gradient-to-r from-transparent via-[#1e3a8a] to-transparent opacity-50 mb-1"></footer>
    </div>
  );
}
