"use client";

import type { FormEvent } from "react";
import type { MaintenanceCopy, MaintenanceFormState, MaintenanceUser } from "./types";

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
  return (
    <section className="rounded-xl border border-[#1e3a8a] bg-[#020b1a] p-6">
      <div className="mb-5">
        <h2 className="text-lg font-black tracking-widest text-cyan-300">
          {editingScheduleId ? t.editTitle : t.createTitle}
        </h2>
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        <label className="block">
          <span className="mb-2 block text-xs font-bold tracking-widest text-slate-400">{t.target}</span>
          <input
            value={form.target}
            onChange={(event) => onFormChange((prev) => ({ ...prev, target: event.target.value }))}
            className="w-full rounded-lg border border-[#1e3a8a] bg-[#06101f] px-4 py-3 text-slate-100 outline-none transition-colors focus:border-cyan-500"
            placeholder={t.placeholderTarget}
            required
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-bold tracking-widest text-slate-400">{t.task}</span>
          <input
            value={form.taskType}
            onChange={(event) => onFormChange((prev) => ({ ...prev, taskType: event.target.value }))}
            className="w-full rounded-lg border border-[#1e3a8a] bg-[#06101f] px-4 py-3 text-slate-100 outline-none transition-colors focus:border-cyan-500"
            placeholder={t.placeholderTask}
            required
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-bold tracking-widest text-slate-400">{t.schedule}</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_140px]">
            <input
              type="date"
              value={form.scheduledDate}
              onChange={(event) => onFormChange((prev) => ({ ...prev, scheduledDate: event.target.value }))}
              className="w-full rounded-lg border border-[#1e3a8a] bg-[#06101f] px-4 py-3 text-slate-100 outline-none transition-colors focus:border-cyan-500"
              required
            />
            <input
              type="text"
              inputMode="numeric"
              value={form.scheduledTime}
              onChange={(event) => onFormChange((prev) => ({ ...prev, scheduledTime: event.target.value }))}
              className="w-full rounded-lg border border-[#1e3a8a] bg-[#06101f] px-4 py-3 text-slate-100 outline-none transition-colors focus:border-cyan-500"
              placeholder={t.placeholderTime}
              maxLength={5}
              required
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] tracking-wide text-slate-500">
            <span>{t.scheduleDate}</span>
            <span>{t.scheduleTime}</span>
          </div>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-bold tracking-widest text-slate-400">{t.assigned}</span>
          <select
            value={form.assigneeUsername}
            onChange={(event) => onFormChange((prev) => ({ ...prev, assigneeUsername: event.target.value }))}
            className="w-full rounded-lg border border-[#1e3a8a] bg-[#06101f] px-4 py-3 text-slate-100 outline-none transition-colors focus:border-cyan-500"
            required
          >
            {users.map((user) => (
              <option key={user.username} value={user.username}>
                {user.name} ({user.username})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-2 block text-xs font-bold tracking-widest text-slate-400">{t.notes}</span>
          <textarea
            value={form.notes}
            onChange={(event) => onFormChange((prev) => ({ ...prev, notes: event.target.value }))}
            className="min-h-[96px] w-full rounded-lg border border-[#1e3a8a] bg-[#06101f] px-4 py-3 text-slate-100 outline-none transition-colors focus:border-cyan-500"
            placeholder={t.placeholderNotes}
          />
        </label>

        <label className="flex items-start gap-3 rounded-lg border border-cyan-900/50 bg-[#06101f] px-4 py-3">
          <input
            type="checkbox"
            checked={form.notifyEmail}
            onChange={(event) => onFormChange((prev) => ({ ...prev, notifyEmail: event.target.checked }))}
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
