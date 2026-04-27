"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useShallow } from "zustand/react/shallow";
import { useDcimStore } from "@/store/useDcimStore";
import { useAuth } from "@/shared/auth-context";
import { useLanguage } from "@/shared/i18n/language";
import {
  BarChart3, SlidersHorizontal, LineChart, LifeBuoy,
  CloudDownload, Globe, FileText, Wrench, Settings, Languages, Factory, Box, MapPin, Plus, LogOut, Users
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout, loading, isAuthenticated } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const { locations, currentLocationId, setCurrentLocation, addLocation } = useDcimStore(
    useShallow((s) => ({
      locations: s.locations,
      currentLocationId: s.currentLocationId,
      setCurrentLocation: s.setCurrentLocation,
      addLocation: s.addLocation,
    }))
  );

  const t = useMemo(() => {
    if (language === "en") {
      return {
        status: "Overview",
        twins: "3D Twin",
        facility: "Facility",
        control: "Control",
        analysis: "Analysis",
        maintenance: "Maintenance",
        backup: "Backup",
        network: "Network",
        logs: "Logs",
        engineering: "Engineering",
        settings: "Settings",
        users: "Users",
        addLocationPrompt: "Enter location name (e.g. 2F DC):",
        addLocationTitle: "Add location",
        languageButton: "EN",
      };
    }
    return {
      status: "狀態總覽",
      twins: "3D動態機房",
      facility: "廠務監控",
      control: "設備控制",
      analysis: "趨勢分析",
      maintenance: "維護保養",
      backup: "系統備份",
      network: "網路通訊",
      logs: "系統日誌",
      engineering: "工程模式",
      settings: "系統設定",
      users: "使用者管理",
      addLocationPrompt: "請輸入新地點名稱 (例如: 2F 機房):",
      addLocationTitle: "新增地點",
      languageButton: "中(繁)",
    };
  }, [language]);

  if (pathname === "/login" || loading || !isAuthenticated) {
    return null;
  }

  const validLocationId =
    locations.some((l) => l.id === currentLocationId) && locations.length > 0
      ? currentLocationId
      : locations[0]?.id ?? "";

  const navItems = [
    { name: t.status, href: "/", icon: BarChart3 },
    { name: t.twins, href: "/twins", icon: Box },
    { name: t.facility, href: "/facility", icon: Factory },
    { name: t.control, href: "/control", icon: SlidersHorizontal },
    { name: t.analysis, href: "/analysis", icon: LineChart },
    { name: t.maintenance, href: "/maintenance", icon: LifeBuoy },
    { name: t.backup, href: "/backup", icon: CloudDownload },
    { name: t.network, href: "/network", icon: Globe },
    { name: t.logs, href: "/logs", icon: FileText },
    { name: t.engineering, href: "/engineering", icon: Wrench },
    { name: t.settings, href: "/settings", icon: Settings },
    { name: t.users, href: "/users", icon: Users },
  ];

  const handleAddLocation = () => {
    const name = prompt(t.addLocationPrompt);
    if (name) {
      addLocation(name, 'floor');
    }
  };

  return (
    <nav className="flex shrink-0 items-center justify-between px-3 py-2 bg-[#0c1322] border-b border-[#1e293b] text-slate-300 select-none shadow-[0_4px_20px_rgba(0,0,0,0.5)] z-50">

      {/* 導覽列主選單 */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              prefetch={true}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 whitespace-nowrap text-[13px] tracking-widest font-bold ${isActive
                ? "bg-[#18294a] text-[#4ea8de] shadow-[inset_0_0_10px_rgba(78,168,222,0.1)] border border-[#27406b]"
                : "text-slate-400 hover:bg-[#152238] hover:text-slate-200 border border-transparent"
                }`}
            >
              <Icon size={16} className={isActive ? "text-[#4ea8de]" : "text-slate-500"} strokeWidth={isActive ? 2.5 : 2} />
              {item.name}
            </Link>
          );
        })}
      </div>

      {/* 右側工具列 */}
      <div className="flex items-center gap-3 pl-4 border-l border-slate-700 ml-4 shrink-0">
        <div className="hidden xl:flex flex-col items-end text-right">
          <span className="text-[11px] font-bold tracking-[0.2em] text-cyan-300">
            {user?.name || user?.username}
          </span>
          <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
            {user?.role}
          </span>
        </div>

        {/* 地點切換器 */}
        <div className="flex items-center gap-2 bg-[#0a1e3f] border border-cyan-900/50 rounded-md px-2 py-1">
          <MapPin size={14} className="text-cyan-500" />
          <select
            className="bg-transparent border-none text-[12px] text-cyan-100 outline-none cursor-pointer font-bold pr-2 min-w-[80px]"
            value={validLocationId}
            onChange={(e) => setCurrentLocation(e.target.value)}
          >
            {locations.map(loc => (
              <option key={loc.id} value={loc.id} className="bg-[#0c1322] text-white">
                {loc.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleAddLocation}
            className="p-1 hover:bg-cyan-900 rounded text-cyan-400 transition-colors"
            title={t.addLocationTitle}
          >
            <Plus size={14} />
          </button>
        </div>

        <button
          onClick={toggleLanguage}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-700 hover:bg-slate-800 hover:border-slate-500 transition-colors text-[13px] tracking-wider text-slate-300"
        >
          <Languages size={14} /> {t.languageButton}
        </button>
        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-red-900/60 text-red-300 transition-colors hover:bg-red-950/30 hover:border-red-700"
          title="Logout"
        >
          <LogOut size={14} />
          <span className="text-[12px] font-bold tracking-[0.2em]">OUT</span>
        </button>
      </div>
    </nav>
  );
}
