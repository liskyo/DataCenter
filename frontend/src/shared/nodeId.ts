/**
 * 節點 ID 正規化：telemetry / API / 顯示名稱對齊用（單一來源，避免各頁重複邏輯）。
 */
export function normalizeNodeId(value: string): string {
  const raw = (value || "").trim().toUpperCase().replace(/\s+/g, "").replace(/_/g, "-");
  const m = raw.match(/^(SERVER|SW|IMM|CDU)-?(\d+)$/);
  if (!m) return raw;
  return `${m[1]}-${String(Number(m[2])).padStart(3, "0")}`;
}

/** metrics 單筆 payload 可能帶多種 id 欄位，展開為可查表鍵。 */
export function buildTelemetryKeys(payload: unknown): string[] {
  const keys = new Set<string>();
  const p = payload as Record<string, unknown>;
  const idCandidates = [p?.asset_id, p?.server_id, p?.node_id, p?.device_id].filter(
    (v): v is string => typeof v === "string",
  );
  for (const id of idCandidates) {
    keys.add(id);
    keys.add(normalizeNodeId(id));
  }
  return Array.from(keys);
}
