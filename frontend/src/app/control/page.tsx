"use client";

import { useState } from "react";
import { Power, Fan, ThermometerSnowflake, Settings2, SlidersHorizontal, RefreshCcw } from "lucide-react";

const TechPanel = ({ title, children, className = "" }: { title: string, children: React.ReactNode, className?: string }) => (
  <div className={`relative bg-[#020b1a] border border-[#1e3a8a] flex flex-col ${className}`}>
    <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#4ea8de]"></div>
    <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#4ea8de]"></div>
    <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#4ea8de]"></div>
    <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#4ea8de]"></div>
    <div className="px-4 py-2 border-b border-[#1e3a8a] bg-gradient-to-r from-[#0a1e3f] to-transparent">
      <h3 className="text-[#4ea8de] font-bold text-sm tracking-widest flex items-center gap-2">
        <SlidersHorizontal size={16} />
        {title}
      </h3>
    </div>
    <div className="flex-1 p-6 relative">
      {children}
    </div>
  </div>
);

export default function ControlPage() {
  const [machines, setMachines] = useState(
    Array.from({ length: 6 }).map((_, i) => ({
      id: `SERVER-${String(i+1).padStart(3, '0')}`,
      powerOn: true,
      fanSpeed: 60,
      targetTemp: 22,
    }))
  );

  const togglePower = (id: string) => {
    setMachines(prev => prev.map(m => m.id === id ? { ...m, powerOn: !m.powerOn } : m));
  };

  const changeFanSpeed = (id: string, val: number) => {
    setMachines(prev => prev.map(m => m.id === id ? { ...m, fanSpeed: val } : m));
  };

  return (
    <div className="p-8 pb-20 max-w-7xl mx-auto">
      <header className="mb-10 flex flex-col md:flex-row justify-between items-center bg-white/5 p-6 rounded-2xl backdrop-blur-md border border-white/10">
        <div>
          <h1 className="text-4xl font-extrabold text-[#4ea8de] tracking-tight uppercase drop-shadow-[0_0_8px_rgba(78,168,222,0.8)]">
             Device Control Interface
          </h1>
          <p className="text-slate-400 mt-2 text-sm font-medium tracking-wide">
            遠端終端管理模組 (Remote Terminal Unit Override)
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        {machines.map((machine) => (
          <TechPanel key={machine.id} title={machine.id} className="h-auto">
            <div className="space-y-6">
              
              {/* Power Toggle */}
              <div className="flex justify-between items-center bg-[#0a1e3f]/50 p-4 rounded-lg border border-[#1e3a8a]">
                 <div className="flex items-center gap-3">
                   <Power size={20} className={machine.powerOn ? "text-emerald-400" : "text-rose-500"} />
                   <span className="text-slate-200 font-bold uppercase tracking-widest text-sm">Main Power</span>
                 </div>
                 <button 
                   onClick={() => togglePower(machine.id)}
                   className={`px-4 py-1.5 rounded-md font-bold text-xs tracking-wider border transition-all shadow-[0_0_10px_rgba(0,0,0,0.5)] ${
                     machine.powerOn 
                       ? "bg-[#06183a] border-emerald-500 text-emerald-400 shadow-[inset_0_0_8px_rgba(16,185,129,0.3)] hover:bg-emerald-950" 
                       : "bg-[#06183a] border-rose-500 text-rose-400 shadow-[inset_0_0_8px_rgba(244,63,94,0.3)] hover:bg-rose-950"
                   }`}
                 >
                   {machine.powerOn ? "SYS ONLINE" : "OFFLINE"}
                 </button>
              </div>

              {/* Fan Slider */}
              <div className={`transition-opacity ${!machine.powerOn ? "opacity-30 pointer-events-none" : "opacity-100"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-cyan-500 text-xs font-bold tracking-widest"><Fan size={14}/> HVAC SPEED</div>
                  <span className="text-cyan-300 font-mono text-sm">{machine.fanSpeed} RPM%</span>
                </div>
                <input 
                  type="range" min="0" max="100" 
                  value={machine.fanSpeed}
                  onChange={(e) => changeFanSpeed(machine.id, Number(e.target.value))}
                  className="w-full h-2 bg-[#0a1e3f] rounded-lg appearance-none cursor-pointer accent-[#4ea8de]"
                />
              </div>

              {/* Action Buttons */}
              <div className={`flex gap-3 pt-4 border-t border-[#1e3a8a] ${!machine.powerOn ? "opacity-30 pointer-events-none" : "opacity-100"}`}>
                 <button className="flex-1 flex items-center justify-center gap-2 bg-[#0a1e3f] hover:bg-[#152e5c] border border-cyan-800 text-cyan-400 py-2 rounded font-mono text-[10px] tracking-widest transition-colors">
                    <RefreshCcw size={12}/> REBOOT
                 </button>
                 <button className="flex-1 flex items-center justify-center gap-2 bg-[#0a1e3f] hover:bg-[#152e5c] border border-cyan-800 text-cyan-400 py-2 rounded font-mono text-[10px] tracking-widest transition-colors">
                    <Settings2 size={12}/> CONFIGURE
                 </button>
              </div>

            </div>
          </TechPanel>
        ))}
      </div>
    </div>
  );
}
