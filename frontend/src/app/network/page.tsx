"use client";

import { Globe, Server, Activity, ShieldAlert } from "lucide-react";

export default function NetworkPage() {
  return (
    <div className="p-8 pb-20 max-w-7xl mx-auto">
      <header className="mb-6 flex items-center gap-4 bg-[#0a1e3f]/30 p-4 rounded-xl border border-[#1e3a8a]">
        <Globe size={32} className="text-[#4ea8de]" />
        <div>
          <h1 className="text-2xl font-black text-[#4ea8de] tracking-widest uppercase shadow-sm">
             NETWORK TOPOLOGY
          </h1>
          <p className="text-slate-400 text-xs font-mono tracking-widest mt-1">Data routing and interconnect latency</p>
        </div>
      </header>

      <div className="bg-[#020b1a] border border-[#1e3a8a] aspect-[21/9] w-full relative flex items-center justify-center overflow-hidden">
         {/* 背景網格 */}
         <div className="absolute inset-0 bg-[linear-gradient(rgba(30,58,138,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(30,58,138,0.2)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
         
         <div className="relative z-10 flex flex-col items-center">
             <div className="w-16 h-16 rounded border-2 border-cyan-500 bg-cyan-950/80 flex items-center justify-center animate-pulse shadow-[0_0_20px_rgba(6,182,212,0.5)]">
               <Globe className="text-cyan-400" size={32} />
             </div>
             <span className="mt-2 text-cyan-400 font-bold tracking-widest text-sm">EXTERNAL ISP</span>
             
             {/* 垂直連線 */}
             <div className="h-16 w-1 bg-gradient-to-b from-cyan-500 to-emerald-500"></div>
             
             <div className="w-20 h-16 rounded border-2 border-emerald-500 bg-emerald-950/80 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.3)]">
               <ShieldAlert className="text-emerald-400" size={32} />
             </div>
             <span className="mt-2 text-emerald-400 font-bold tracking-widest text-sm">MAIN FIREWALL</span>

             {/* 垂直連線與分支 */}
             <div className="h-10 w-1 bg-emerald-500"></div>
             <div className="w-[600px] h-1 bg-emerald-500"></div>
             <div className="flex justify-between w-[600px]">
                <div className="w-1 h-10 bg-emerald-500"></div>
                <div className="w-1 h-10 bg-emerald-500"></div>
                <div className="w-1 h-10 bg-emerald-500"></div>
             </div>

             <div className="flex justify-between w-[640px]">
                 <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded border-2 border-slate-500 bg-slate-900 flex items-center justify-center"><Server className="text-slate-400" size={24}/></div>
                    <span className="mt-2 text-slate-400 font-mono text-[10px]">AZURE CLUSTER</span>
                 </div>
                 <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded border-2 border-cyan-500 bg-cyan-900 flex items-center justify-center"><Activity className="text-cyan-400" size={24}/></div>
                    <span className="mt-2 text-cyan-400 font-mono text-[10px]">LOCAL KAFKA</span>
                 </div>
                 <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded border-2 border-slate-500 bg-slate-900 flex items-center justify-center"><Server className="text-slate-400" size={24}/></div>
                    <span className="mt-2 text-slate-400 font-mono text-[10px]">BACKUP NAS</span>
                 </div>
             </div>
         </div>
      </div>
    </div>
  );
}
