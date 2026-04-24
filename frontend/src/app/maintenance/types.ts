"use client";

export type MaintenanceSchedule = {
  id: string;
  target: string;
  task_type: string;
  scheduled_at: string;
  recurrence_days: number;
  status: string;
  assignee_username: string;
  assignee_name: string;
  assignee_role: string;
  notify_email: boolean;
  reminder_email: string;
  reminder_sent: boolean;
  reminder_sent_at: number;
  notes: string;
  created_at: number;
};

export type MaintenanceUser = {
  username: string;
  name: string;
  role: string;
  has_email: boolean;
};

export type MaintenanceFormState = {
  target: string;
  taskType: string;
  scheduledDate: string;
  scheduledTime: string;
  recurrenceDays: string;
  assigneeUsername: string;
  notifyEmail: boolean;
  notes: string;
};

export type MaintenanceCopy = {
  title: string;
  subtitle: string;
  createTitle: string;
  editTitle: string;
  target: string;
  task: string;
  schedule: string;
  scheduleDate: string;
  scheduleTime: string;
  recurrence: string;
  recurrenceHint: string;
  assigned: string;
  notify: string;
  notes: string;
  submit: string;
  update: string;
  edit: string;
  delete: string;
  cancelEdit: string;
  sentAt: string;
  notSent: string;
  deleteConfirm: string;
  testEmail: string;
  testingEmail: string;
  submitting: string;
  empty: string;
  enabled: string;
  disabled: string;
  emailMissing: string;
  loadError: string;
  testEmailSuccess: string;
  placeholderTarget: string;
  placeholderTask: string;
  placeholderTime: string;
  placeholderRecurrenceDays: string;
  placeholderNotes: string;
  invalidTime: string;
  invalidRecurrenceDays: string;
  recurrenceOneTime: string;
};
