"use client";

import { LifeBuoy, Wrench, ShieldCheck, Clock } from "lucide-react";
import { useLanguage } from "@/shared/i18n/language";

export default function MaintenancePage() {
  const { language } = useLanguage();
  const t = language === "en"
    ? {
      title: "MAINTENANCE SCHEDULE",
      subtitle: "Preventative Maintenance & Work Orders",
      task: "Task",
      schedule: "Schedule",
      assigned: "Assigned To",
      ack: "Acknowledge / Approve",
    }
    : {
      title: "維護排程",
      subtitle: "預防性維護與工單",
      task: "項目",
      schedule: "排程",
      assigned: "指派給",
      ack: "確認 / 核准",
    };
  const schedules = [
    { target: "CRAC Unit A", type: "濾網更換", date: "2026-03-25", status: "PENDING", by: "Tech-Ops 2" },
    { target: "UPS Bank B", type: "電池深度放電測試", date: "2026-04-02", status: "SCHEDULED", by: "Vendor (APC)" },
    { target: "Network Switch Core-1", type: "韌體升級 v2.4", date: "2026-03-28", status: "APPROVAL_REQUIRED", by: "Net-Admin" },
    { target: "SERVER-001 (High Temp Alert)", type: "散熱膏重塗與排風扇清理", date: "2026-03-21", status: "CRITICAL_ACTION", by: "Hardware Team" },
  ];

  return (
    <div className="p-8 pb-20 max-w-7xl mx-auto">
      <header className="mb-6 flex items-center gap-4 bg-[#0a1e3f]/30 p-4 rounded-xl border border-[#1e3a8a]">
        <LifeBuoy size={32} className="text-[#4ea8de]" />
        <div>
          <h1 className="text-2xl font-black text-[#4ea8de] tracking-widest uppercase shadow-sm">
             {t.title}
          </h1>
          <p className="text-slate-400 text-xs font-mono tracking-widest mt-1">{t.subtitle}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {schedules.map((task, i) => (
           <div key={i} className={`p-6 bg-[#020b1a] border-l-4 border-y border-r border-r-[#1e3a8a] border-y-[#1e3a8a] ${task.status.includes('CRITICAL') ? 'border-l-rose-500 shadow-[inset_0_0_15px_rgba(239,68,68,0.1)]' : 'border-l-cyan-500'}`}>
              <div className="flex justify-between items-start mb-4">
                 <h3 className={`font-bold font-mono tracking-wider ${task.status.includes('CRITICAL') ? 'text-rose-400' : 'text-cyan-400'}`}>
                   {task.target}
                 </h3>
                 <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-widest ${
                    task.status === "PENDING" ? "bg-amber-900/50 text-amber-500" :
                    task.status.includes('CRITICAL') ? "bg-rose-900/50 text-rose-500 animate-pulse" :
                    "bg-cyan-900/50 text-cyan-500"
                 }`}>
                   {task.status}
                 </span>
              </div>
              <div className="space-y-2 mt-4 text-slate-300 text-sm">
                <div className="flex items-center gap-2"><Wrench size={14} className="text-slate-500"/> {t.task}: {task.type}</div>
                <div className="flex items-center gap-2"><Clock size={14} className="text-slate-500"/> {t.schedule}: {task.date}</div>
                <div className="flex items-center gap-2"><ShieldCheck size={14} className="text-slate-500"/> {t.assigned}: {task.by}</div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button className="px-4 py-2 border border-cyan-800 text-cyan-400 text-xs font-bold hover:bg-cyan-950 transition-colors uppercase tracking-widest">
                  {t.ack}
                </button>
              </div>
           </div>
        ))}
      </div>
    </div>
  );
}
