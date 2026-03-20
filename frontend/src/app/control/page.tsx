"use client";

import { useState } from "react";
import { Power, Fan, Settings2, SlidersHorizontal, RefreshCcw, X, Cpu, Network, ShieldCheck, DatabaseZap } from "lucide-react";

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
      isRebooting: false,
    }))
  );

  const [configuringMachine, setConfiguringMachine] = useState<string | null>(null);

  const togglePower = (id: string) => {
    setMachines(prev => prev.map(m => m.id === id ? { ...m, powerOn: !m.powerOn } : m));
  };

  const changeFanSpeed = (id: string, val: number) => {
    setMachines(prev => prev.map(m => m.id === id ? { ...m, fanSpeed: val } : m));
  };

  const rebootMachine = (id: string) => {
    setMachines(prev => prev.map(m => m.id === id ? { ...m, isRebooting: true, powerOn: false } : m));
    setTimeout(() => {
      setMachines(prev => prev.map(m => m.id === id ? { ...m, powerOn: true } : m));
      setTimeout(() => {
        setMachines(prev => prev.map(m => m.id === id ? { ...m, isRebooting: false } : m));
      }, 500);
    }, 2500);
  };

  return (
    <div className="p-8 pb-20 max-w-7xl mx-auto relative h-full flex flex-col">
      <header className="mb-10 flex flex-col md:flex-row justify-between items-center bg-[#0a1e3f]/30 p-4 rounded-xl border border-[#1e3a8a]">
        <div>
          <h1 className="text-2xl font-black text-[#4ea8de] tracking-widest uppercase shadow-sm">
             Device Control Interface
          </h1>
          <p className="text-slate-400 mt-1 text-xs font-mono tracking-widest">
            遠端終端管理模組 (Remote Terminal Unit Override)
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {machines.map((machine) => (
          <TechPanel key={machine.id} title={machine.id} className="h-fit">
            <div className="space-y-6">
              
              {/* Power Toggle */}
              <div className="flex justify-between items-center bg-[#0a1e3f]/50 p-4 rounded-lg border border-[#1e3a8a]">
                 <div className="flex items-center gap-3">
                   <Power size={20} className={machine.powerOn ? "text-emerald-400" : "text-rose-500"} />
                   <span className="text-slate-200 font-bold uppercase tracking-widest text-sm">Main Power</span>
                 </div>
                 <button 
                   onClick={() => togglePower(machine.id)}
                   disabled={machine.isRebooting}
                   className={`px-4 py-1.5 rounded-md font-bold text-xs tracking-wider border transition-all shadow-[0_0_10px_rgba(0,0,0,0.5)] ${
                     machine.isRebooting 
                       ? "bg-amber-950 border-amber-500 text-amber-400 animate-pulse"
                       : machine.powerOn 
                         ? "bg-[#06183a] border-emerald-500 text-emerald-400 shadow-[inset_0_0_8px_rgba(16,185,129,0.3)] hover:bg-emerald-950" 
                         : "bg-[#06183a] border-rose-500 text-rose-400 shadow-[inset_0_0_8px_rgba(244,63,94,0.3)] hover:bg-rose-950"
                   }`}
                 >
                   {machine.isRebooting ? "REBOOTING" : (machine.powerOn ? "SYS ONLINE" : "OFFLINE")}
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
              <div className={`flex gap-3 pt-4 border-t border-[#1e3a8a] ${!machine.powerOn && !machine.isRebooting ? "opacity-30 pointer-events-none" : "opacity-100"}`}>
                 <button 
                   onClick={() => rebootMachine(machine.id)}
                   disabled={machine.isRebooting}
                   className={`flex-1 flex items-center justify-center gap-2 bg-[#0a1e3f] border border-cyan-800 text-cyan-400 py-2 rounded font-mono text-[10px] tracking-widest transition-colors ${machine.isRebooting ? 'opacity-50 cursor-not-allowed text-amber-500' : 'hover:bg-[#152e5c]'}`}
                 >
                    <RefreshCcw size={12} className={machine.isRebooting ? "animate-spin" : ""} /> 
                    {machine.isRebooting ? "REBOOTING..." : "REBOOT"}
                 </button>
                 <button 
                   onClick={() => setConfiguringMachine(machine.id)}
                   className="flex-1 flex items-center justify-center gap-2 bg-[#0a1e3f] hover:bg-[#152e5c] border border-cyan-800 text-cyan-400 py-2 rounded font-mono text-[10px] tracking-widest transition-colors"
                 >
                    <Settings2 size={12}/> CONFIGURE
                 </button>
              </div>

            </div>
          </TechPanel>
        ))}
      </div>

      {/* Configuration Modal Overlay */}
      {configuringMachine && (
        <div className="fixed top-0 left-0 w-full h-full z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
           <div className="relative w-full max-w-2xl bg-[#020b1a] border border-[#4ea8de] p-8 shadow-[0_0_30px_rgba(6,182,212,0.3)] m-4">
              
              <button 
                onClick={() => setConfiguringMachine(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
              >
                 <X size={24} />
              </button>

              <h2 className="text-2xl font-black text-[#4ea8de] tracking-widest mb-2 flex items-center gap-3">
                 <Cpu size={28}/> 
                 {configuringMachine} ADVANCED SETTINGS
              </h2>
              <p className="text-slate-400 font-mono text-xs tracking-widest mb-8 border-b border-[#1e3a8a] pb-4">
                 Firmware Version: v2.4.1-stable | Uptime: 45 Days, 12 Hrs
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Networking Configurations */}
                 <div className="border border-[#1e3a8a] bg-[#0a1e3f]/20 p-5 rounded">
                    <h3 className="text-cyan-400 font-bold tracking-widest text-sm flex items-center gap-2 mb-4">
                      <Network size={16}/> NETWORK INTERFACE
                    </h3>
                    <div className="space-y-3 font-mono text-xs">
                       <div className="flex justify-between items-center text-slate-300">
                         <span>IPv4 Address</span>
                         <input type="text" className="bg-black border border-cyan-900 px-2 py-1 text-cyan-400 w-32 focus:outline-none" defaultValue={`192.168.1.${parseInt(configuringMachine.split('-')[1], 10) + 10}`} />
                       </div>
                       <div className="flex justify-between items-center text-slate-300">
                         <span>VLAN ID</span>
                         <input type="number" className="bg-black border border-cyan-900 px-2 py-1 text-cyan-400 w-32 focus:outline-none" defaultValue="400" />
                       </div>
                       <div className="flex justify-between items-center text-slate-300 pt-2 border-t border-[#1e3a8a]">
                         <span>MAC Address</span>
                         <span className="text-slate-500">00:1A:2B:3C:{(Math.floor(Math.random()*90)+10).toString(16).toUpperCase()}:EF</span>
                       </div>
                    </div>
                 </div>

                 {/* Security & Kernel Override */}
                 <div className="border border-[#1e3a8a] bg-[#0a1e3f]/20 p-5 rounded flex flex-col justify-between">
                    <div>
                      <h3 className="text-emerald-400 font-bold tracking-widest text-sm flex items-center gap-2 mb-4">
                        <ShieldCheck size={16}/> SECURITY & POLICIES
                      </h3>
                      <label className="flex items-center gap-3 cursor-pointer group mb-3">
                         <div className="relative">
                           <input type="checkbox" className="sr-only peer" defaultChecked />
                           <div className="w-10 h-5 bg-slate-800 rounded-full peer peer-checked:bg-emerald-500 transition-colors"></div>
                           <div className="absolute left-[2px] top-[2px] w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-[20px]"></div>
                         </div>
                         <span className="text-slate-300 text-xs font-mono font-bold group-hover:text-white transition-colors">Auto-Scaling Fan Policy</span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer group">
                         <div className="relative">
                           <input type="checkbox" className="sr-only peer" />
                           <div className="w-10 h-5 bg-slate-800 rounded-full peer peer-checked:bg-rose-500 transition-colors"></div>
                           <div className="absolute left-[2px] top-[2px] w-4 h-4 bg-white rounded-full transition-all peer-checked:translate-x-[20px]"></div>
                         </div>
                         <span className="text-rose-500 text-xs font-mono font-bold group-hover:text-white transition-colors">Kernel Memory Dump Override</span>
                      </label>
                    </div>

                    <button className="w-full mt-6 flex items-center justify-center gap-2 bg-[#06183a] border border-emerald-800 text-emerald-400 py-2 font-mono text-xs tracking-widest hover:bg-emerald-950 transition-colors">
                       <DatabaseZap size={14}/> APPLY CHANGES
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
