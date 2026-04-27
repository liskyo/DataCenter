"use client";

import type { MaintenanceCopy, NotifyBefore } from "./types";
import type { MaintenanceCycleKey } from "./smartDefaults";
import { MAINTENANCE_CYCLES } from "./smartDefaults";

export function formatScheduleDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value.replace("T", " ");
  }

  return parsed.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function splitScheduleDateTime(value: string): { date: string; time: string } {
  const [date = "", time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
}

export function formatCycleLabel(days: number, lang: "en" | "zh"): string {
  if (!days || days <= 0) return lang === "en" ? "One-time" : "單次";
  const found = MAINTENANCE_CYCLES.find((c) => c.key !== "custom" && c.days === days);
  if (found) return lang === "en" ? found.en : found.zh;
  return lang === "en" ? `Every ${days} days` : `每 ${days} 天`;
}

export function formatNotifyBeforeLabel(notes: string, lang: "en" | "zh"): string {
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === "object" && parsed._notifyBefore) {
      const nb = parsed._notifyBefore as NotifyBefore;
      const labels: string[] = [];
      if (nb.oneMonthBefore) labels.push(lang === "en" ? "1M" : "一月前");
      if (nb.oneWeekBefore) labels.push(lang === "en" ? "1W" : "一週前");
      if (nb.oneDayBefore) labels.push(lang === "en" ? "1D" : "一天前");
      if (nb.sameDay) labels.push(lang === "en" ? "Same day" : "當天");
      return labels.length > 0 ? labels.join(" / ") : (lang === "en" ? "None" : "無");
    }
  } catch {
    // not JSON, just return empty
  }
  return "";
}

export function extractNotesText(notes: string): string {
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === "object" && parsed._userNotes !== undefined) {
      return parsed._userNotes;
    }
  } catch {
    // not JSON
  }
  return notes;
}

export function extractNotifyBefore(notes: string): NotifyBefore {
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === "object" && parsed._notifyBefore) {
      return parsed._notifyBefore;
    }
  } catch {
    // fallback
  }
  return { sameDay: true, oneDayBefore: true, oneWeekBefore: false, oneMonthBefore: false };
}

export function extractTargetCategory(notes: string): string {
  try {
    const parsed = JSON.parse(notes);
    if (parsed && typeof parsed === "object" && parsed._targetCategory) {
      return parsed._targetCategory;
    }
  } catch {
    // fallback
  }
  return "";
}

export function buildNotesPayload(
  userNotes: string,
  notifyBefore: NotifyBefore,
  targetCategory: string,
  maintenanceCycle: MaintenanceCycleKey
): string {
  return JSON.stringify({
    _userNotes: userNotes,
    _notifyBefore: notifyBefore,
    _targetCategory: targetCategory,
    _maintenanceCycle: maintenanceCycle,
  });
}
