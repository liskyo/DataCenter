"use client";

import { useState, useEffect } from "react";
import { LineChart as ChartIcon, Activity, Search } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ClientOnlyChart } from "@/components/ClientOnlyChart";
import { usePolling } from "@/shared/hooks/usePolling";
import { apiUrl } from "@/shared/api";
import { useLanguage } from "@/shared/i18n/language";

type HistoryData = {
  [server_id: string]: [number, number][]; // [temperature, cpu][]
};

export default function AnalysisPage() {
  const { language } = useLanguage();
  const [history, setHistory] = useState<HistoryData>({});
  const t = language === "en"
    ? {
      title: "AI TREND ANALYSIS",
      subtitle: "Deep learning metric processing unit",
      cardSuffix: "Historical Tensor",
      cpuName: "CPU Usage",
      tempName: "Core Temp",
    }
    : {
      title: "AI 趨勢分析",
      subtitle: "深度學習指標分析模組",
      cardSuffix: "歷史張量追蹤",
      cpuName: "CPU 放行量",
      tempName: "核心溫度",
    };

  usePolling(async () => {
    try {
      const res = await fetch(apiUrl("/history"));
      if (res.ok) {
        const json = await res.json();
        setHistory(json.data);
      }
    } catch (e) { }
  }, { intervalMs: 5000, immediate: true });

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
  
  // 搜尋處理
  const [searchQuery, setSearchQuery] = useState("");
  const filteredServers = servers.filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()));

  // 分頁處理 (避免一次宣染過多圖表造成卡頓)
  const [page, setPage] = useState(0);
  const pageSize = 6;
  const totalPages = Math.ceil(filteredServers.length / pageSize);

  // 當搜尋條件改變時，回到第一頁
  useEffect(() => {
    setPage(0);
  }, [searchQuery]);

  const paginatedServers = filteredServers.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="p-8 pb-20 max-w-7xl mx-auto h-full flex flex-col">
      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#0a1e3f]/30 p-4 rounded-xl border border-[#1e3a8a]">
        <div className="flex items-center gap-4">
            <ChartIcon size={32} className="text-[#4ea8de]" />
            <div>
            <h1 className="text-2xl font-black text-[#4ea8de] tracking-widest uppercase shadow-sm">
                {t.title}
            </h1>
            <p className="text-slate-400 text-xs font-mono tracking-widest mt-1">{t.subtitle}</p>
            </div>
        </div>
        {/* Search & Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 shrink-0">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-700" />
              <input 
                type="text" 
                placeholder="Search server ID..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#020b1a] border border-[#1e3a8a] text-cyan-400 pl-9 pr-4 py-1.5 rounded text-sm focus:outline-none focus:border-cyan-500 transition-colors w-full sm:w-48 placeholder:text-cyan-900" 
              />
            </div>

            {totalPages > 1 && (
                <div className="flex gap-2 text-xs font-mono">
                   <button 
                      disabled={page === 0} 
                      onClick={() => setPage(p => p - 1)}
                      className="px-3 py-1.5 bg-[#020b1a] border border-[#1e3a8a] text-cyan-400 disabled:opacity-30 rounded hover:bg-[#0a1e3f] transition-colors"
                   >
                      PREV
                   </button>
                   <div className="px-3 py-1.5 text-slate-400 flex items-center">
                      PAGE {page + 1} / {totalPages}
                   </div>
                   <button 
                      disabled={page >= totalPages - 1} 
                      onClick={() => setPage(p => p + 1)}
                      className="px-3 py-1.5 bg-[#020b1a] border border-[#1e3a8a] text-cyan-400 disabled:opacity-30 rounded hover:bg-[#0a1e3f] transition-colors"
                   >
                      NEXT
                   </button>
                </div>
            )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {paginatedServers.map(server => {
          const chartData = getChartData(server);
          const needsMoreData = chartData.length < 2;

          return (
          <div key={server} className="bg-[#020b1a] border border-[#1e3a8a] p-4 flex flex-col h-[300px] min-h-0">
            <h3 className="text-cyan-400 font-bold mb-4 font-mono flex items-center gap-2 shrink-0">
              <Activity size={16} /> {server} {t.cardSuffix}
            </h3>
            <div className="flex-1 min-h-0 w-full relative">
              {needsMoreData ? (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-mono text-xs border border-dashed border-[#1e3a8a] bg-[#0a1e3f]/10 rounded">
                   Gathering telemetry data... (Requires at least 2 points)
                </div>
              ) : (
                <ClientOnlyChart placeholderClassName="h-full w-full min-h-[200px]">
                  <div className="h-full w-full min-h-[200px]">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1} initialDimension={{ width: 100, height: 200 }}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e3a8a" vertical={false} />
                        <XAxis dataKey="index" hide />
                        <YAxis yAxisId="left" stroke="#06b6d4" fontSize={10} domain={[0, 100]} />
                        <YAxis yAxisId="right" orientation="right" stroke="#ef4444" fontSize={10} domain={[10, 80]} />
                        <Tooltip contentStyle={{ backgroundColor: '#020b1a', borderColor: '#1e3a8a', color: '#fff' }} />
                        <Line yAxisId="left" type="monotone" dataKey="cpu" name={t.cpuName} stroke="#06b6d4" strokeWidth={2} dot={false} isAnimationActive={false} />
                        <Line yAxisId="right" type="stepAfter" dataKey="temp" name={t.tempName} stroke="#ef4444" strokeWidth={2} dot={false} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </ClientOnlyChart>
              )}
            </div>
          </div>
        )})}
      </div>
    </div>
  );
}
