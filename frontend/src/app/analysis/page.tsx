"use client";

import { useEffect, useState } from "react";
import { LineChart as ChartIcon, Activity } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

type HistoryData = {
  [server_id: string]: [number, number][]; // [temperature, cpu][]
};

export default function AnalysisPage() {
  const [history, setHistory] = useState<HistoryData>({});

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch("http://localhost:8000/history");
        if (res.ok) {
          const json = await res.json();
          setHistory(json.data);
        }
      } catch (e) {}
    };
    fetchHistory();
    const timer = setInterval(fetchHistory, 2000);
    return () => clearInterval(timer);
  }, []);

  // 轉換特定 Server 的資料為圖表格式
  const getChartData = (serverId: string) => {
    if (!history[serverId]) return [];
    return history[serverId].map((point, i) => ({
      index: i,
      temp: point[0],
      cpu: point[1]
    }));
  };

  const servers = Object.keys(history).sort();

  return (
    <div className="p-8 pb-20 max-w-7xl mx-auto h-full flex flex-col">
       <header className="mb-6 flex items-center gap-4 bg-[#0a1e3f]/30 p-4 rounded-xl border border-[#1e3a8a]">
        <ChartIcon size={32} className="text-[#4ea8de]" />
        <div>
          <h1 className="text-2xl font-black text-[#4ea8de] tracking-widest uppercase shadow-sm">
             AI TREND ANALYSIS
          </h1>
          <p className="text-slate-400 text-xs font-mono tracking-widest mt-1">Deep learning metric processing unit</p>
        </div>
      </header>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
         {servers.map(server => (
           <div key={server} className="bg-[#020b1a] border border-[#1e3a8a] p-4 flex flex-col h-[300px]">
             <h3 className="text-cyan-400 font-bold mb-4 font-mono flex items-center gap-2">
               <Activity size={16}/> {server} 歷史張量追蹤
             </h3>
             <div className="flex-1">
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={getChartData(server)}>
                   <CartesianGrid strokeDasharray="3 3" stroke="#1e3a8a" vertical={false} />
                   <XAxis dataKey="index" hide />
                   <YAxis yAxisId="left" stroke="#06b6d4" fontSize={10} domain={[0, 100]} />
                   <YAxis yAxisId="right" orientation="right" stroke="#ef4444" fontSize={10} domain={[10, 80]} />
                   <Tooltip contentStyle={{ backgroundColor: '#020b1a', borderColor: '#1e3a8a', color: '#fff' }} />
                   <Line yAxisId="left" type="monotone" dataKey="cpu" name="CPU 放行量" stroke="#06b6d4" strokeWidth={2} dot={false} isAnimationActive={false} />
                   <Line yAxisId="right" type="stepAfter" dataKey="temp" name="核心溫度" stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
                 </LineChart>
               </ResponsiveContainer>
             </div>
           </div>
         ))}
      </div>
    </div>
  );
}
