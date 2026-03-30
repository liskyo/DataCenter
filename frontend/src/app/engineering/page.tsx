"use client";

import { useState } from "react";
import { Wrench, ShieldAlert, TerminalSquare, ShieldCheck, Cpu, DatabaseZap } from "lucide-react";
import { useLanguage } from "@/shared/i18n/language";

export default function EngineeringPage() {
  const { language } = useLanguage();
  const t = language === "en"
    ? {
      title: "ENGINEERING OVERRIDE",
      accessGranted: "STATUS: KERNEL ACCESS GRANTED",
      accessWarning: "WARNING: KERNEL LEVEL ACCESS",
      denied: "ACCESS DENIED: Invalid Override Code",
      restricted: "RESTRICTED AREA",
      desc: "This module provides direct memory access (DMA) to the sensor firmware array. Unauthorized modifications may cause catastrophic equipment failure.",
      enterCode: "ENTER OVERRIDE CODE...",
      auth: "AUTH",
      hint: "TERMINAL LOCKED (Hint: admin)",
      root: "ROOT CONSOLE",
      active: "Session Active: Admin",
      terminate: "TERMINATE SESSION",
      calibration: "SENSOR ARRAY CALIBRATION",
      tempBias: "Temperature Bias Offset",
      pollRate: "CPU Utilization Poll Rate",
      applyCalibration: "APPLY CALIBRATION",
      cacheFlush: "CACHE FLUSH UTILITY",
      cacheDesc: "Forces immediate write-ahead log (WAL) sync to MongoDB and flushes Redis in-memory cache.",
      flush: "FLUSH SYSTEM CACHE",
    }
    : {
      title: "工程覆寫模式",
      accessGranted: "狀態：核心權限已啟用",
      accessWarning: "警告：核心層級存取",
      denied: "拒絕存取：覆寫碼無效",
      restricted: "限制區域",
      desc: "此模組提供對感測器韌體陣列的直接記憶體存取（DMA），未授權修改可能導致設備重大故障。",
      enterCode: "輸入覆寫碼...",
      auth: "驗證",
      hint: "終端鎖定（提示：admin）",
      root: "ROOT 主控台",
      active: "目前工作階段：Admin",
      terminate: "結束工作階段",
      calibration: "感測器陣列校正",
      tempBias: "溫度偏移",
      pollRate: "CPU 輪詢頻率",
      applyCalibration: "套用校正",
      cacheFlush: "快取清除工具",
      cacheDesc: "立即觸發 MongoDB WAL 同步並清除 Redis 記憶體快取。",
      flush: "清除系統快取",
    };
  const [code, setCode] = useState("");
  const [isAuth, setIsAuth] = useState(false);
  const [error, setError] = useState("");

  const handleAuth = () => {
    // 預設密碼: admin 或者 kernel123
    if (code === "admin" || code === "kernel123") {
      setIsAuth(true);
      setError("");
    } else {
      setError(t.denied);
      setCode("");
    }
  };

  return (
    <div className="p-8 pb-20 max-w-7xl mx-auto h-full flex flex-col">
       <header className={`mb-6 flex items-center gap-4 ${isAuth ? 'bg-emerald-950/30 border-emerald-900' : 'bg-[#0a1e3f]/30 border-rose-900'} p-4 rounded-xl border`}>
        <Wrench size={32} className={isAuth ? "text-emerald-500" : "text-rose-500"} />
        <div>
          <h1 className={`text-2xl font-black ${isAuth ? 'text-emerald-500' : 'text-rose-500'} tracking-widest uppercase shadow-sm`}>
             {t.title}
          </h1>
          <p className={`${isAuth ? 'text-emerald-900' : 'text-rose-900'} text-xs font-mono tracking-widest mt-1 font-bold`}>
            {isAuth ? t.accessGranted : t.accessWarning}
          </p>
        </div>
      </header>

      <div className={`flex-1 flex items-center justify-center p-6 border ${isAuth ? 'border-emerald-900/50 bg-[repeating-linear-gradient(45deg,rgba(16,185,129,0.05),rgba(16,185,129,0.05)_10px,transparent_10px,transparent_20px)]' : 'border-rose-900/50 bg-[repeating-linear-gradient(45deg,rgba(159,18,57,0.05),rgba(159,18,57,0.05)_10px,transparent_10px,transparent_20px)]'} relative`}>
         <div className="absolute inset-0 bg-black/50"></div>
         
         {!isAuth ? (
           // 鎖定狀態 UI
           <div className="relative z-10 flex flex-col items-center max-w-lg text-center bg-[#050510] border-2 border-rose-500 p-8 shadow-[0_0_30px_rgba(244,63,94,0.3)]">
              <ShieldAlert size={64} className="text-rose-500 mb-6 animate-pulse" />
             <h2 className="text-2xl font-black text-white tracking-widest mb-4">{t.restricted}</h2>
              <p className="text-slate-400 text-sm mb-6 leading-relaxed">
                {t.desc}
              </p>

              {error && <div className="text-rose-500 font-bold mb-4 font-mono text-sm border border-rose-900 bg-rose-950/30 w-full py-2">{error}</div>}

              <div className="w-full flex">
                 <input 
                   type="password" 
                   value={code}
                   onChange={(e) => setCode(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                   placeholder={t.enterCode}
                   className="flex-1 bg-black border border-rose-900 px-4 py-3 text-rose-500 font-mono focus:outline-none focus:border-rose-500 placeholder-rose-950"
                 />
                 <button 
                   onClick={handleAuth}
                   className="bg-rose-950 border border-rose-900 px-6 py-3 font-bold text-rose-500 hover:bg-rose-900 transition-colors uppercase tracking-widest"
                 >
                   {t.auth}
                 </button>
              </div>
              
               <div className="mt-8 flex items-center justify-center gap-2 text-rose-900 text-xs font-mono">
                <TerminalSquare size={14}/> {t.hint}
              </div>
           </div>
         ) : (
           // 解鎖狀態 UI
           <div className="relative z-10 w-full max-w-4xl bg-[#050510] border-2 border-emerald-500 p-8 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
              <div className="flex items-center justify-between mb-8 border-b border-emerald-900 pb-4">
                 <div className="flex items-center gap-3">
                   <ShieldCheck size={32} className="text-emerald-500" />
                   <div>
                     <h2 className="text-xl font-black text-white tracking-widest">{t.root}</h2>
                     <p className="text-emerald-600 font-mono text-xs">{t.active}</p>
                   </div>
                 </div>
                 <button onClick={() => { setIsAuth(false); setCode(""); }} className="text-rose-500 font-mono text-xs border border-rose-900 px-4 py-2 hover:bg-rose-950">
                  {t.terminate}
                 </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                 {/* 核心設定 */}
                 <div className="border border-emerald-900 p-4">
                   <h3 className="text-emerald-500 font-bold tracking-widest font-mono mb-4 flex items-center gap-2"><Cpu size={16}/> {t.calibration}</h3>
                    <div className="space-y-4">
                       <div className="flex justify-between text-slate-300 text-sm"><span>{t.tempBias}</span> <span className="text-emerald-400">-0.5°C</span></div>
                       <div className="flex justify-between text-slate-300 text-sm"><span>{t.pollRate}</span> <span className="text-emerald-400">1000ms</span></div>
                       <button className="w-full mt-4 bg-emerald-950/50 border border-emerald-800 text-emerald-400 py-2 font-mono text-xs hover:bg-emerald-900">{t.applyCalibration}</button>
                    </div>
                 </div>

                 {/* 緩存清理 */}
                 <div className="border border-emerald-900 p-4">
                   <h3 className="text-emerald-500 font-bold tracking-widest font-mono mb-4 flex items-center gap-2"><DatabaseZap size={16}/> {t.cacheFlush}</h3>
                    <div className="space-y-4">
                       <p className="text-slate-400 text-xs">{t.cacheDesc}</p>
                       <button className="w-full mt-4 bg-rose-950/50 border border-rose-800 text-rose-400 py-2 font-mono text-xs hover:bg-rose-900 transition-colors">{t.flush}</button>
                    </div>
                 </div>
              </div>
           </div>
         )}
      </div>
    </div>
  );
}
