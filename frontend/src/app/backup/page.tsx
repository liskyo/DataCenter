"use client";

import { CloudDownload, Database, HardDrive, RefreshCw } from "lucide-react";

export default function BackupPage() {
  const backups = [
    { name: "InfluxDB TimeSeries Snapshot", size: "45.2 GB", last: "2 hours ago", status: "SYNCED" },
    { name: "MongoDB Active State Dump", size: "1.2 GB", last: "10 mins ago", status: "SYNCING" },
    { name: "Kafka Log Retention Archive", size: "120.5 GB", last: "1 day ago", status: "SYNCED" },
  ];

  return (
    <div className="p-8 pb-20 max-w-7xl mx-auto">
      <header className="mb-6 flex items-center gap-4 bg-[#0a1e3f]/30 p-4 rounded-xl border border-[#1e3a8a]">
        <CloudDownload size={32} className="text-[#4ea8de]" />
        <div>
          <h1 className="text-2xl font-black text-[#4ea8de] tracking-widest uppercase shadow-sm">
             SYSTEM BACKUP & RECOVERY
          </h1>
          <p className="text-slate-400 text-xs font-mono tracking-widest mt-1">Disaster Recovery (DR) synchronization</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { icon: Database, label: "Cloud Sync Status", value: "ACTIVE", color: "text-emerald-400" },
          { icon: HardDrive, label: "Local Free Space", value: "3.2 TB", color: "text-cyan-400" },
          { icon: RefreshCw, label: "Next Global Snapshot", value: "02:45:00", color: "text-amber-400" },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
             <div key={i} className="bg-[#020b1a] border border-[#1e3a8a] p-6 flex flex-col items-center justify-center gap-4">
               <Icon size={32} className={stat.color} />
               <div className="text-center">
                 <div className={`text-2xl font-black font-mono tracking-wider ${stat.color}`}>{stat.value}</div>
                 <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">{stat.label}</div>
               </div>
             </div>
          );
        })}
      </div>

      <div className="bg-[#020b1a] border border-[#1e3a8a]">
         <div className="border-b border-[#1e3a8a] p-4 bg-[#0a1e3f]/30">
           <h3 className="text-cyan-400 font-bold tracking-widest text-sm">ACTIVE REPLICATION TASKS</h3>
         </div>
         <div className="p-0">
           {backups.map((task, i) => (
             <div key={i} className="flex justify-between items-center p-4 border-b border-[#1e3a8a] hover:bg-[#152e5c]/50 transition-colors">
                <div>
                   <div className="text-slate-200 font-bold tracking-wide">{task.name}</div>
                   <div className="text-slate-500 text-xs mt-1 font-mono">Size: {task.size} | Last Run: {task.last}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`text-xs font-bold px-3 py-1 rounded border tracking-widest ${task.status === 'SYNCING' ? 'text-amber-400 border-amber-900 bg-amber-950/30 animate-pulse' : 'text-emerald-400 border-emerald-900 bg-emerald-950/30'}`}>
                     {task.status}
                  </div>
                  <button className="px-4 py-1.5 border border-cyan-800 text-cyan-400 hover:bg-cyan-900 text-xs font-bold tracking-widest transition-colors">
                     FORCE SYNC
                  </button>
                </div>
             </div>
           ))}
         </div>
      </div>
    </div>
  );
}
