"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Globe, RotateCcw, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useLanguage } from "@/shared/i18n/language";
import { useDcimStore } from "@/store/useDcimStore";
import {
  CommMethod,
  DeviceCommConfig,
  DEVICE_TYPE_ORDER,
  DeviceType,
} from "@/shared/networkComm";

function commFieldsByMethod(method: CommMethod): Array<keyof DeviceCommConfig> {
  switch (method) {
    case "agent_active_pull":
      return ["port", "endpoint", "pollIntervalSec"];
    case "redfish_poll":
      return ["port", "endpoint", "username", "password", "pollIntervalSec"];
    case "streaming_telemetry_gnmi_openconfig":
      return ["port", "endpoint", "mqttTopic"];
    case "bmc":
      return ["port", "username", "password"];
    case "snmp_poll_trap":
      return ["port", "snmpCommunity", "pollIntervalSec"];
    default:
      return ["endpoint"];
  }
}

export default function NetworkPage() {
  const { language } = useLanguage();
  const isEn = language === "en";
  const configs = useDcimStore((s) => s.deviceCommConfigs);
  const updateDeviceCommConfig = useDcimStore((s) => s.updateDeviceCommConfig);
  const addDeviceCommConfig = useDcimStore((s) => s.addDeviceCommConfig);
  const removeDeviceCommConfig = useDcimStore((s) => s.removeDeviceCommConfig);
  const resetDeviceCommConfigs = useDcimStore((s) => s.resetDeviceCommConfigs);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const t = useMemo(
    () =>
      isEn
        ? {
            title: "Network Communication",
            subtitle: "Configure model, device type, and communication method by device",
            persistenceNote:
              "Changes are saved automatically with the digital twin profile in IndexedDB (single storage).",
            reset: "Restore Defaults",
            add: "Add Device Config",
            remove: "Remove",
            model: "Model",
            deviceType: "Device Type",
            method: "Method",
            endpoint: "Endpoint / Path",
            port: "Port",
            username: "Username",
            password: "Password",
            snmpCommunity: "SNMP Community",
            mqttTopic: "Topic / Stream",
            pollIntervalSec: "Poll Interval (sec)",
            enabled: "Enabled",
            notes: "Notes",
            section: "Device Communication Settings",
            rows: {
              server: "Server",
              rack: "Rack",
              tank: "Tank",
              cdu: "CDU",
              switch: "Switch",
              crac: "CRAC",
              power: "Power (PDU / UPS)",
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
            subtitle: "可依設備設定機型、Device 類型與通訊方式",
            persistenceNote: "變更會與機房雙生場景一併自動寫入 IndexedDB（單一儲存位置）。",
            reset: "還原預設",
            add: "新增設備設定",
            remove: "刪除",
            model: "機型",
            deviceType: "Device 類型",
            method: "通訊方式",
            endpoint: "端點 / 路徑",
            port: "連接埠",
            username: "帳號",
            password: "密碼",
            snmpCommunity: "SNMP Community",
            mqttTopic: "Topic / 串流",
            pollIntervalSec: "輪詢秒數",
            enabled: "啟用",
            notes: "備註",
            section: "設備連線設定",
            rows: {
              server: "伺服器",
              rack: "機櫃",
              tank: "液冷槽",
              cdu: "CDU",
              switch: "交換器",
              crac: "CRAC",
              power: "電力設備（PDU / UPS）",
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
    setExpandedRows((prev) => {
      const next: Record<string, boolean> = {};
      for (const row of configs) {
        next[row.id] = prev[row.id] ?? false;
      }
      return next;
    });
  }, [configs]);

  const resetProfile = () => {
    resetDeviceCommConfigs();
  };

  const update = <K extends keyof DeviceCommConfig>(
    id: string,
    key: K,
    value: DeviceCommConfig[K],
  ) => {
    updateDeviceCommConfig(id, key, value);
  };

  const addRow = () => {
    addDeviceCommConfig();
  };

  const removeRow = (id: string) => {
    removeDeviceCommConfig(id);
    setExpandedRows((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const toggleRowDetails = (id: string) => {
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const deviceOrder = [...DEVICE_TYPE_ORDER] as DeviceType[];
  const methodOptions: CommMethod[] = [
    "agent_active_pull",
    "redfish_poll",
    "streaming_telemetry_gnmi_openconfig",
    "bmc",
    "snmp_poll_trap",
  ];

  return (
    <div className="p-4 md:p-8 pb-20 w-full h-full flex flex-col min-w-0">
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
              onClick={addRow}
              className="inline-flex items-center gap-1 rounded border border-emerald-600 bg-emerald-700/20 px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-700/40"
            >
              <Plus size={14} />
              {t.add}
            </button>
            <button
              onClick={resetProfile}
              className="inline-flex items-center gap-1 rounded border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            >
              <RotateCcw size={14} />
              {t.reset}
            </button>
          </div>
        </div>
        <p className="mb-3 text-[11px] text-slate-500 leading-relaxed">{t.persistenceNote}</p>

        <div className="mb-2 text-[11px] text-slate-500">
          {isEn
            ? "Tip: details are collapsed by default; click Details to expand."
            : "提示：預設收合詳細設定，可點「詳細設定」展開。"}
        </div>
        <div className="network-table-wrap overflow-x-auto overflow-y-hidden rounded-lg border border-slate-800/80">
          <table className="network-config-table min-w-[1250px] w-full text-sm border-collapse">
            <thead>
              <tr className="text-slate-300 border-b border-slate-700">
                <th className="py-2 px-2 text-left">{t.model}</th>
                <th className="py-2 px-2 text-left">{t.deviceType}</th>
                <th className="py-2 px-2 text-left">{t.enabled}</th>
                <th className="py-2 px-2 text-left">{t.method}</th>
                <th className="py-2 px-2 text-left">{t.port}</th>
                <th className="py-2 px-2 text-left">{t.endpoint}</th>
                <th className="py-2 px-2 text-left">{isEn ? "Details" : "詳細設定"}</th>
                <th className="py-2 px-2 text-left">{t.remove}</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((row) => {
                const visibleFields = new Set(commFieldsByMethod(row.method));
                const show = (field: keyof DeviceCommConfig) => visibleFields.has(field);
                const isExpanded = !!expandedRows[row.id];
                return (
                  <Fragment key={row.id}>
                    <tr className="border-b border-slate-800">
                      <td className="py-2 px-2">
                        <input
                          value={row.model}
                          onChange={(e) => update(row.id, "model", e.target.value)}
                          className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <select
                          value={row.deviceType}
                          onChange={(e) => update(row.id, "deviceType", e.target.value as DeviceType)}
                          className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
                        >
                          {deviceOrder.map((device) => (
                            <option key={device} value={device}>
                              {t.rows[device]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="checkbox"
                          checked={row.enabled}
                          onChange={(e) => update(row.id, "enabled", e.target.checked)}
                          className="h-4 w-4 accent-cyan-500"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <div className="flex flex-col gap-1">
                          <select
                            value={row.method}
                            onChange={(e) => update(row.id, "method", e.target.value as CommMethod)}
                            className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
                            title={t.methods[row.method]}
                          >
                            {methodOptions.map((method) => (
                              <option key={method} value={method}>
                                {t.methods[method]}
                              </option>
                            ))}
                          </select>
                          <div className="text-[10px] text-slate-400 whitespace-normal break-words leading-tight">
                            {t.methods[row.method]}
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          value={row.port}
                          onChange={(e) => update(row.id, "port", e.target.value)}
                          className={`w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 ${show("port") ? "" : "opacity-40"}`}
                          disabled={!show("port")}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          value={row.endpoint}
                          onChange={(e) => update(row.id, "endpoint", e.target.value)}
                          className={`w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 ${show("endpoint") ? "" : "opacity-40"}`}
                          disabled={!show("endpoint")}
                        />
                      </td>
                      <td className="py-2 px-2">
                        <button
                          onClick={() => toggleRowDetails(row.id)}
                          className="inline-flex items-center gap-1 rounded border border-cyan-700/70 bg-cyan-900/20 px-2 py-1 text-xs text-cyan-200 hover:bg-cyan-800/40"
                          type="button"
                        >
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          {isEn ? "Details" : "詳細設定"}
                        </button>
                      </td>
                      <td className="py-2 px-2">
                        <button
                          onClick={() => removeRow(row.id)}
                          className="inline-flex items-center gap-1 rounded border border-red-700 bg-red-900/20 px-2 py-1 text-xs text-red-200 hover:bg-red-900/40"
                          type="button"
                        >
                          <Trash2 size={12} />
                          {t.remove}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-slate-800/70 bg-[#010a18]">
                        <td colSpan={8} className="px-3 py-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            <div>
                              <label className="mb-1 block text-[11px] text-slate-400">{t.username}</label>
                              <input
                                value={row.username}
                                onChange={(e) => update(row.id, "username", e.target.value)}
                                className={`w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 ${show("username") ? "" : "opacity-40"}`}
                                disabled={!show("username")}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] text-slate-400">{t.password}</label>
                              <input
                                type="password"
                                value={row.password}
                                onChange={(e) => update(row.id, "password", e.target.value)}
                                className={`w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 ${show("password") ? "" : "opacity-40"}`}
                                disabled={!show("password")}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] text-slate-400">{t.snmpCommunity}</label>
                              <input
                                value={row.snmpCommunity}
                                onChange={(e) => update(row.id, "snmpCommunity", e.target.value)}
                                className={`w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 ${show("snmpCommunity") ? "" : "opacity-40"}`}
                                disabled={!show("snmpCommunity")}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] text-slate-400">{t.mqttTopic}</label>
                              <input
                                value={row.mqttTopic}
                                onChange={(e) => update(row.id, "mqttTopic", e.target.value)}
                                className={`w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 ${show("mqttTopic") ? "" : "opacity-40"}`}
                                disabled={!show("mqttTopic")}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] text-slate-400">{t.pollIntervalSec}</label>
                              <input
                                value={row.pollIntervalSec}
                                onChange={(e) => update(row.id, "pollIntervalSec", e.target.value)}
                                className={`w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100 ${show("pollIntervalSec") ? "" : "opacity-40"}`}
                                disabled={!show("pollIntervalSec")}
                              />
                            </div>
                            <div className="md:col-span-2 xl:col-span-3">
                              <label className="mb-1 block text-[11px] text-slate-400">{t.notes}</label>
                              <input
                                value={row.notes}
                                onChange={(e) => update(row.id, "notes", e.target.value)}
                                className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-100"
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
              )})}
            </tbody>
          </table>
        </div>
      </section>
      <style jsx>{`
        .network-table-wrap {
          -webkit-overflow-scrolling: touch;
        }
        :global(.network-config-table th) {
          white-space: nowrap;
          position: sticky;
          top: 0;
          z-index: 1;
          background: #03112b;
        }
        :global(.network-config-table th),
        :global(.network-config-table td) {
          min-width: 120px;
          vertical-align: middle;
        }
        :global(.network-config-table th:nth-child(3)),
        :global(.network-config-table td:nth-child(3)) {
          min-width: 80px;
          width: 80px;
        }
        :global(.network-config-table th:nth-child(1)),
        :global(.network-config-table td:nth-child(1)) {
          min-width: 180px;
          width: 180px;
        }
        :global(.network-config-table th:nth-child(2)),
        :global(.network-config-table td:nth-child(2)) {
          min-width: 150px;
          width: 150px;
        }
        :global(.network-config-table th:nth-child(4)),
        :global(.network-config-table td:nth-child(4)) {
          min-width: 340px;
          width: 340px;
        }
        :global(.network-config-table th:nth-child(5)),
        :global(.network-config-table td:nth-child(5)) {
          min-width: 120px;
          width: 120px;
        }
        :global(.network-config-table th:nth-child(6)),
        :global(.network-config-table td:nth-child(6)) {
          min-width: 300px;
          width: 300px;
        }
        :global(.network-config-table th:nth-child(7)),
        :global(.network-config-table td:nth-child(7)) {
          min-width: 110px;
          width: 110px;
        }
        :global(.network-config-table th:last-child),
        :global(.network-config-table td:last-child) {
          min-width: 96px;
          width: 96px;
        }
        :global(.network-config-table input),
        :global(.network-config-table select) {
          min-width: 110px;
        }
      `}</style>
    </div>
  );
}
