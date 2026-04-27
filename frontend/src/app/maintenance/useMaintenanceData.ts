"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/shared/api";
import { authFetch } from "@/shared/auth";
import type {
  MaintenanceCopy,
  MaintenanceFormState,
  MaintenanceSchedule,
  MaintenanceUser,
} from "./types";
import {
  splitScheduleDateTime,
  extractNotifyBefore,
  extractNotesText,
  extractTargetCategory,
  buildNotesPayload,
} from "./utils";
import {
  daysToMaintenanceCycle,
  maintenanceCycleToDays,
  type MaintenanceCycleKey,
} from "./smartDefaults";

const EMPTY_FORM: MaintenanceFormState = {
  targetCategory: "",
  target: "",
  taskType: "",
  scheduledDate: "",
  scheduledTime: "08:00",
  notifyBefore: {
    sameDay: true,
    oneDayBefore: true,
    oneWeekBefore: false,
    oneMonthBefore: false,
  },
  maintenanceCycle: "quarterly",
  customCycleDays: "30",
  assigneeUsername: "",
  notifyEmail: true,
  notes: "",
};

export function useMaintenanceData(t: MaintenanceCopy) {
  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [users, setUsers] = useState<MaintenanceUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [deletingScheduleId, setDeletingScheduleId] = useState<string | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [emailTestMessage, setEmailTestMessage] = useState("");
  const [form, setForm] = useState<MaintenanceFormState>(EMPTY_FORM);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [usersRes, schedulesRes] = await Promise.all([
          authFetch(apiUrl("/api/auth/users"), { cache: "no-store" }),
          authFetch(apiUrl("/api/maintenance/schedules"), { cache: "no-store" }),
        ]);
        if (!usersRes.ok || !schedulesRes.ok) {
          throw new Error(t.loadError);
        }

        const usersJson = await usersRes.json();
        const schedulesJson = await schedulesRes.json();
        if (cancelled) return;

        const nextUsers = (usersJson.data || []) as MaintenanceUser[];
        setUsers(nextUsers);
        setSchedules((schedulesJson.data || []) as MaintenanceSchedule[]);
        setForm((prev) => ({
          ...prev,
          assigneeUsername: prev.assigneeUsername || nextUsers[0]?.username || "",
        }));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t.loadError);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [t.loadError]);

  const selectedUser = useMemo(
    () => users.find((user) => user.username === form.assigneeUsername) || null,
    [form.assigneeUsername, users]
  );

  const resetForm = useCallback(() => {
    setEditingScheduleId(null);
    setForm({
      ...EMPTY_FORM,
      assigneeUsername: users[0]?.username || "",
    });
  }, [users]);

  const startEdit = useCallback((task: MaintenanceSchedule) => {
    const { date, time } = splitScheduleDateTime(task.scheduled_at);
    const { cycle, customDays } = daysToMaintenanceCycle(task.recurrence_days);
    const notifyBefore = extractNotifyBefore(task.notes);
    const targetCategory = extractTargetCategory(task.notes);
    const userNotes = extractNotesText(task.notes);

    setEditingScheduleId(task.id);
    setError("");
    setEmailTestMessage("");
    setForm({
      targetCategory: targetCategory || "",
      target: task.target,
      taskType: task.task_type,
      scheduledDate: date,
      scheduledTime: time || "08:00",
      notifyBefore,
      maintenanceCycle: cycle,
      customCycleDays: customDays || "30",
      assigneeUsername: task.assignee_username,
      notifyEmail: task.notify_email,
      notes: userNotes,
    });
  }, []);

  const handleTestEmail = useCallback(async () => {
    if (!form.assigneeUsername) return;

    setTestingEmail(true);
    setError("");
    setEmailTestMessage("");

    try {
      const res = await authFetch(apiUrl("/api/maintenance/test-email"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.assigneeUsername }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.detail || "Failed to send test email");
      }

      setEmailTestMessage(`${t.testEmailSuccess} (${json.email || form.assigneeUsername})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send test email");
    } finally {
      setTestingEmail(false);
    }
  }, [form.assigneeUsername, t.testEmailSuccess]);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError("");
    setEmailTestMessage("");

    const normalizedTime = form.scheduledTime.trim();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(normalizedTime)) {
      setError(t.invalidTime);
      setSubmitting(false);
      return false;
    }

    const recurrenceDays = maintenanceCycleToDays(
      form.maintenanceCycle as MaintenanceCycleKey,
      form.customCycleDays
    );

    const notesPayload = buildNotesPayload(
      form.notes,
      form.notifyBefore,
      form.targetCategory,
      form.maintenanceCycle as MaintenanceCycleKey
    );

    const scheduledAt = `${form.scheduledDate}T${normalizedTime}`;

    try {
      const isEditing = Boolean(editingScheduleId);
      const res = await authFetch(
        apiUrl(
          isEditing
            ? `/api/maintenance/schedules/${editingScheduleId}`
            : "/api/maintenance/schedules"
        ),
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target: form.target,
            task_type: form.taskType,
            scheduled_at: scheduledAt,
            recurrence_days: recurrenceDays,
            assignee_username: form.assigneeUsername,
            notify_email: form.notifyEmail,
            notes: notesPayload,
          }),
        }
      );

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          json?.detail || (isEditing ? "Failed to update schedule" : "Failed to create schedule")
        );
      }

      const nextSchedule = json.data as MaintenanceSchedule;
      setSchedules((prev) =>
        (isEditing
          ? prev.map((task) => (task.id === editingScheduleId ? nextSchedule : task))
          : [...prev, nextSchedule]
        ).sort((left, right) => left.scheduled_at.localeCompare(right.scheduled_at))
      );
      resetForm();
      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editingScheduleId
            ? "Failed to update schedule"
            : "Failed to create schedule"
      );
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [editingScheduleId, form, resetForm, t.invalidTime]);

  const handleDelete = useCallback(
    async (scheduleId: string) => {
      if (!window.confirm(t.deleteConfirm)) return;

      setDeletingScheduleId(scheduleId);
      setError("");
      setEmailTestMessage("");

      try {
        const res = await authFetch(apiUrl(`/api/maintenance/schedules/${scheduleId}`), {
          method: "DELETE",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json?.detail || "Failed to delete schedule");
        }

        setSchedules((prev) => prev.filter((task) => task.id !== scheduleId));
        if (editingScheduleId === scheduleId) {
          resetForm();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete schedule");
      } finally {
        setDeletingScheduleId(null);
      }
    },
    [editingScheduleId, resetForm, t.deleteConfirm]
  );

  return {
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
  };
}
