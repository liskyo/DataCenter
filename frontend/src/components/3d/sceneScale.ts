/**
 * 3D 機房場景共用比例：與 RackModel 機櫃（寬 0.6m、深 1.0m）對齊，
 * 落地設備外觀高度落在相近範圍，避免 CRAC / Chiller 過大、PDU 過高等視覺不協調。
 */
export const GRID = 0.6;
export const RACK_WIDTH = 0.6;
export const RACK_DEPTH = 1.0;
/** 1U 高度（公尺），與 ServerModel 一致 */
export const U_HEIGHT = 0.04445;

/** 典型 42U 機櫃高度（約），供設備高度參考 */
export const RACK_H_42U = 42 * 0.04445 + 0.2;

/** 落地式機電設備：外殼中心 Y = cy，幾何為寬×高×深 */
export const CRAC = { w: 0.82, h: 1.82, d: 0.58, cy: 0.91 } as const;
export const PDU = { w: 0.5, h: 1.62, d: 0.5, cy: 0.81 } as const;
export const UPS = { ...PDU } as const;
export const CHILLER = { w: 0.54, h: 1.76, d: 0.54, cy: 0.88 } as const;

/**
 * CDU：高度與標準 42U Rack 相同（uCapacity×U_HEIGHT+0.2，見 RackModel）
 * 深度與機櫃相近，便於並排觀看
 */
export const CDU = {
  w: 0.52,
  h: RACK_H_42U,
  d: 0.88,
  cy: RACK_H_42U / 2,
} as const;

/**
 * DCIM / NOC 走道控制台：窄型金屬下櫃 + 工作臺 + 雙螢幕（機房走道常見樣式）
 */
export const DASHBOARD = {
  w: 0.56,
  d: 0.4,
  cabinetBottomY: 0.12,
  cabinetH: 0.5,
  workT: 0.024,
  /** 螢幕支臂立柱高度（自工作臺面上緣起算），加高以配合螢幕位置 */
  poleH: 0.48,
} as const;
