"use client";

import { useState, useEffect } from "react";
import { 
  ThermometerSun, Droplets, Wind, Zap, Activity, ShieldAlert, DoorOpen, 
  Video, BatteryWarning, Factory, Leaf, Waves, Power, Settings2
} from "lucide-react";
import { useLanguage } from "@/shared/i18n/language";

const KPIWidget = ({ label, value, unit, trend, icon: Icon, colorClass }: any) => (
  <div className={`border border-[#1e3a8a] bg-[#020b1a] relative overflow-hidden p-6 shadow-[0_0_15px_rgba(0,0,0,0.5)]`}>
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
  <h2 className="text-lg font-black text-[#4ea8de] tracking-widest uppercase flex items-center gap-3 mb-6 border-b border-[#1e3a8a] pb-2">
    <Icon size={20} /> {title}
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
  });

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
    <div className="p-8 pb-20 max-w-7xl mx-auto flex flex-col h-full gap-8">
      <header className="flex flex-col md:flex-row justify-between items-center bg-[#0a1e3f]/30 p-6 rounded-xl border border-[#1e3a8a]">
        <div>
          <h1 className="text-3xl font-black text-[#4ea8de] tracking-widest uppercase drop-shadow-[0_0_8px_rgba(78,168,222,0.8)] flex items-center gap-4">
             <Factory size={36} className="text-emerald-400" />
             {t.title}
          </h1>
          <p className="text-slate-400 mt-2 text-xs font-mono tracking-widest">
            {t.subtitle}
          </p>
        </div>
      </header>

      {/* KPIs & Sustainability */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPIWidget label={"PUE (電力使用效率)"} value={data.pue} unit={"RATIO"} trend={"-0.02"} icon={Zap} colorClass="text-emerald-400" />
        <KPIWidget label={"WUE (用水使用效率)"} value={data.wue} unit={"L/kWh"} trend={"+0.01"} icon={Waves} colorClass="text-cyan-400" />
        <KPIWidget label={"ERF (能源再利用率)"} value={data.erf} unit={"% RECYCLED"} trend={"+2.5%"} icon={Leaf} colorClass="text-green-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Environmental Monitoring */}
        <div className="bg-[#020b1a] border border-[#1e3a8a] p-6 shadow-lg">
           <SectionTitle title="Environmental (環境監控)" icon={Activity} />
           <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0a1e3f]/40 p-4 border border-[#1e3a8a] rounded">
                 <div className="text-cyan-500 text-[10px] font-bold tracking-widest mb-1"><ThermometerSun size={12} className="inline mr-1"/> RACK-INLET TEMP</div>
                 <div className="text-2xl font-mono text-white">{data.temp} <span className="text-sm text-slate-500">°C</span></div>
              </div>
              <div className="bg-[#0a1e3f]/40 p-4 border border-[#1e3a8a] rounded">
                 <div className="text-cyan-500 text-[10px] font-bold tracking-widest mb-1"><Droplets size={12} className="inline mr-1"/> HUMIDITY</div>
                 <div className="text-2xl font-mono text-white">{data.humidity} <span className="text-sm text-slate-500">%RH</span></div>
              </div>
              <div className="bg-[#0a1e3f]/40 p-4 border border-[#1e3a8a] rounded">
                 <div className="text-cyan-500 text-[10px] font-bold tracking-widest mb-1"><Wind size={12} className="inline mr-1"/> AIR DIFF PRESSURE (ΔP)</div>
                 <div className="text-2xl font-mono text-white">{data.pressure} <span className="text-sm text-slate-500">iwg</span></div>
                 <div className="w-full bg-slate-800 h-1 mt-2 rounded overflow-hidden">
                    <div className="bg-emerald-500 h-full w-[80%]"></div>
                 </div>
              </div>
              <div className={`p-4 border rounded ${data.leak ? 'bg-rose-950 border-rose-600' : 'bg-[#0a1e3f]/40 border-[#1e3a8a]'}`}>
                 <div className={`text-[10px] font-bold tracking-widest mb-1 ${data.leak ? 'text-rose-400' : 'text-emerald-500'}`}><ShieldAlert size={12} className="inline mr-1"/> LEAK DETECTION</div>
                 <div className={`text-xl font-mono ${data.leak ? 'text-rose-400' : 'text-emerald-400'}`}>{data.leak ? "DETECTED" : "CLEAR"}</div>
              </div>
           </div>
        </div>

        {/* Power Infrastructure */}
        <div className="bg-[#020b1a] border border-[#1e3a8a] p-6 shadow-lg">
           <SectionTitle title="Power Infrastructure (電力鏈)" icon={Power} />
           <div className="space-y-6">
              <div>
                <div className="flex justify-between text-xs font-bold tracking-widest text-slate-300 mb-2">
                  <span className="flex items-center gap-2"><BatteryWarning size={14} className="text-amber-500"/> TOTAL UPS LOAD</span>
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
                    <div className="text-slate-500 mb-1">Floor PDU-A</div>
                    <div className="text-emerald-400">400 kW</div>
                 </div>
                 <div className="bg-[#0a1e3f]/40 border border-[#1e3a8a] p-2 rounded">
                    <div className="text-slate-500 mb-1">Floor PDU-B</div>
                    <div className="text-emerald-400">410 kW</div>
                 </div>
                 <div className="bg-[#0a1e3f]/40 border border-[#1e3a8a] p-2 rounded">
                    <div className="text-slate-500 mb-1">UPS Battery</div>
                    <div className="text-emerald-400">100% (Float)</div>
                 </div>
              </div>
           </div>
        </div>

        {/* Cooling & Thermal */}
        <div className="bg-[#020b1a] border border-[#1e3a8a] p-6 shadow-lg">
           <SectionTitle title="Thermal Management (冷卻系統)" icon={ThermometerSun} />
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                 <div className="text-cyan-500 text-[10px] font-bold tracking-widest">CHILLER PUMP SPEED</div>
                 <div className="text-xl font-mono text-white flex items-end gap-2">
                    {data.chillerSpeed} <span className="text-xs text-slate-500 mb-1">Hz</span>
                 </div>
              </div>
              <div className="space-y-1">
                 <div className="text-cyan-500 text-[10px] font-bold tracking-widest">SECONDARY FLOW RATE</div>
                 <div className="text-xl font-mono text-white flex items-end gap-2">
                    125.4 <span className="text-xs text-slate-500 mb-1">GPM</span>
                 </div>
              </div>
              <div className="col-span-2 mt-4">
                 <div className="flex justify-between items-center text-xs font-mono text-slate-400 mb-2">
                    <span>Supply Return (Delta-T)</span>
                    <span className="text-amber-400">Δ 12°C</span>
                 </div>
                 <div className="flex items-center gap-2 h-8">
                    <div className="bg-cyan-600 h-full flex-1 rounded flex items-center justify-center text-xs font-bold font-mono">10°C (SUPPLY)</div>
                    <div className="bg-rose-900 h-full flex-1 rounded flex items-center justify-center text-xs font-bold font-mono text-rose-300">22°C (RETURN)</div>
                 </div>
              </div>
           </div>
        </div>

        {/* Physical Security */}
        <div className="bg-[#020b1a] border border-[#1e3a8a] p-6 shadow-lg">
           <SectionTitle title="Physical Context (實體安全)" icon={ShieldAlert} />
           <div className="grid grid-cols-2 gap-4">
              <div className="border border-[#1e3a8a] bg-black relative aspect-video flex items-center justify-center overflow-hidden rounded">
                 <div className="absolute top-2 left-2 flex items-center gap-1 text-[8px] font-mono text-rose-500">
                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div> REC
                 </div>
                 <span className="text-slate-800 font-black tracking-widest opacity-50 flex items-center gap-2"><Video/> CCTV-01 (ZONE-A)</span>
              </div>
              <div className="space-y-2">
                 <div className="flex justify-between bg-[#0a1e3f]/40 border border-[#1e3a8a] p-2 text-xs font-mono rounded items-center">
                    <span className="flex items-center gap-2 text-slate-300"><DoorOpen size={14}/> Main Gate</span>
                    <span className="text-emerald-500">SECURED</span>
                 </div>
                 <div className="flex justify-between bg-[#0a1e3f]/40 border border-[#1e3a8a] p-2 text-xs font-mono rounded items-center">
                    <span className="flex items-center gap-2 text-slate-300"><Settings2 size={14}/> Rack R-04 Door</span>
                    <span className="text-rose-400 animate-pulse">OPEN</span>
                 </div>
                 <div className="flex justify-between bg-[#0a1e3f]/40 border border-[#1e3a8a] p-2 text-xs font-mono rounded items-center">
                    <span className="flex items-center gap-2 text-slate-300"><Activity size={14}/> Motion Sensor</span>
                    <span className="text-emerald-500">CLEAR</span>
                 </div>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
}
