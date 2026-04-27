"use client";

import { BellRing, CalendarClock, RefreshCw, ShieldCheck, Wrench } from "lucide-react";
import type { MaintenanceCopy, MaintenanceSchedule } from "./types";
import {
  formatScheduleDateTime,
  formatCycleLabel,
  formatNotifyBeforeLabel,
  extractNotesText,
} from "./utils";
import { useLanguage } from "@/shared/i18n/language";

type Props = {
  task: MaintenanceSchedule;
  t: MaintenanceCopy;
  isDeleting: boolean;
  onEdit: (task: MaintenanceSchedule) => void;
  onDelete: (scheduleId: string) => void;
};

export function MaintenanceScheduleCard({
  task,
  t,
  isDeleting,
  onEdit,
  onDelete,
}: Props) {
  const { language } = useLanguage();
  const lang = language === "en" ? "en" : "zh";
  const notifyLabel = formatNotifyBeforeLabel(task.notes, lang);
  const userNotes = extractNotesText(task.notes);
  const cycleLabel = formatCycleLabel(task.recurrence_days, lang);

  return (
    <div className="rounded-xl border-l-4 border-l-cyan-500 border-y border-r border-[#1e3a8a] bg-[#020b1a] p-6">
      <div className="mb-4 flex justify-between gap-4">
        <h3 className="font-bold font-mono tracking-wider text-cyan-400">{task.target}</h3>
        <div className="flex items-center gap-2">
          <span className="rounded bg-cyan-900/40 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-cyan-300">
            {task.status}
          </span>
          <button
            type="button"
            onClick={() => onEdit(task)}
            className="rounded border border-cyan-800 bg-[#06101f] px-3 py-1 text-[10px] font-bold tracking-widest text-cyan-300 transition-colors hover:bg-cyan-950/30"
          >
            {t.edit}
          </button>
        </div>
      </div>

      <div className="space-y-2 text-sm text-slate-300">
        <div className="flex items-center gap-2">
          <Wrench size={14} className="text-slate-500 shrink-0" />
          {t.task}: {task.task_type}
        </div>
        <div className="flex items-center gap-2">
          <CalendarClock size={14} className="text-slate-500 shrink-0" />
          {t.schedule}: {formatScheduleDateTime(task.scheduled_at)}
        </div>
        <div className="flex items-center gap-2">
          <RefreshCw size={14} className="text-slate-500 shrink-0" />
          {t.maintenanceCycle}: <span className="text-cyan-400 font-bold">{cycleLabel}</span>
        </div>
        {notifyLabel && (
          <div className="flex items-center gap-2">
            <BellRing size={14} className="text-slate-500 shrink-0" />
            {t.notifyBefore}: <span className="text-amber-400">{notifyLabel}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <BellRing size={14} className="text-slate-500 shrink-0" />
          {t.sentAt}:{" "}
          {task.reminder_sent_at
            ? formatScheduleDateTime(new Date(task.reminder_sent_at).toISOString())
            : t.notSent}
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-slate-500 shrink-0" />
          {t.assigned}: {task.assignee_name} ({task.assignee_username})
        </div>
        <div className="flex items-center gap-2">
          <BellRing size={14} className="text-slate-500 shrink-0" />
          {t.notify}: {task.notify_email ? t.enabled : t.disabled}
        </div>
        {userNotes ? (
          <div className="rounded-lg border border-slate-800 bg-[#06101f] px-3 py-2 text-xs text-slate-400">
            {userNotes}
          </div>
        ) : null}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            disabled={isDeleting}
            className="rounded border border-red-900/70 bg-red-950/20 px-3 py-2 text-[11px] font-bold tracking-widest text-red-300 transition-colors hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t.delete}
          </button>
        </div>
      </div>
    </div>
  );
}
