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

export type NotifyBefore = {
  sameDay: boolean;
  oneDayBefore: boolean;
  oneWeekBefore: boolean;
  oneMonthBefore: boolean;
};

export type MaintenanceFormState = {
  targetCategory: string;       // equipment category key (e.g. "crac", "ups")
  target: string;               // display name (for backward compat / custom input)
  taskType: string;
  scheduledDate: string;
  scheduledTime: string;
  notifyBefore: NotifyBefore;
  maintenanceCycle: string;     // "monthly" | "quarterly" | ... | "custom"
  customCycleDays: string;
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
  targetCategory: string;
  task: string;
  schedule: string;
  scheduleDate: string;
  scheduleTime: string;
  notifyBefore: string;
  notifyBeforeHint: string;
  notifyBeforeSameDay: string;
  notifyBeforeOneDay: string;
  notifyBeforeOneWeek: string;
  notifyBeforeOneMonth: string;
  maintenanceCycle: string;
  maintenanceCycleHint: string;
  customDaysLabel: string;
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
  placeholderNotes: string;
  invalidTime: string;
  selectCategory: string;
  selectTask: string;
  customInput: string;
};
