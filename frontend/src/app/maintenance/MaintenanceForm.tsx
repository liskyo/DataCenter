"use client";

import { useMemo, type FormEvent } from "react";
import type { MaintenanceCopy, MaintenanceFormState, MaintenanceUser, NotifyBefore } from "./types";
import {
  EQUIPMENT_CATEGORIES,
  TASK_MAP,
  MAINTENANCE_CYCLES,
  DEFAULT_CYCLE_MAP,
  TIME_OPTIONS,
  type MaintenanceCycleKey,
} from "./smartDefaults";
import { useLanguage } from "@/shared/i18n/language";
import { useDcimStore } from "@/store/useDcimStore";
import { useShallow } from "zustand/react/shallow";

type Props = {
  t: MaintenanceCopy;
  form: MaintenanceFormState;
  users: MaintenanceUser[];
  selectedUser: MaintenanceUser | null;
  loading: boolean;
  submitting: boolean;
  testingEmail: boolean;
  editingScheduleId: string | null;
  error: string;
  emailTestMessage: string;
  onFormChange: (updater: (prev: MaintenanceFormState) => MaintenanceFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTestEmail: () => void;
  onCancelEdit: () => void;
};

const selectClass =
  "w-full rounded-lg border border-[#1e3a8a] bg-[#06101f] px-4 py-3 text-slate-100 outline-none transition-colors focus:border-cyan-500 appearance-none cursor-pointer";
const inputClass =
  "w-full rounded-lg border border-[#1e3a8a] bg-[#06101f] px-4 py-3 text-slate-100 outline-none transition-colors focus:border-cyan-500";
const labelClass = "mb-2 block text-xs font-bold tracking-widest text-slate-400";
const checkboxWrapClass =
  "flex items-center gap-2 rounded border border-[#1e3a8a] bg-[#06101f] px-3 py-2 cursor-pointer hover:border-cyan-800 transition-colors";

export function MaintenanceForm({
  t,
  form,
  users,
  selectedUser,
  loading,
  submitting,
  testingEmail,
  editingScheduleId,
  error,
  emailTestMessage,
  onFormChange,
  onSubmit,
  onTestEmail,
  onCancelEdit,
}: Props) {
  const { language } = useLanguage();
  const lang = language === "en" ? "en" : "zh";

  // 動態取得現有設備名稱清單（根據類別過濾）
  const storeData = useDcimStore(useShallow((s) => ({ racks: s.racks, equipments: s.equipments })));

  // 類別 key → 設備對應表
  const filteredEquipmentNames = useMemo(() => {
    const cat = form.targetCategory;
    if (!cat) return [];

    const names: string[] = [];

    // 從 equipments (CRAC / PDU / CDU / UPS / Chiller) 中篩選
    const eqTypeMap: Record<string, string> = {
      crac: "crac", pdu: "pdu", cdu: "cdu", ups: "ups", chiller: "chiller",
    };
    if (eqTypeMap[cat]) {
      for (const eq of storeData.equipments) {
        if (eq.type === eqTypeMap[cat]) names.push(eq.name);
      }
    }

    // 從 racks (Server Rack / Network / Immersion) 中篩選
    const rackTypeMap: Record<string, string[]> = {
      server_rack: ["server"],
      network: ["network"],
      immersion: ["immersion_single", "immersion_dual"],
    };
    if (rackTypeMap[cat]) {
      for (const r of storeData.racks) {
        if (rackTypeMap[cat].includes(r.type)) names.push(r.name);
      }
    }

    // 若類別無法匹配 (generator, fire 等無實體對應)，顯示全部設備 + 機櫃
    if (!eqTypeMap[cat] && !rackTypeMap[cat]) {
      for (const eq of storeData.equipments) names.push(eq.name);
      for (const r of storeData.racks) names.push(r.name);
    }

    return [...new Set(names)].sort();
  }, [form.targetCategory, storeData]);

  // 取得選中設備類別的維修項目列表
  const taskOptions = useMemo(() => {
    if (!form.targetCategory) return [];
    return TASK_MAP[form.targetCategory] || [];
  }, [form.targetCategory]);

  // 當選擇維護對象時，自動更新 target 顯示名稱
  const handleCategoryChange = (key: string) => {
    const cat = EQUIPMENT_CATEGORIES.find((c) => c.key === key);
    const displayName = cat ? (lang === "en" ? cat.en : cat.zh) : key;
    onFormChange((prev) => ({
      ...prev,
      targetCategory: key,
      target: "", // reset — 讓使用者重新選設備
      taskType: "", // reset task
    }));
  };

  // 當選擇維修項目時，自動推薦維修週期
  const handleTaskChange = (taskValue: string) => {
    const cycleKey = DEFAULT_CYCLE_MAP[`${form.targetCategory}:${taskValue}`];
    onFormChange((prev) => ({
      ...prev,
      taskType: taskValue,
      ...(cycleKey && !editingScheduleId ? { maintenanceCycle: cycleKey } : {}),
    }));
  };

  const handleNotifyBeforeChange = (field: keyof NotifyBefore, checked: boolean) => {
    onFormChange((prev) => ({
      ...prev,
      notifyBefore: { ...prev.notifyBefore, [field]: checked },
    }));
  };

  return (
    <section className="rounded-xl border border-[#1e3a8a] bg-[#020b1a] p-6 overflow-y-auto max-h-[calc(100vh-160px)] custom-scrollbar">
      <div className="mb-5">
        <h2 className="text-lg font-black tracking-widest text-cyan-300">
          {editingScheduleId ? t.editTitle : t.createTitle}
        </h2>
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        {/* ── 維護對象 (設備類別下拉) ── */}
        <label className="block">
          <span className={labelClass}>{t.targetCategory}</span>
          <select
            value={form.targetCategory}
            onChange={(e) => handleCategoryChange(e.target.value)}
            className={selectClass}
            required
          >
            <option value="" disabled>{t.selectCategory}</option>
            {EQUIPMENT_CATEGORIES.map((cat) => (
              <option key={cat.key} value={cat.key}>
                {lang === "en" ? cat.en : cat.zh}
              </option>
            ))}
          </select>
        </label>

        {/* ── 設備名稱 (根據類別過濾) ── */}
        <label className="block">
          <span className={labelClass}>{lang === "en" ? "Equipment Name" : "設備名稱"}</span>
          <select
            value={form.target}
            onChange={(e) => onFormChange((prev) => ({ ...prev, target: e.target.value }))}
            className={selectClass}
            required
          >
            <option value="" disabled>{lang === "en" ? "-- Select equipment --" : "-- 選擇設備 --"}</option>
            {filteredEquipmentNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          {form.targetCategory && filteredEquipmentNames.length === 0 && (
            <p className="mt-1 text-[11px] text-amber-400">{lang === "en" ? "No equipment found for this category. Use Notes to specify." : "此類別尚無設備，可在備註中填寫。"}</p>
          )}
        </label>

        {/* ── 維修項目 (根據類別動態產生) ── */}
        <label className="block">
          <span className={labelClass}>{t.task}</span>
          <select
            value={form.taskType}
            onChange={(e) => handleTaskChange(e.target.value)}
            className={selectClass}
            required
          >
            <option value="" disabled>{t.selectTask}</option>
            {taskOptions.map((task, i) => (
              <option key={i} value={lang === "en" ? task.en : task.zh}>
                {lang === "en" ? task.en : task.zh}
              </option>
            ))}
          </select>
          {form.targetCategory && taskOptions.length === 0 && (
            <input
              value={form.taskType}
              onChange={(e) => onFormChange((prev) => ({ ...prev, taskType: e.target.value }))}
              className={`${inputClass} mt-2`}
              placeholder={t.placeholderTask}
              required
            />
          )}
        </label>

        {/* ── 排程時間 (日曆 + 時間下拉) ── */}
        <label className="block">
          <span className={labelClass}>{t.schedule}</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
            <div className="relative">
              <input
                type="date"
                value={form.scheduledDate}
                onChange={(e) => onFormChange((prev) => ({ ...prev, scheduledDate: e.target.value }))}
                className={`${inputClass} cursor-pointer min-h-[48px] [&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:brightness-200 [&::-webkit-calendar-picker-indicator]:w-6 [&::-webkit-calendar-picker-indicator]:h-6`}
                required
              />
            </div>
            <select
              value={form.scheduledTime}
              onChange={(e) => onFormChange((prev) => ({ ...prev, scheduledTime: e.target.value }))}
              className={`${selectClass} min-h-[48px]`}
              required
            >
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="mt-2 flex justify-between text-[11px] tracking-wide text-slate-500">
            <span>{t.scheduleDate}</span>
            <span>{t.scheduleTime}</span>
          </div>
        </label>

        {/* ── 通知週期 (Checkboxes) ── */}
        <div className="block">
          <span className={labelClass}>{t.notifyBefore}</span>
          <div className="grid grid-cols-2 gap-2">
            {([
              { field: "sameDay" as const, label: t.notifyBeforeSameDay },
              { field: "oneDayBefore" as const, label: t.notifyBeforeOneDay },
              { field: "oneWeekBefore" as const, label: t.notifyBeforeOneWeek },
              { field: "oneMonthBefore" as const, label: t.notifyBeforeOneMonth },
            ] as const).map(({ field, label }) => (
              <label key={field} className={checkboxWrapClass}>
                <input
                  type="checkbox"
                  checked={form.notifyBefore[field]}
                  onChange={(e) => handleNotifyBeforeChange(field, e.target.checked)}
                  className="h-4 w-4 accent-cyan-500"
                />
                <span className="text-sm text-slate-300">{label}</span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-[11px] tracking-wide text-slate-500">{t.notifyBeforeHint}</p>
        </div>

        {/* ── 維修週期 (下拉選單) ── */}
        <div className="block">
          <span className={labelClass}>{t.maintenanceCycle}</span>
          <select
            value={form.maintenanceCycle}
            onChange={(e) => onFormChange((prev) => ({ ...prev, maintenanceCycle: e.target.value }))}
            className={selectClass}
          >
            {MAINTENANCE_CYCLES.map((c) => (
              <option key={c.key} value={c.key}>
                {lang === "en" ? c.en : c.zh}
                {c.key !== "custom" ? ` (${c.days}d)` : ""}
              </option>
            ))}
          </select>
          {form.maintenanceCycle === "custom" && (
            <input
              type="number"
              min={1}
              value={form.customCycleDays}
              onChange={(e) => onFormChange((prev) => ({ ...prev, customCycleDays: e.target.value }))}
              className={`${inputClass} mt-2`}
              placeholder={t.customDaysLabel}
              required
            />
          )}
          <p className="mt-2 text-[11px] tracking-wide text-slate-500">{t.maintenanceCycleHint}</p>
        </div>

        {/* ── 維護負責人 ── */}
        <label className="block">
          <span className={labelClass}>{t.assigned}</span>
          <select
            value={form.assigneeUsername}
            onChange={(e) => onFormChange((prev) => ({ ...prev, assigneeUsername: e.target.value }))}
            className={selectClass}
            required
          >
            {users.map((user) => (
              <option key={user.username} value={user.username}>
                {user.name} ({user.username}) — {user.role}
              </option>
            ))}
          </select>
        </label>

        {/* ── 備註 ── */}
        <label className="block">
          <span className={labelClass}>{t.notes}</span>
          <textarea
            value={form.notes}
            onChange={(e) => onFormChange((prev) => ({ ...prev, notes: e.target.value }))}
            className="min-h-[80px] w-full rounded-lg border border-[#1e3a8a] bg-[#06101f] px-4 py-3 text-slate-100 outline-none transition-colors focus:border-cyan-500"
            placeholder={t.placeholderNotes}
          />
        </label>

        {/* ── Email 提醒 ── */}
        <label className="flex items-start gap-3 rounded-lg border border-cyan-900/50 bg-[#06101f] px-4 py-3">
          <input
            type="checkbox"
            checked={form.notifyEmail}
            onChange={(e) => onFormChange((prev) => ({ ...prev, notifyEmail: e.target.checked }))}
            className="mt-1 h-4 w-4 accent-cyan-500"
          />
          <span className="flex-1">
            <span className="block text-sm font-bold text-cyan-300">{t.notify}</span>
            <span className="block text-xs text-slate-500">
              {form.notifyEmail ? (selectedUser?.has_email ? t.enabled : t.emailMissing) : t.disabled}
            </span>
          </span>
        </label>

        {error ? (
          <div className="rounded-lg border border-red-900/60 bg-red-950/20 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {emailTestMessage ? (
          <div className="rounded-lg border border-emerald-900/60 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-300">
            {emailTestMessage}
          </div>
        ) : null}

        <div className={`grid grid-cols-1 gap-3 ${editingScheduleId ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          <button
            type="button"
            onClick={onTestEmail}
            disabled={testingEmail || loading || users.length === 0 || !selectedUser?.has_email}
            className="w-full rounded-lg border border-cyan-700 bg-[#06101f] px-4 py-3 text-sm font-bold tracking-[0.15em] text-cyan-300 transition-colors hover:bg-cyan-950/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {testingEmail ? t.testingEmail : t.testEmail}
          </button>
          <button
            type="submit"
            disabled={submitting || loading || users.length === 0}
            className="w-full rounded-lg bg-cyan-600 px-4 py-3 text-sm font-bold tracking-[0.25em] text-[#04131f] transition-colors hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? t.submitting : editingScheduleId ? t.update : t.submit}
          </button>
          {editingScheduleId ? (
            <button
              type="button"
              onClick={onCancelEdit}
              className="w-full rounded-lg border border-slate-700 bg-[#06101f] px-4 py-3 text-sm font-bold tracking-[0.15em] text-slate-300 transition-colors hover:bg-slate-900/60"
            >
              {t.cancelEdit}
            </button>
          ) : null}
        </div>
      </form>
    </section>
  );
}
