"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDcimStore } from "@/store/useDcimStore";
import {
  BarChart3, SlidersHorizontal, LineChart, LifeBuoy,
  CloudDownload, Globe, FileText, Wrench, Settings, Languages, MonitorIcon, Factory, Box, MapPin, Plus, Trash2
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const store = useDcimStore();

  const navItems = [
    { name: "狀態總覽", href: "/", icon: BarChart3 },
    { name: "3D動態機房", href: "/twins", icon: Box },
    { name: "廠務監控", href: "/facility", icon: Factory },
    { name: "設備控制", href: "/control", icon: SlidersHorizontal },
    { name: "趨勢分析", href: "/analysis", icon: LineChart },
    { name: "維護保養", href: "/maintenance", icon: LifeBuoy },
    { name: "系統備份", href: "/backup", icon: CloudDownload },
    { name: "網路通訊", href: "/network", icon: Globe },
    { name: "系統日誌", href: "/logs", icon: FileText },
    { name: "工程模式", href: "/engineering", icon: Wrench },
    { name: "系統設定", href: "/settings", icon: Settings }
  ];

  const handleAddLocation = () => {
    const name = prompt("請輸入新地點名稱 (例如: 2F 機房):");
    if (name) {
      store.addLocation(name, 'floor');
    }
  };

  const handleRemoveLocation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (store.locations.length <= 1) {
      alert("至少必須保留一個地點。");
      return;
    }
    if (confirm("確定要刪除此地點及其所有設備嗎？")) {
      store.removeLocation(id);
    }
  };

  return (
    <nav className="flex items-center justify-between px-3 py-2 bg-[#0c1322] border-b border-[#1e293b] text-slate-300 select-none shadow-[0_4px_20px_rgba(0,0,0,0.5)] z-50">

      {/* 導覽列主選單 */}
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide flex-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
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

        {/* 地點切換器 */}
        <div className="flex items-center gap-2 bg-[#0a1e3f] border border-cyan-900/50 rounded-md px-2 py-1">
          <MapPin size={14} className="text-cyan-500" />
          <select
            className="bg-transparent border-none text-[12px] text-cyan-100 outline-none cursor-pointer font-bold pr-2 min-w-[80px]"
            value={store.currentLocationId}
            onChange={(e) => store.setCurrentLocation(e.target.value)}
          >
            {store.locations.map(loc => (
              <option key={loc.id} value={loc.id} className="bg-[#0c1322] text-white">
                {loc.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleAddLocation}
            className="p-1 hover:bg-cyan-900 rounded text-cyan-400 transition-colors"
            title="新增地點"
          >
            <Plus size={14} />
          </button>
        </div>

        <button className="flex items-center justify-center p-2 text-slate-400 hover:text-white transition-colors">
          <MonitorIcon size={18} />
        </button>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-700 hover:bg-slate-800 hover:border-slate-500 transition-colors text-[13px] tracking-wider text-slate-300">
          <Languages size={14} /> 中(繁)
        </button>
      </div>
    </nav>
  );
}
