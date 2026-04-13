"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe, Save, RotateCcw } from "lucide-react";
import { useLanguage } from "@/shared/i18n/language";

type DeviceType = "server" | "rack" | "tank" | "cdu" | "switch";
type CommMethod =
  | "agent_active_pull"
  | "redfish_poll"
  | "streaming_telemetry_gnmi_openconfig"
  | "bmc"
  | "snmp_poll_trap"
  ;

type CommProfile = Record<
  DeviceType,
  {
    method: CommMethod;
    endpoint: string;
    enabled: boolean;
    notes: string;
  }
>;

const STORAGE_KEY = "dcim.network.comm.profile.v1";

const DEFAULT_PROFILE: CommProfile = {
  server: {
    method: "agent_active_pull",
    endpoint: "http://127.0.0.1:9000/ingest",
    enabled: true,
    notes: "",
  },
  rack: {
    method: "streaming_telemetry_gnmi_openconfig",
    endpoint: "kafka://localhost:29093/telemetry",
    enabled: true,
    notes: "",
  },
  tank: {
    method: "streaming_telemetry_gnmi_openconfig",
    endpoint: "kafka://localhost:29093/telemetry",
    enabled: true,
    notes: "",
  },
  cdu: {
    method: "streaming_telemetry_gnmi_openconfig",
    endpoint: "kafka://localhost:29093/telemetry",
    enabled: true,
    notes: "",
  },
  switch: {
    method: "snmp_poll_trap",
    endpoint: "snmp://10.10.10.30",
    enabled: true,
    notes: "",
  },
};

function mergeProfile(raw: unknown): CommProfile {
  if (!raw || typeof raw !== "object") return DEFAULT_PROFILE;
  const input = raw as Partial<CommProfile>;
  return {
    server: { ...DEFAULT_PROFILE.server, ...(input.server || {}) },
    rack: { ...DEFAULT_PROFILE.rack, ...(input.rack || {}) },
    tank: { ...DEFAULT_PROFILE.tank, ...(input.tank || {}) },
    cdu: { ...DEFAULT_PROFILE.cdu, ...(input.cdu || {}) },
    switch: { ...DEFAULT_PROFILE.switch, ...(input.switch || {}) },
  };
}

export default function NetworkPage() {
  const { language } = useLanguage();
  const isEn = language === "en";
  const [profile, setProfile] = useState<CommProfile>(DEFAULT_PROFILE);
  const [savedAt, setSavedAt] = useState<string>("");

  const t = useMemo(
    () =>
      isEn
        ? {
            title: "Network Communication",
            subtitle: "Configure how each facility device connects to DCIM",
            save: "Save Local Profile",
            reset: "Restore Defaults",
            saved: "Saved",
            method: "Method",
            endpoint: "Endpoint / Path",
            enabled: "Enabled",
            notes: "Notes",
            section: "Direct Device-to-DCIM Settings",
            rows: {
              server: "Server",
              rack: "Rack",
              tank: "Tank",
              cdu: "CDU",
              switch: "Switch",
            },
            methods: {
              agent_active_pull: "Agent active pull (current default)",
              redfish_poll: "Redfish poll",
              streaming_telemetry_gnmi_openconfig: "Streaming Telemetry (gNMI / OpenConfig)",
              bmc: "BMC",
              snmp_poll_trap: "SNMP poll + trap",
            },
          }
        : {
            title: "網路通訊設定",
            subtitle: "設定資料中心設備如何連接到 DCIM 系統",
            save: "儲存本機設定",
            reset: "還原預設",
            saved: "已儲存",
            method: "通訊方式",
            endpoint: "端點 / 路徑",
            enabled: "啟用",
            notes: "備註",
            section: "設備連線設定",
            rows: {
              server: "伺服器",
              rack: "機櫃",
              tank: "液冷槽",
              cdu: "CDU",
              switch: "交換器",
            },
            methods: {
              agent_active_pull: "Agent 主動 pull（現行預設）",
              redfish_poll: "Redfish 輪詢",
              streaming_telemetry_gnmi_openconfig: "Streaming Telemetry（gNMI / OpenConfig）",
              bmc: "BMC",
              snmp_poll_trap: "SNMP 輪詢 + Trap",
            },
          },
    [isEn],
  );

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setProfile(mergeProfile(JSON.parse(raw)));
    } catch {
      setProfile(DEFAULT_PROFILE);
    }
  }, []);

  const saveProfile = () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    setSavedAt(new Date().toLocaleTimeString());
  };

  const resetProfile = () => {
    setProfile(DEFAULT_PROFILE);
    setSavedAt("");
  };

  const update = <K extends keyof CommProfile[DeviceType]>(
    device: DeviceType,
    key: K,
    value: CommProfile[DeviceType][K],
  ) => {
    setProfile((prev) => ({
      ...prev,
      [device]: {
        ...prev[device],
        [key]: value,
      },
    }));
  };

  const deviceOrder: DeviceType[] = ["server", "rack", "tank", "cdu", "switch"];
  const methodOptions: CommMethod[] = [
    "agent_active_pull",
    "redfish_poll",
    "streaming_telemetry_gnmi_openconfig",
    "bmc",
    "snmp_poll_trap",
  ];

  return (
    <div className="p-8 pb-20 max-w-7xl mx-auto">
      <header className="mb-6 flex items-center gap-4 bg-[#0a1e3f]/30 p-4 rounded-xl border border-[#1e3a8a]">
        <Globe size={32} className="text-[#4ea8de]" />
        <div>
          <h1 className="text-2xl font-black text-[#4ea8de] tracking-widest uppercase shadow-sm">
             {t.title}
          </h1>
          <p className="text-slate-400 text-xs font-mono tracking-widest mt-1">{t.subtitle}</p>
        </div>
      </header>

      <section className="rounded-xl border border-[#1e3a8a] bg-[#020b1a] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-[#7dd3fc]">{t.section}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={resetProfile}
              className="inline-flex items-center gap-1 rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            >
              <RotateCcw size={14} />
              {t.reset}
            </button>
            <button
              onClick={saveProfile}
              className="inline-flex items-center gap-1 rounded border border-cyan-600 bg-cyan-700/30 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-700/50"
            >
              <Save size={14} />
              {t.save}
            </button>
          </div>
        </div>
        {savedAt ? <p className="mb-3 text-xs text-emerald-400">{t.saved}: {savedAt}</p> : null}

        <div className="overflow-x-auto">
          <table className="min-w-[1024px] w-full text-sm border-collapse">
            <thead>
              <tr className="text-slate-300 border-b border-slate-700">
                <th className="py-2 px-2 text-left">Device</th>
                <th className="py-2 px-2 text-left">{t.enabled}</th>
                <th className="py-2 px-2 text-left">{t.method}</th>
                <th className="py-2 px-2 text-left">{t.endpoint}</th>
                <th className="py-2 px-2 text-left">{t.notes}</th>
              </tr>
            </thead>
            <tbody>
              {deviceOrder.map((device) => (
                <tr key={device} className="border-b border-slate-800">
                  <td className="py-2 px-2 font-semibold text-slate-100">{t.rows[device]}</td>
                  <td className="py-2 px-2">
                    <input
                      type="checkbox"
                      checked={profile[device].enabled}
                      onChange={(e) => update(device, "enabled", e.target.checked)}
                      className="h-4 w-4 accent-cyan-500"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <select
                      value={profile[device].method}
                      onChange={(e) => update(device, "method", e.target.value as CommMethod)}
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
                    >
                      {methodOptions.map((method) => (
                        <option key={method} value={method}>
                          {t.methods[method]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-2">
                    <input
                      value={profile[device].endpoint}
                      onChange={(e) => update(device, "endpoint", e.target.value)}
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      value={profile[device].notes}
                      onChange={(e) => update(device, "notes", e.target.value)}
                      className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      </div>
  );
}
