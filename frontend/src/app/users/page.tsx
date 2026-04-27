"use client";

import { useState, useEffect, useMemo, useCallback, type FormEvent } from "react";
import {
  Users, Shield, Plus, Pencil, Trash2, X, Save, Key, Building2, Mail, CheckSquare,
} from "lucide-react";
import { useLanguage } from "@/shared/i18n/language";
import { useAuth } from "@/shared/auth-context";
import { apiUrl } from "@/shared/api";
import { authFetch } from "@/shared/auth";
import { useDcimStore } from "@/store/useDcimStore";
import { useShallow } from "zustand/react/shallow";

type UserRecord = {
  username: string;
  name: string;
  role: string;
  email: string;
  department: string;
  title: string;
  group: string[];
  responsible_equipment: string[];
  has_email: boolean;
  line_id: string;
};

const GROUPS = ["廠務", "IT", "網路", "資安", "管理"];
const ROLES = ["admin", "operator", "viewer"];
const DEPARTMENTS = ["廠務處", "IT部", "網路組", "資安組", "管理處"];

const inputClass =
  "w-full rounded-lg border border-[#1e3a8a] bg-[#06101f] px-4 py-2.5 text-slate-100 outline-none transition-colors focus:border-cyan-500 text-sm";
const selectClass =
  "w-full rounded-lg border border-[#1e3a8a] bg-[#06101f] px-4 py-2.5 text-slate-100 outline-none transition-colors focus:border-cyan-500 text-sm appearance-none";
const labelClass = "mb-1.5 block text-[11px] font-bold tracking-widest text-slate-400 uppercase";

export default function UsersPage() {
  const { language } = useLanguage();
  const { user: authUser } = useAuth();
  const isAdmin = authUser?.role === "admin";

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    name: "",
    role: "operator",
    email: "",
    department: "",
    title: "",
    group: [] as string[],
    responsible_equipment: [] as string[],
  });

  // Get racks from store for dynamic equipment list
  const racks = useDcimStore(useShallow((s) => s.racks));
  const equipmentOptions = useMemo(() => {
    const names = racks.map((r) => r.name);
    return [...new Set(names)].sort();
  }, [racks]);

  const t = useMemo(() => {
    if (language === "en") {
      return {
        title: "USER & PERMISSION MANAGEMENT",
        subtitle: "Role-Based Access Control & Equipment Assignment",
        addUser: "Add User",
        editUser: "Edit User",
        department: "Department",
        name: "Full Name",
        username: "Username",
        password: "Password",
        passwordHint: "Leave blank to keep current",
        jobTitle: "Job Title",
        group: "Group",
        role: "Permission Role",
        email: "Email",
        equipment: "Responsible Equipment",
        save: "Save",
        cancel: "Cancel",
        deleteConfirm: "Disable this user account?",
        edit: "Edit",
        disable: "Disable",
        resetPw: "Reset PW",
        noPermission: "Admin privileges required. Please log in with an admin account.",
        noUsers: "No users found.",
        actions: "Actions",
      };
    }
    return {
      title: "使用者與權限管理",
      subtitle: "角色權限控制與設備責任指派",
      addUser: "新增使用者",
      editUser: "編輯使用者",
      department: "單位",
      name: "姓名",
      username: "帳號",
      password: "密碼",
      passwordHint: "留空表示不修改",
      jobTitle: "職務",
      group: "群組",
      role: "權限",
      email: "Email",
      equipment: "負責設備",
      save: "儲存",
      cancel: "取消",
      deleteConfirm: "確定要停用此帳號嗎？",
      edit: "編輯",
      disable: "停用",
      resetPw: "重設密碼",
      noPermission: "需要管理員權限。請使用 admin 帳號登入。",
      noUsers: "尚無使用者資料。",
      actions: "操作",
    };
  }, [language]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch(apiUrl("/api/auth/users"), { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load users");
      const json = await res.json();
      setUsers((json.data || []) as UserRecord[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void loadUsers();
  }, [isAdmin, loadUsers]);

  const resetForm = () => {
    setFormData({
      username: "", password: "", name: "", role: "operator",
      email: "", department: "", title: "", group: [], responsible_equipment: [],
    });
    setEditingUser(null);
    setShowForm(false);
  };

  const openEditForm = (u: UserRecord) => {
    setFormData({
      username: u.username,
      password: "",
      name: u.name,
      role: u.role,
      email: u.email,
      department: u.department,
      title: u.title,
      group: [...u.group],
      responsible_equipment: [...u.responsible_equipment],
    });
    setEditingUser(u.username);
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      if (editingUser) {
        // Update
        const body: Record<string, unknown> = {
          name: formData.name,
          role: formData.role,
          email: formData.email,
          department: formData.department,
          title: formData.title,
          group: formData.group,
          responsible_equipment: formData.responsible_equipment,
        };
        if (formData.password) body.password = formData.password;

        const res = await authFetch(apiUrl(`/api/auth/users/${editingUser}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json?.detail || "Update failed");
        }
      } else {
        // Create
        if (!formData.username || !formData.password) {
          setError("Username and password are required");
          setSubmitting(false);
          return;
        }
        const res = await authFetch(apiUrl("/api/auth/users"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json?.detail || "Creation failed");
        }
      }
      resetForm();
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisable = async (username: string) => {
    if (!window.confirm(t.deleteConfirm)) return;
    try {
      const res = await authFetch(apiUrl(`/api/auth/users/${username}`), { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.detail || "Failed");
      }
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  };

  const toggleArrayItem = (arr: string[], item: string): string[] =>
    arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];

  // ─── Access Gate ────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center border border-red-900/50 bg-red-950/10 rounded-xl p-12 max-w-lg">
          <Shield size={64} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-2xl font-black text-red-400 tracking-widest mb-3">ACCESS DENIED</h2>
          <p className="text-slate-400 text-sm">{t.noPermission}</p>
        </div>
      </div>
    );
  }

  // ─── Main Render ────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-8 pb-20 w-full h-full flex flex-col">
      <header className="mb-6 flex items-center justify-between bg-[#0a1e3f]/30 p-4 rounded-xl border border-[#1e3a8a]">
        <div className="flex items-center gap-4">
          <Users size={32} className="text-[#4ea8de]" />
          <div>
            <h1 className="text-2xl font-black text-[#4ea8de] tracking-widest uppercase">{t.title}</h1>
            <p className="text-slate-400 text-xs font-mono tracking-widest mt-1">{t.subtitle}</p>
          </div>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-cyan-600 text-[#04131f] px-5 py-2.5 rounded-lg font-bold text-sm tracking-widest hover:bg-cyan-500 transition-colors"
        >
          <Plus size={16} /> {t.addUser}
        </button>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-900/60 bg-red-950/20 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* ─── Modal Form ─── */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center backdrop-blur-sm">
          <div
            className="bg-[#020b1a] border border-[#1e3a8a] rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-[0_0_60px_rgba(30,58,138,0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black tracking-widest text-cyan-300">
                {editingUser ? t.editUser : t.addUser}
              </h2>
              <button onClick={resetForm} className="text-slate-500 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className={labelClass}>{t.username}</span>
                  <input
                    value={formData.username}
                    onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))}
                    className={inputClass}
                    disabled={!!editingUser}
                    required
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>{t.password}</span>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                    className={inputClass}
                    placeholder={editingUser ? t.passwordHint : ""}
                    required={!editingUser}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className={labelClass}>{t.name}</span>
                  <input
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    className={inputClass}
                    required
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>{t.department}</span>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData((p) => ({ ...p, department: e.target.value }))}
                    className={selectClass}
                  >
                    <option value="">--</option>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className={labelClass}>{t.jobTitle}</span>
                  <input
                    value={formData.title}
                    onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                    className={inputClass}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>{t.role}</span>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value }))}
                    className={selectClass}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className={labelClass}>{t.email}</span>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  className={inputClass}
                />
              </label>

              {/* ── Group Checkboxes ── */}
              <div>
                <span className={labelClass}>{t.group}</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {GROUPS.map((g) => (
                    <label
                      key={g}
                      className={`flex items-center gap-2 rounded border px-3 py-2 cursor-pointer text-sm transition-colors ${
                        formData.group.includes(g)
                          ? "border-cyan-500 bg-cyan-900/30 text-cyan-300"
                          : "border-[#1e3a8a] bg-[#06101f] text-slate-400 hover:border-cyan-800"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.group.includes(g)}
                        onChange={() => setFormData((p) => ({ ...p, group: toggleArrayItem(p.group, g) }))}
                        className="h-4 w-4 accent-cyan-500"
                      />
                      {g}
                    </label>
                  ))}
                </div>
              </div>

              {/* ── Responsible Equipment Checkboxes ── */}
              <div>
                <span className={labelClass}>{t.equipment}</span>
                <label className="flex items-center gap-2 rounded border border-amber-700/60 bg-amber-900/10 px-3 py-2 cursor-pointer text-sm text-amber-300 hover:bg-amber-900/20 transition-colors mb-2 mt-1 w-fit">
                  <input
                    type="checkbox"
                    checked={equipmentOptions.length > 0 && formData.responsible_equipment.length === equipmentOptions.length}
                    onChange={(e) => {
                      setFormData((p) => ({
                        ...p,
                        responsible_equipment: e.target.checked ? [...equipmentOptions] : [],
                      }));
                    }}
                    className="h-4 w-4 accent-amber-500"
                  />
                  {language === "en" ? "Select All" : "全選"}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                  {equipmentOptions.map((eq) => (
                    <label
                      key={eq}
                      className={`flex items-center gap-2 rounded border px-3 py-2 cursor-pointer text-xs transition-colors ${
                        formData.responsible_equipment.includes(eq)
                          ? "border-emerald-500 bg-emerald-900/20 text-emerald-300"
                          : "border-[#1e3a8a] bg-[#06101f] text-slate-400 hover:border-emerald-800"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={formData.responsible_equipment.includes(eq)}
                        onChange={() =>
                          setFormData((p) => ({
                            ...p,
                            responsible_equipment: toggleArrayItem(p.responsible_equipment, eq),
                          }))
                        }
                        className="h-3.5 w-3.5 accent-emerald-500"
                      />
                      {eq}
                    </label>
                  ))}
                  {equipmentOptions.length === 0 && (
                    <span className="col-span-full text-slate-600 text-xs">No racks configured</span>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 bg-cyan-600 text-[#04131f] py-3 rounded-lg font-bold text-sm tracking-widest hover:bg-cyan-500 transition-colors disabled:opacity-60"
                >
                  <Save size={16} /> {submitting ? "..." : t.save}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-3 rounded-lg border border-slate-700 text-slate-300 font-bold text-sm tracking-widest hover:bg-slate-900/60 transition-colors"
                >
                  {t.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Users Table ─── */}
      <div className="flex-1 overflow-auto custom-scrollbar rounded-xl border border-[#1e3a8a] bg-[#020b1a]">
        {loading ? (
          <div className="p-8 text-cyan-300 tracking-widest text-center">LOADING...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-slate-400 text-center">{t.noUsers}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e3a8a] text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                <th className="px-4 py-3 text-left">{t.department}</th>
                <th className="px-4 py-3 text-left">{t.name}</th>
                <th className="px-4 py-3 text-left">{t.username}</th>
                <th className="px-4 py-3 text-left">{t.jobTitle}</th>
                <th className="px-4 py-3 text-left">{t.group}</th>
                <th className="px-4 py-3 text-left">{t.role}</th>
                <th className="px-4 py-3 text-left">{t.email}</th>
                <th className="px-4 py-3 text-left">{t.equipment}</th>
                <th className="px-4 py-3 text-center">{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.username}
                  className="border-b border-[#1e3a8a]/50 hover:bg-[#0a1e3f]/40 transition-colors"
                >
                  <td className="px-4 py-3 text-slate-300">{u.department || "-"}</td>
                  <td className="px-4 py-3 text-white font-bold">{u.name}</td>
                  <td className="px-4 py-3 text-cyan-400 font-mono">{u.username}</td>
                  <td className="px-4 py-3 text-slate-300">{u.title || "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(u.group || []).map((g) => (
                        <span key={g} className="rounded bg-cyan-900/40 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300">
                          {g}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-1 text-[10px] font-bold tracking-widest ${
                      u.role === "admin"
                        ? "bg-rose-900/40 text-rose-300"
                        : u.role === "operator"
                          ? "bg-cyan-900/40 text-cyan-300"
                          : "bg-slate-800 text-slate-400"
                    }`}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono truncate max-w-[160px]">
                    {u.email || "-"}
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <div className="flex flex-wrap gap-1">
                      {(u.responsible_equipment || []).slice(0, 3).map((eq) => (
                        <span key={eq} className="rounded bg-emerald-900/30 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 truncate max-w-[80px]">
                          {eq}
                        </span>
                      ))}
                      {(u.responsible_equipment || []).length > 3 && (
                        <span className="text-[10px] text-slate-500">+{u.responsible_equipment.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEditForm(u)}
                        className="rounded border border-cyan-800 bg-[#06101f] px-3 py-1.5 text-[10px] font-bold tracking-widest text-cyan-300 hover:bg-cyan-950/30 transition-colors"
                      >
                        <Pencil size={12} className="inline mr-1" />{t.edit}
                      </button>
                      <button
                        onClick={() => handleDisable(u.username)}
                        disabled={u.username === authUser?.username}
                        className="rounded border border-red-900/50 bg-red-950/20 px-3 py-1.5 text-[10px] font-bold tracking-widest text-red-300 hover:bg-red-950/40 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Trash2 size={12} className="inline mr-1" />{t.disable}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
