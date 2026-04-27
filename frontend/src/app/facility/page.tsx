"use client";

import { useState, useEffect } from "react";
import { 
  ThermometerSun, Droplets, Wind, Zap, Activity, ShieldAlert, DoorOpen, 
  Video, BatteryWarning, Factory, Leaf, Waves, Power, Settings2,
  Flame, Siren, Fuel, Server, Gauge, Box, ArrowDownUp
} from "lucide-react";
import { useLanguage } from "@/shared/i18n/language";
import { useDcimStore } from "@/store/useDcimStore";

const KPIWidget = ({ label, value, unit, trend, icon: Icon, colorClass }: any) => (
  <div className={`border border-[#1e3a8a] bg-[#020b1a] relative overflow-hidden p-4 shadow-[0_0_15px_rgba(0,0,0,0.5)]`}>
    <div className={`absolute -right-6 -top-6 opacity-5 ${colorClass}`}>
      <Icon size={120} />
    </div>
    <div className={`flex items-center gap-3 mb-2 ${colorClass}`}>
      <Icon size={20} />
      <h3 className="font-bold tracking-widest text-xs uppercase">{label}</h3>
    </div>
    <div className="flex items-end gap-2">
      <span className={`text-4xl font-extrabold ${colorClass} drop-shadow-[0_0_8px_currentColor]`}>{value}</span>
      <span className="text-slate-500 font-mono text-sm mb-1">{unit}</span>
    </div>
    <p className="text-[10px] text-slate-400 mt-3 font-mono border-t border-[#1e3a8a] pt-2">
      {trend} vs Last 24h
    </p>
  </div>
);

const SectionTitle = ({ title, icon: Icon }: any) => (
  <h2 className="text-sm lg:text-base font-black text-[#4ea8de] tracking-widest uppercase flex items-center gap-3 mb-4 border-b border-[#1e3a8a] pb-2">
    <Icon size={18} /> {title}
  </h2>
);

export default function FacilityPage() {
  const { language } = useLanguage();
  const t = language === "en"
    ? {
      title: "Gray Space Facility",
      subtitle: "DCIM Power & Environmental Context",
    }
    : {
      title: "廠務監控中心",
      subtitle: "廠務端基礎設施管理",
    };
  const [data, setData] = useState({
    pue: 1.18,
    wue: 0.45,
    erf: 22,
    temp: 23.4,
    humidity: 45,
    pressure: 0.05,
    leak: false,
    powerLoad: 78,
    chillerSpeed: 85,
    cduPressure: 2.1,
    fuelLevel: 92,
    spaceUsed: 38,
    spaceTotal: 42,
  });

  const store = useDcimStore();
  const totalCarbon = store.racks.reduce((acc, rack) => {
    return acc + rack.servers.reduce((sum, srv) => sum + (srv.carbonEmission || 0), 0);
  }, 0);

  // 模擬資料跳動
  useEffect(() => {
    const timer = setInterval(() => {
      setData(prev => ({
        ...prev,
        temp: +(23 + Math.random()).toFixed(1),
        powerLoad: +(78 + (Math.random() * 2 - 1)).toFixed(1),
        pue: +(1.18 + (Math.random() * 0.02 - 0.01)).toFixed(3),
      }));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="p-4 w-full mx-auto flex flex-col h-full gap-4">
      <header className="flex flex-col md:flex-row justify-between items-center bg-[#0a1e3f]/30 p-4 rounded-xl border border-[#1e3a8a]">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black text-[#4ea8de] tracking-widest uppercase drop-shadow-[0_0_8px_rgba(78,168,222,0.8)] flex items-center gap-4">
             <Factory size={36} className="text-emerald-400" />
             {t.title}
          </h1>
          <p className="text-slate-400 mt-2 text-xs font-mono tracking-widest">
            {t.subtitle}
          </p>
        </div>
      </header>

      {/* KPIs & Sustainability */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPIWidget label={"PUE (電力使用效率)"} value={data.pue} unit={"RATIO"} trend={"-0.02"} icon={Zap} colorClass="text-emerald-400" />
        <KPIWidget label={"WUE (用水使用效率)"} value={data.wue} unit={"L/kWh"} trend={"+0.01"} icon={Waves} colorClass="text-cyan-400" />
        <KPIWidget label={"ERF (能源再利用率)"} value={data.erf} unit={"% RECYCLED"} trend={"+2.5%"} icon={Leaf} colorClass="text-green-500" />
        <KPIWidget label={"CARBON (碳排放量)"} value={totalCarbon > 0 ? totalCarbon.toFixed(0) : "0"} unit={"kg CO2e"} trend={"0"} icon={Factory} colorClass="text-purple-400" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1">
        {/* Environmental Monitoring */}
        <div className="bg-[#020b1a] border border-[#1e3a8a] p-4 shadow-lg flex flex-col">
           <SectionTitle title="Environmental (環境監控)" icon={Activity} />
           <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0a1e3f]/40 p-4 border border-[#1e3a8a] rounded">
                 <div className="text-cyan-500 text-[10px] font-bold tracking-widest mb-1"><ThermometerSun size={12} className="inline mr-1"/> RACK-INLET TEMP (機櫃進風溫度)</div>
                 <div className="text-2xl font-mono text-white">{data.temp} <span className="text-sm text-slate-500">°C</span></div>
              </div>
              <div className="bg-[#0a1e3f]/40 p-4 border border-[#1e3a8a] rounded">
                 <div className="text-cyan-500 text-[10px] font-bold tracking-widest mb-1"><Droplets size={12} className="inline mr-1"/> HUMIDITY (相對濕度)</div>
                 <div className="text-2xl font-mono text-white">{data.humidity} <span className="text-sm text-slate-500">%RH</span></div>
              </div>
              <div className="bg-[#0a1e3f]/40 p-4 border border-[#1e3a8a] rounded">
                 <div className="text-cyan-500 text-[10px] font-bold tracking-widest mb-1"><Wind size={12} className="inline mr-1"/> AIR DIFF PRESSURE (空調微差壓)</div>
                 <div className="text-2xl font-mono text-white">{data.pressure} <span className="text-sm text-slate-500">iwg</span></div>
                 <div className="w-full bg-slate-800 h-1 mt-2 rounded overflow-hidden">
                    <div className="bg-emerald-500 h-full w-[80%]"></div>
                 </div>
              </div>
              <div className={`p-4 border rounded ${data.leak ? 'bg-rose-950 border-rose-600' : 'bg-[#0a1e3f]/40 border-[#1e3a8a]'}`}>
                 <div className={`text-[10px] font-bold tracking-widest mb-1 ${data.leak ? 'text-rose-400' : 'text-emerald-500'}`}><ShieldAlert size={12} className="inline mr-1"/> LEAK DETECTION (漏液偵測)</div>
                 <div className={`text-xl font-mono ${data.leak ? 'text-rose-400' : 'text-emerald-400'}`}>{data.leak ? "DETECTED" : "CLEAR"}</div>
              </div>
           </div>
        </div>

        {/* Power Infrastructure */}
        <div className="bg-[#020b1a] border border-[#1e3a8a] p-4 shadow-lg flex flex-col">
           <SectionTitle title="Power Infrastructure (電力鏈)" icon={Power} />
           <div className="space-y-6">
              <div>
                <div className="flex justify-between text-xs font-bold tracking-widest text-slate-300 mb-2">
                  <span className="flex items-center gap-2"><BatteryWarning size={14} className="text-amber-500"/> TOTAL UPS LOAD (不斷電系統總負載)</span>
                  <span className="font-mono text-amber-400">{data.powerLoad}% ( 1.2 MW )</span>
                </div>
                <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-700">
                  <div className="bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 h-full relative" style={{ width: `${data.powerLoad}%` }}>
                     <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/50 animate-pulse"></div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                 <div className="bg-[#0a1e3f]/40 border border-[#1e3a8a] p-2 rounded">
                    <div className="text-slate-500 mb-1">Floor PDU-A (列頭櫃)</div>
                    <div className="text-emerald-400">400 kW</div>
                 </div>
                 <div className="bg-[#0a1e3f]/40 border border-[#1e3a8a] p-2 rounded">
                    <div className="text-slate-500 mb-1">Floor PDU-B (列頭櫃)</div>
                    <div className="text-emerald-400">410 kW</div>
                 </div>
                 <div className="bg-[#0a1e3f]/40 border border-[#1e3a8a] p-2 rounded">
                    <div className="text-slate-500 mb-1">UPS Battery (電池電量)</div>
                    <div className="text-emerald-400">100% (Float)</div>
                 </div>
              </div>
           </div>
        </div>

        {/* Cooling & Thermal */}
        <div className="bg-[#020b1a] border border-[#1e3a8a] p-4 shadow-lg flex flex-col">
           <SectionTitle title="Thermal Management (冷卻系統)" icon={ThermometerSun} />
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                 <div className="text-cyan-500 text-[10px] font-bold tracking-widest">CHILLER PUMP SPEED (冰水泵轉速)</div>
                 <div className="text-xl font-mono text-white flex items-end gap-2">
                    {data.chillerSpeed} <span className="text-xs text-slate-500 mb-1">Hz</span>
                 </div>
              </div>
              <div className="space-y-1">
                 <div className="text-cyan-500 text-[10px] font-bold tracking-widest">SECONDARY FLOW RATE (二次側流量)</div>
                 <div className="text-xl font-mono text-white flex items-end gap-2">
                    125.4 <span className="text-xs text-slate-500 mb-1">GPM</span>
                 </div>
              </div>
              <div className="col-span-2 mt-4">
                 <div className="flex justify-between items-center text-xs font-mono text-slate-400 mb-2">
                    <span>Supply Return Delta-T (供回水溫差)</span>
                    <span className="text-amber-400">Δ 12°C</span>
                 </div>
                 <div className="flex items-center gap-2 h-8">
                    <div className="bg-cyan-600 h-full flex-1 rounded flex items-center justify-center text-xs font-bold font-mono">10°C (SUPPLY)</div>
                    <div className="bg-rose-900 h-full flex-1 rounded flex items-center justify-center text-xs font-bold font-mono text-rose-300">22°C (RETURN)</div>
                 </div>
              </div>
           </div>
        </div>

        {/* Fire & Life Safety */}
        <div className="bg-[#020b1a] border border-[#1e3a8a] p-4 shadow-lg flex flex-col">
           <SectionTitle title="Fire & Life Safety (消防與工安安全)" icon={Flame} />
           <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0a1e3f]/40 p-4 border border-[#1e3a8a] rounded">
                 <div className="text-cyan-500 text-[10px] font-bold tracking-widest mb-1">VESDA (極早期煙霧預警)</div>
                 <div className="text-xl font-mono text-emerald-400 flex items-center gap-2"><Activity size={16}/> NORMAL</div>
              </div>
              <div className="bg-[#0a1e3f]/40 p-4 border border-[#1e3a8a] rounded">
                 <div className="text-cyan-500 text-[10px] font-bold tracking-widest mb-1">FM200 GAS (氣體滅火壓力)</div>
                 <div className="text-xl font-mono text-white">360 <span className="text-sm text-slate-500">psi</span></div>
              </div>
              <div className="col-span-2 flex justify-between bg-[#0a1e3f]/40 border border-[#1e3a8a] p-3 text-xs font-mono rounded items-center">
                 <span className="flex items-center gap-2 text-slate-300"><Siren size={14}/> EPO (緊急斷電開關)</span>
                 <span className="text-emerald-500">ARMED (未觸發)</span>
              </div>
           </div>
        </div>

        {/* Backup Power System */}
        <div className="bg-[#020b1a] border border-[#1e3a8a] p-4 shadow-lg flex flex-col">
           <SectionTitle title="Backup Power (備援發電系統)" icon={Zap} />
           <div className="space-y-4">
              <div className="flex justify-between bg-[#0a1e3f]/40 border border-[#1e3a8a] p-3 text-xs font-mono rounded items-center">
                 <span className="flex items-center gap-2 text-slate-300"><ArrowDownUp size={14}/> ATS (自動切換開關)</span>
                 <span className="text-emerald-500">UTILITY-A (市電供電)</span>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold tracking-widest text-slate-300 mb-2">
                  <span className="flex items-center gap-2"><Fuel size={14} className="text-cyan-500"/> DIESEL TANK (柴油發電機油槽)</span>
                  <span className="font-mono text-cyan-400">{data.fuelLevel}% ( ~48 hrs )</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700">
                  <div className="bg-cyan-500 h-full" style={{ width: `${data.fuelLevel}%` }}></div>
                </div>
              </div>
           </div>
        </div>

        {/* Advanced Cooling & CDU */}
        <div className="bg-[#020b1a] border border-[#1e3a8a] p-4 shadow-lg flex flex-col">
           <SectionTitle title="Advanced Cooling (進階水冷與 CDU)" icon={Waves} />
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                 <div className="text-cyan-500 text-[10px] font-bold tracking-widest">CDU SYSTEM PRESSURE (系統水壓)</div>
                 <div className="text-xl font-mono text-white flex items-end gap-2">
                    {data.cduPressure} <span className="text-xs text-slate-500 mb-1">Bar</span>
                 </div>
              </div>
              <div className="space-y-1">
                 <div className="text-cyan-500 text-[10px] font-bold tracking-widest">FILTER STATUS (冷卻水濾網)</div>
                 <div className="text-xl font-mono text-emerald-400 flex items-center gap-2">
                    CLEAN
                 </div>
              </div>
              <div className="col-span-2 flex justify-between bg-[#0a1e3f]/40 border border-[#1e3a8a] p-3 text-xs font-mono rounded items-center mt-2">
                 <span className="flex items-center gap-2 text-slate-300"><Droplets size={14}/> Make-up Water Level (補水槽水位)</span>
                 <span className="text-cyan-400">NORMAL</span>
              </div>
           </div>
        </div>

        {/* Capacity Planning */}
        <div className="bg-[#020b1a] border border-[#1e3a8a] p-4 shadow-lg flex flex-col">
           <SectionTitle title="Capacity Planning (資源容量管理)" icon={Box} />
           <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold tracking-widest text-slate-300 mb-2">
                  <span className="flex items-center gap-2"><Server size={14} className="text-purple-500"/> RACK SPACE (機櫃 U 數使用率)</span>
                  <span className="font-mono text-purple-400">{data.spaceUsed} / {data.spaceTotal} Racks</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700">
                  <div className="bg-purple-500 h-full" style={{ width: `${(data.spaceUsed / data.spaceTotal) * 100}%` }}></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold tracking-widest text-slate-300 mb-2">
                  <span className="flex items-center gap-2"><Power size={14} className="text-amber-500"/> POWER CAPACITY (可用電力裕度)</span>
                  <span className="font-mono text-amber-400">85% ( 300 kW remaining )</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden border border-slate-700">
                  <div className="bg-amber-500 h-full" style={{ width: `85%` }}></div>
                </div>
              </div>
           </div>
        </div>
        {/* Physical Security */}
        <div className="bg-[#020b1a] border border-[#1e3a8a] p-4 shadow-lg flex flex-col">
           <SectionTitle title="Physical Context (實體安全)" icon={ShieldAlert} />
           <div className="grid grid-cols-2 gap-4">
              <div className="border border-[#1e3a8a] bg-black relative aspect-video flex items-center justify-center overflow-hidden rounded">
                 <div className="absolute top-2 left-2 flex items-center gap-1 text-[8px] font-mono text-rose-500">
                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div> REC
                 </div>
                 <span className="text-slate-800 font-black tracking-widest opacity-50 flex items-center gap-2"><Video/> CCTV-01 (監視器)</span>
              </div>
              <div className="space-y-2">
                 <div className="flex justify-between bg-[#0a1e3f]/40 border border-[#1e3a8a] p-2 text-xs font-mono rounded items-center">
                    <span className="flex items-center gap-2 text-slate-300"><DoorOpen size={14}/> Main Gate (主大門)</span>
                    <span className="text-emerald-500">SECURED</span>
                 </div>
                 <div className="flex justify-between bg-[#0a1e3f]/40 border border-[#1e3a8a] p-2 text-xs font-mono rounded items-center">
                    <span className="flex items-center gap-2 text-slate-300"><Settings2 size={14}/> Rack R-04 Door (機櫃門)</span>
                    <span className="text-rose-400 animate-pulse">OPEN</span>
                 </div>
                 <div className="flex justify-between bg-[#0a1e3f]/40 border border-[#1e3a8a] p-2 text-xs font-mono rounded items-center">
                    <span className="flex items-center gap-2 text-slate-300"><Activity size={14}/> Motion Sensor (動靜感測器)</span>
                    <span className="text-emerald-500">CLEAR</span>
                 </div>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
