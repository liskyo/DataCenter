export type DeviceType = "server" | "rack" | "tank" | "cdu" | "switch";
export type CommMethod =
  | "agent_active_pull"
  | "redfish_poll"
  | "streaming_telemetry_gnmi_openconfig"
  | "bmc"
  | "snmp_poll_trap";

export type DeviceCommConfig = {
  id: string;
  model: string;
  deviceType: DeviceType;
  method: CommMethod;
  enabled: boolean;
  endpoint: string;
  port: string;
  username: string;
  password: string;
  snmpCommunity: string;
  mqttTopic: string;
  pollIntervalSec: string;
  notes: string;
};

export const NETWORK_COMM_STORAGE_KEY = "dcim.network.comm.profile.v1";

export function createDeviceCommConfig(
  deviceType: DeviceType,
  method: CommMethod,
  seed: Partial<DeviceCommConfig> = {},
): DeviceCommConfig {
  const nowId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id: seed.id || nowId,
    model: seed.model || "",
    deviceType,
    method,
    enabled: seed.enabled ?? true,
    endpoint: seed.endpoint || "",
    port: seed.port || "",
    username: seed.username || "",
    password: seed.password || "",
    snmpCommunity: seed.snmpCommunity || "",
    mqttTopic: seed.mqttTopic || "",
    pollIntervalSec: seed.pollIntervalSec || "60",
    notes: seed.notes || "",
  };
}

type LegacyCommProfile = Record<
  DeviceType,
  {
    method: CommMethod;
    endpoint: string;
    enabled: boolean;
    notes: string;
  }
>;

export const DEFAULT_DEVICE_COMM_CONFIGS: DeviceCommConfig[] = [
  createDeviceCommConfig("server", "agent_active_pull", {
    model: "Dell R760",
    endpoint: "http://127.0.0.1:9000/ingest",
    port: "9000",
  }),
  createDeviceCommConfig("switch", "snmp_poll_trap", {
    model: "Cisco C9300",
    endpoint: "snmp://10.10.10.30",
    port: "161",
    snmpCommunity: "public",
  }),
  createDeviceCommConfig("cdu", "streaming_telemetry_gnmi_openconfig", {
    model: "CoolIT CHx40",
    endpoint: "kafka://localhost:29093/telemetry",
    port: "29093",
    mqttTopic: "telemetry/cdu",
  }),
];

function migrateLegacyProfile(raw: LegacyCommProfile): DeviceCommConfig[] {
  const rows: DeviceCommConfig[] = [];
  const order: DeviceType[] = ["server", "rack", "tank", "cdu", "switch"];
  for (const type of order) {
    const item = raw[type];
    if (!item) continue;
    rows.push(
      createDeviceCommConfig(type, item.method, {
        model: type.toUpperCase(),
        endpoint: item.endpoint,
        enabled: item.enabled,
        notes: item.notes,
      }),
    );
  }
  return rows.length > 0 ? rows : DEFAULT_DEVICE_COMM_CONFIGS;
}

export function mergeDeviceCommConfigs(raw: unknown): DeviceCommConfig[] {
  if (!raw) return DEFAULT_DEVICE_COMM_CONFIGS;
  if (Array.isArray(raw)) {
    return raw
      .filter((row) => row && typeof row === "object")
      .map((row) => {
        const input = row as Partial<DeviceCommConfig> & { name?: string };
        return createDeviceCommConfig(
          (input.deviceType as DeviceType) || "server",
          (input.method as CommMethod) || "agent_active_pull",
          {
            ...input,
            // Backward compatibility: old schema may use `name`.
            model: input.model || input.name || "",
          },
        );
      });
  }
  if (typeof raw === "object") {
    return migrateLegacyProfile(raw as LegacyCommProfile);
  }
  return DEFAULT_DEVICE_COMM_CONFIGS;
}

export function readDeviceCommConfigsFromStorage(): DeviceCommConfig[] {
  if (typeof window === "undefined") return DEFAULT_DEVICE_COMM_CONFIGS;
  try {
    const raw = window.localStorage.getItem(NETWORK_COMM_STORAGE_KEY);
    return raw ? mergeDeviceCommConfigs(JSON.parse(raw)) : DEFAULT_DEVICE_COMM_CONFIGS;
  } catch {
    return DEFAULT_DEVICE_COMM_CONFIGS;
  }
}

export function resolveCommMethodByModel(
  configs: DeviceCommConfig[],
  deviceType: DeviceType,
  model: string | undefined,
  opts?: { simulationMode?: boolean },
): CommMethod {
  // Per requirement: in simulation mode, default all model methods to Agent Active Pull.
  if (opts?.simulationMode) return "agent_active_pull";
  const normalizedModel = (model || "").trim().toLowerCase();
  const matched = configs.find(
    (c) =>
      c.enabled &&
      c.deviceType === deviceType &&
      c.model.trim().toLowerCase() === normalizedModel,
  );
  return matched?.method || "agent_active_pull";
}

