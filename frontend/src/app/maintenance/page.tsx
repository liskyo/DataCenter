"use client";

import { FormEvent, useMemo } from "react";
import { LifeBuoy } from "lucide-react";
import { useLanguage } from "@/shared/i18n/language";
import { getMaintenanceCopy } from "./copy";
import { MaintenanceForm } from "./MaintenanceForm";
import { MaintenanceScheduleCard } from "./MaintenanceScheduleCard";
import { useMaintenanceData } from "./useMaintenanceData";

export default function MaintenancePage() {
  const { language } = useLanguage();
  const t = useMemo(() => getMaintenanceCopy(language), [language]);
  const {
    schedules,
    users,
    loading,
    submitting,
    testingEmail,
    deletingScheduleId,
    editingScheduleId,
    error,
    emailTestMessage,
    form,
    selectedUser,
    setForm,
    resetForm,
    startEdit,
    handleTestEmail,
    handleSubmit,
    handleDelete,
  } = useMaintenanceData(t);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleSubmit();
  };

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

      <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-6">
        <MaintenanceForm
          t={t}
          form={form}
          users={users}
          selectedUser={selectedUser}
          loading={loading}
          submitting={submitting}
          testingEmail={testingEmail}
          editingScheduleId={editingScheduleId}
          error={error}
          emailTestMessage={emailTestMessage}
          onFormChange={(updater) => setForm(updater)}
          onSubmit={onSubmit}
          onTestEmail={handleTestEmail}
          onCancelEdit={resetForm}
        />

        <section className="space-y-4">
          {loading ? (
            <div className="rounded-xl border border-[#1e3a8a] bg-[#020b1a] p-6 text-sm tracking-widest text-cyan-300">
              LOADING...
            </div>
          ) : schedules.length === 0 ? (
            <div className="rounded-xl border border-[#1e3a8a] bg-[#020b1a] p-6 text-slate-400">
              {t.empty}
            </div>
          ) : schedules.map((task) => (
            <MaintenanceScheduleCard
              key={task.id}
              task={task}
              t={t}
              isDeleting={deletingScheduleId === task.id}
              onEdit={startEdit}
              onDelete={handleDelete}
            />
          ))}
        </section>
      </div>
    </div>
  );
}
