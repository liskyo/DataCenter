/**
 * 節點 ID 正規化：telemetry / API / 顯示名稱對齊用（單一來源，避免各頁重複邏輯）。
 */
export function normalizeNodeId(value: string): string {
  const raw = (value || "").trim().toUpperCase().replace(/\s+/g, "").replace(/_/g, "-");
  const m = raw.match(/^(SERVER|SW|IMM|CDU)-?(\d+)$/);
  if (m) return `${m[1]}-${String(Number(m[2])).padStart(3, "0")}`;

  // Accept variants like CDU-1-1, CDU-1_A, IMM-TAN-001, IMM-1P-3 and fold to canonical PREFIX-###
  const ext = raw.match(/^(SERVER|SW|IMM|CDU)(?:-[A-Z0-9]+)*-(\d+)(?:-[A-Z0-9]+)*$/);
  if (ext) return `${ext[1]}-${String(Number(ext[2])).padStart(3, "0")}`;

  return raw;
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

/**
 * 依多個候選 ID（原始值 + 正規化）解析 telemetry 紀錄。
 * 用於 CDU / Rack / Tank / Server 等不同命名來源的統一映射。
 */
export function resolveTelemetryRecord(
  telemetry: Record<string, unknown> | undefined,
  ...idCandidates: Array<string | undefined | null>
): Record<string, unknown> | undefined {
  if (!telemetry) return undefined;
  for (const id of idCandidates) {
    if (!id) continue;
    const raw = id.trim();
    if (!raw) continue;
    const normalized = normalizeNodeId(raw);
    const hit = (telemetry[raw] ?? telemetry[normalized]) as Record<string, unknown> | undefined;
    if (hit && typeof hit === "object") return hit;
  }
  return undefined;
}

/**
 * 進階版解析：先走 key 查表，若失敗再掃描 telemetry values 的 ID 欄位比對。
 * 可涵蓋不同來源（asset/server/node/device）欄位混用與舊資料命名不一致情況。
 */
export function resolveTelemetryRecordDeep(
  telemetry: Record<string, unknown> | undefined,
  ...idCandidates: Array<string | undefined | null>
): Record<string, unknown> | undefined {
  const direct = resolveTelemetryRecord(telemetry, ...idCandidates);
  if (direct) return direct;
  if (!telemetry) return undefined;

  const normalizedCandidates = idCandidates
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => normalizeNodeId(v.trim()));
  if (normalizedCandidates.length === 0) return undefined;

  for (const value of Object.values(telemetry)) {
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    const rowIds = [row.asset_id, row.server_id, row.node_id, row.device_id]
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => normalizeNodeId(v.trim()));
    if (rowIds.some((id) => normalizedCandidates.includes(id))) {
      return row;
    }
  }
  return undefined;
}
