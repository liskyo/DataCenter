export type DeviceStatus = "powered_off" | "normal" | "warning" | "critical";

// 說明：設備狀態閾值以此檔為唯一依據（single source of truth）。
// 首頁狀態總覽與 3D 數位孿生皆 import 本函式，避免告警數與顯示顏色不一致。
export function getDeviceStatus(item: any, srv: any): DeviceStatus {
  if (!srv) return "powered_off";
  if (srv.power_state === "off") return "powered_off";

  // CDU 液冷：回水溫、流量、漏液
  if (item.type === "cdu") {
    const outTemp = srv.outlet_temp || 0;
    const flow = srv.flow_rate_lpm || 0;
    if (srv.leak_detected || outTemp > 50 || (flow > 0 && flow < 3)) return "critical";
    if (outTemp > 45 || (flow > 0 && flow < 5)) return "warning";
    return "normal";
  }

  // 交換器／網路機櫃：流量、啟用埠、管理面 CPU／機殼溫度
  if (item.type === "switch" || item.rackType === "network") {
    const traffic = srv.traffic_gbps || 0;
    const ports = srv.ports_active || 0;
    const cpu = srv.cpu_usage || 0;
    const temp = srv.temperature || 0;
    if (traffic > 35 || ports > 42 || cpu > 85 || temp > 55) return "critical";
    if (traffic > 25 || ports > 35 || cpu > 60 || temp > 45) return "warning";
    return "normal";
  }

  // 一般伺服器：CPU、溫度
  const cpu = srv.cpu_usage || 0;
  const temp = srv.temperature || 0;
  if (cpu > 85 || temp > 55) return "critical";
  if (cpu > 60 || temp > 45) return "warning";
  return "normal";
}
