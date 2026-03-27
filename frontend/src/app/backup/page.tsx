"use client";

import { CloudDownload, Database, HardDrive, RefreshCw } from "lucide-react";
import { useLanguage } from "@/shared/i18n/language";

export default function BackupPage() {
  const { language } = useLanguage();
  const t = language === "en"
    ? {
      title: "SYSTEM BACKUP & RECOVERY",
      subtitle: "Disaster Recovery (DR) synchronization",
      cloudSync: "Cloud Sync Status",
      localSpace: "Local Free Space",
      nextSnapshot: "Next Global Snapshot",
      tasks: "ACTIVE REPLICATION TASKS",
      size: "Size",
      lastRun: "Last Run",
      forceSync: "FORCE SYNC",
    }
    : {
      title: "系統備份與復原",
      subtitle: "災難復原 (DR) 同步狀態",
      cloudSync: "雲端同步狀態",
      localSpace: "本機可用空間",
      nextSnapshot: "下次全域快照",
      tasks: "進行中的複寫任務",
      size: "容量",
      lastRun: "上次執行",
      forceSync: "強制同步",
    };
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
             {t.title}
          </h1>
          <p className="text-slate-400 text-xs font-mono tracking-widest mt-1">{t.subtitle}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { icon: Database, label: t.cloudSync, value: "ACTIVE", color: "text-emerald-400" },
          { icon: HardDrive, label: t.localSpace, value: "3.2 TB", color: "text-cyan-400" },
          { icon: RefreshCw, label: t.nextSnapshot, value: "02:45:00", color: "text-amber-400" },
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
           <h3 className="text-cyan-400 font-bold tracking-widest text-sm">{t.tasks}</h3>
         </div>
         <div className="p-0">
           {backups.map((task, i) => (
             <div key={i} className="flex justify-between items-center p-4 border-b border-[#1e3a8a] hover:bg-[#152e5c]/50 transition-colors">
                <div>
                   <div className="text-slate-200 font-bold tracking-wide">{task.name}</div>
                  <div className="text-slate-500 text-xs mt-1 font-mono">{t.size}: {task.size} | {t.lastRun}: {task.last}</div>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`text-xs font-bold px-3 py-1 rounded border tracking-widest ${task.status === 'SYNCING' ? 'text-amber-400 border-amber-900 bg-amber-950/30 animate-pulse' : 'text-emerald-400 border-emerald-900 bg-emerald-950/30'}`}>
                     {task.status}
                  </div>
                  <button className="px-4 py-1.5 border border-cyan-800 text-cyan-400 hover:bg-cyan-900 text-xs font-bold tracking-widest transition-colors">
                     {t.forceSync}
                  </button>
                </div>
             </div>
           ))}
         </div>
      </div>
    </div>
  );
}
