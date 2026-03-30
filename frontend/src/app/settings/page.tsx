"use client";

import { Settings, Bell, Palette, Database } from "lucide-react";
import { useLanguage } from "@/shared/i18n/language";

export default function SettingsPage() {
  const { language } = useLanguage();
  const t = language === "en"
    ? {
      title: "SYSTEM CONFIGURATION",
      subtitle: "Global application parameters",
      channels: "NOTIFICATION CHANNELS",
      retention: "RETENTION POLICIES",
      theme: "INTERFACE THEME",
      dark: "SCADA DARK",
      lightLocked: "LIGHT MODE (LOCKED)",
      influxRetention: "InfluxDB Data Retention",
      mongoLimit: "MongoDB Alert Logs Limit",
    }
    : {
      title: "系統設定",
      subtitle: "全域應用參數",
      channels: "通知通道",
      retention: "資料保留策略",
      theme: "介面主題",
      dark: "SCADA 深色",
      lightLocked: "淺色模式（鎖定）",
      influxRetention: "InfluxDB 資料保留",
      mongoLimit: "MongoDB 告警日誌上限",
    };
  return (
    <div className="p-8 pb-20 max-w-7xl mx-auto">
      <header className="mb-6 flex items-center gap-4 bg-[#0a1e3f]/30 p-4 rounded-xl border border-[#1e3a8a]">
        <Settings size={32} className="text-[#4ea8de]" />
        <div>
          <h1 className="text-2xl font-black text-[#4ea8de] tracking-widest uppercase shadow-sm">
             {t.title}
          </h1>
          <p className="text-slate-400 text-xs font-mono tracking-widest mt-1">{t.subtitle}</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Notification Settings */}
        <div className="bg-[#020b1a] border border-[#1e3a8a] p-6">
           <h3 className="text-cyan-400 font-bold tracking-widest text-sm flex items-center gap-2 mb-6 pb-2 border-b border-[#1e3a8a]">
             <Bell size={16}/> {t.channels}
           </h3>
           <div className="space-y-4">
             {['Discord Webhook', 'Slack Integration', 'SMTP Email Alerts', 'SMS Gateway (Twilio)'].map(channel => (
               <label key={channel} className="flex items-center justify-between cursor-pointer group">
                  <span className="text-slate-300 font-medium group-hover:text-white transition-colors">{channel}</span>
                  <div className="relative">
                    <input type="checkbox" className="sr-only peer" defaultChecked={channel !== 'SMS Gateway (Twilio)'} />
                    <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-checked:bg-cyan-500 transition-colors"></div>
                    <div className="absolute left-[2px] top-[2px] w-5 h-5 bg-white rounded-full transition-all peer-checked:translate-x-full"></div>
                  </div>
               </label>
             ))}
           </div>
        </div>

        {/* Database Setting Limits */}
        <div className="bg-[#020b1a] border border-[#1e3a8a] p-6">
           <h3 className="text-cyan-400 font-bold tracking-widest text-sm flex items-center gap-2 mb-6 pb-2 border-b border-[#1e3a8a]">
             <Database size={16}/> {t.retention}
           </h3>
           <div className="space-y-6">
             <div>
                <div className="flex justify-between text-xs text-slate-400 font-mono mb-2">
                  <span>{t.influxRetention}</span>
                  <span className="text-cyan-400 font-bold">30 Days</span>
                </div>
                <input type="range" className="w-full h-1 bg-[#1e3a8a] rounded-lg appearance-none accent-cyan-500" defaultValue="30" max="90" />
             </div>
             <div>
                <div className="flex justify-between text-xs text-slate-400 font-mono mb-2">
                  <span>{t.mongoLimit}</span>
                  <span className="text-cyan-400 font-bold">100,000 Records</span>
                </div>
                <input type="range" className="w-full h-1 bg-[#1e3a8a] rounded-lg appearance-none accent-cyan-500" defaultValue="100000" max="500000" />
             </div>
           </div>
        </div>

        {/* UI Theme */}
        <div className="bg-[#020b1a] border border-[#1e3a8a] p-6 mt-0">
           <h3 className="text-cyan-400 font-bold tracking-widest text-sm flex items-center gap-2 mb-6 pb-2 border-b border-[#1e3a8a]">
             <Palette size={16}/> {t.theme}
           </h3>
           <div className="flex gap-4">
              <button className="flex-1 border-2 border-cyan-500 bg-[#0a1e3f] text-cyan-400 py-3 font-bold tracking-widest rounded transition-colors shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                {t.dark}
              </button>
              <button className="flex-1 border border-slate-700 bg-slate-900 text-slate-500 py-3 font-bold tracking-widest rounded transition-colors" disabled>
                {t.lightLocked}
              </button>
           </div>
        </div>

      </div>
    </div>
  );
}
