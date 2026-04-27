"use client";

import type { AppLanguage } from "@/shared/i18n/language";

/** 維護對象分類（設備種類下拉選單） */
export const EQUIPMENT_CATEGORIES = [
  { key: "crac", en: "CRAC (Precision AC)", zh: "CRAC (精密空調)" },
  { key: "ups", en: "UPS (Uninterruptible Power)", zh: "UPS (不斷電系統)" },
  { key: "pdu", en: "PDU (Power Distribution)", zh: "PDU (配電盤)" },
  { key: "generator", en: "Generator (Diesel)", zh: "Generator (柴油發電機)" },
  { key: "cdu", en: "CDU (Coolant Distribution)", zh: "CDU (冷卻液分配器)" },
  { key: "chiller", en: "Chiller (Ice Water)", zh: "Chiller (冰水主機)" },
  { key: "fire", en: "Fire Suppression", zh: "消防系統" },
  { key: "server_rack", en: "Server Rack", zh: "伺服器機櫃" },
  { key: "network", en: "Network Switch", zh: "Network Switch (網路交換器)" },
  { key: "immersion", en: "Immersion Tank", zh: "浸沒式液冷槽" },
] as const;

/** 根據維護對象產生常見維修項目 */
export const TASK_MAP: Record<string, { en: string; zh: string }[]> = {
  crac: [
    { en: "Filter replacement", zh: "濾網更換" },
    { en: "Refrigerant inspection", zh: "冷媒檢測" },
    { en: "Belt inspection", zh: "皮帶檢查" },
    { en: "Drain pipe cleaning", zh: "排水管清潔" },
    { en: "Full unit service", zh: "全機保養" },
    { en: "Condenser coil cleaning", zh: "冷凝器盤管清洗" },
  ],
  ups: [
    { en: "Battery discharge test", zh: "電池放電測試" },
    { en: "Battery replacement", zh: "電池更換" },
    { en: "Bypass switch test", zh: "旁路開關測試" },
    { en: "Capacitor inspection", zh: "電容器檢查" },
    { en: "Firmware update", zh: "韌體更新" },
  ],
  pdu: [
    { en: "Thermal scan (IR)", zh: "紅外線熱像掃描" },
    { en: "Breaker inspection", zh: "斷路器檢測" },
    { en: "Load balancing check", zh: "負載平衡確認" },
    { en: "Cable tie-down check", zh: "線纜固定檢查" },
  ],
  generator: [
    { en: "Monthly test run", zh: "每月試車運轉" },
    { en: "Oil change", zh: "機油更換" },
    { en: "Fuel filter replacement", zh: "柴油濾芯更換" },
    { en: "Coolant level check", zh: "冷卻液檢查" },
    { en: "Battery check", zh: "啟動電池檢測" },
    { en: "Full load bank test", zh: "全載測試" },
  ],
  cdu: [
    { en: "Water quality test", zh: "水質檢測" },
    { en: "Filter replacement", zh: "濾網更換" },
    { en: "Pressure test", zh: "壓力測試" },
    { en: "Pump maintenance", zh: "泵浦保養" },
    { en: "Leak detection scan", zh: "漏液偵測掃描" },
  ],
  chiller: [
    { en: "Compressor inspection", zh: "壓縮機檢查" },
    { en: "Refrigerant level check", zh: "冷媒量確認" },
    { en: "Condenser tube cleaning", zh: "冷凝器管路清洗" },
    { en: "Oil analysis", zh: "潤滑油分析" },
    { en: "Vibration analysis", zh: "震動分析" },
  ],
  fire: [
    { en: "FM200 pressure check", zh: "FM200 氣體壓力檢查" },
    { en: "VESDA sensitivity test", zh: "VESDA 靈敏度測試" },
    { en: "Smoke detector test", zh: "煙霧偵測器測試" },
    { en: "EPO circuit test", zh: "EPO 緊急斷電測試" },
    { en: "Sprinkler inspection", zh: "灑水器巡檢" },
  ],
  server_rack: [
    { en: "Dust cleaning", zh: "機櫃除塵" },
    { en: "Cable management", zh: "線纜整理" },
    { en: "Fan module check", zh: "風扇模組檢查" },
    { en: "Door lock inspection", zh: "門鎖檢查" },
    { en: "Power strip inspection", zh: "排插檢查" },
  ],
  network: [
    { en: "Firmware update", zh: "韌體更新" },
    { en: "Port status audit", zh: "埠位狀態稽核" },
    { en: "Optics cleaning", zh: "光纖模組清潔" },
    { en: "Config backup", zh: "組態備份" },
  ],
  immersion: [
    { en: "Coolant level check", zh: "冷卻液液位確認" },
    { en: "Fluid quality test", zh: "冷卻液品質檢測" },
    { en: "Pump maintenance", zh: "泵浦保養" },
    { en: "Heat exchanger cleaning", zh: "熱交換器清洗" },
    { en: "Leak sensor calibration", zh: "漏液感測器校準" },
  ],
};

/** 維修週期選項 */
export type MaintenanceCycleKey = "monthly" | "quarterly" | "semi_annual" | "annual" | "biennial" | "custom";

export const MAINTENANCE_CYCLES: { key: MaintenanceCycleKey; days: number; en: string; zh: string }[] = [
  { key: "monthly", days: 30, en: "Monthly", zh: "每月" },
  { key: "quarterly", days: 90, en: "Quarterly", zh: "每季" },
  { key: "semi_annual", days: 180, en: "Semi-Annual", zh: "每半年" },
  { key: "annual", days: 365, en: "Annual", zh: "每年" },
  { key: "biennial", days: 730, en: "Biennial (2 years)", zh: "每兩年" },
  { key: "custom", days: 0, en: "Custom", zh: "自填" },
];

/** 根據維護對象 + 維修項目，自動推薦預設維修週期 */
export const DEFAULT_CYCLE_MAP: Record<string, MaintenanceCycleKey> = {
  // CRAC
  "crac:Filter replacement": "quarterly",
  "crac:濾網更換": "quarterly",
  "crac:Full unit service": "annual",
  "crac:全機保養": "annual",
  // UPS
  "ups:Battery discharge test": "annual",
  "ups:電池放電測試": "annual",
  "ups:Battery replacement": "biennial",
  "ups:電池更換": "biennial",
  // Generator
  "generator:Monthly test run": "monthly",
  "generator:每月試車運轉": "monthly",
  "generator:Oil change": "semi_annual",
  "generator:機油更換": "semi_annual",
  // CDU
  "cdu:Water quality test": "quarterly",
  "cdu:水質檢測": "quarterly",
  "cdu:Filter replacement": "quarterly",
  "cdu:濾網更換": "quarterly",
  // Chiller
  "chiller:Compressor inspection": "annual",
  "chiller:壓縮機檢查": "annual",
  // Fire
  "fire:FM200 pressure check": "semi_annual",
  "fire:FM200 氣體壓力檢查": "semi_annual",
  "fire:VESDA sensitivity test": "annual",
  "fire:VESDA 靈敏度測試": "annual",
  // Server Rack
  "server_rack:Dust cleaning": "quarterly",
  "server_rack:機櫃除塵": "quarterly",
  // Network
  "network:Firmware update": "semi_annual",
  "network:韌體更新": "semi_annual",
  // Immersion
  "immersion:Coolant level check": "monthly",
  "immersion:冷卻液液位確認": "monthly",
};

/** 時間選單（08:00 ~ 22:00，每 30 分鐘） */
export const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

/** 根據 recurrence_days 反推維修週期 key */
export function daysToMaintenanceCycle(days: number): { cycle: MaintenanceCycleKey; customDays: string } {
  if (days <= 0) return { cycle: "monthly", customDays: "" };
  const found = MAINTENANCE_CYCLES.find((c) => c.key !== "custom" && c.days === days);
  if (found) return { cycle: found.key, customDays: "" };
  return { cycle: "custom", customDays: String(days) };
}

/** 將維修週期 key 轉換為天數 */
export function maintenanceCycleToDays(cycle: MaintenanceCycleKey, customDays: string): number {
  if (cycle === "custom") {
    const parsed = parseInt(customDays, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
  }
  const found = MAINTENANCE_CYCLES.find((c) => c.key === cycle);
  return found?.days ?? 30;
}

/** 取得設備類別的在地化名稱 */
export function getEquipmentLabel(key: string, lang: AppLanguage): string {
  const cat = EQUIPMENT_CATEGORIES.find((c) => c.key === key);
  return cat ? (lang === "en" ? cat.en : cat.zh) : key;
}

/** 取得維修項目的在地化名稱 */
export function getTaskLabel(task: string, targetKey: string, lang: AppLanguage): string {
  const tasks = TASK_MAP[targetKey];
  if (!tasks) return task;
  const found = tasks.find((t) => t.en === task || t.zh === task);
  return found ? (lang === "en" ? found.en : found.zh) : task;
}
