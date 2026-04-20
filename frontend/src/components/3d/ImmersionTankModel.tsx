"use client";
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { RackData } from '@/store/useDcimStore';
import { ServerData } from '@/store/useDcimStore';
import { RACK_WIDTH, RACK_DEPTH, U_HEIGHT } from './sceneScale';
import { getDeviceStatus } from '@/shared/status';
const SERVER_WIDTH = 0.44; // 19 inch rack standard (same as ServerModel)
const SERVER_DEPTH = 0.8;  // same depth as ServerModel

function normalizeNodeId(value: string): string {
    const raw = (value || "").trim().toUpperCase().replace(/\s+/g, "").replace(/_/g, "-");
    const m = raw.match(/^(SERVER|SW|IMM|CDU)-?(\d+)$/);
    if (!m) return raw;
    return `${m[1]}-${String(Number(m[2])).padStart(3, "0")}`;
}

function pickTelemetry(telemetry: Record<string, any>, assetId: string | undefined, name: string, fallbackName?: string) {
    const keys = [assetId, name, normalizeNodeId(name), fallbackName, fallbackName ? normalizeNodeId(fallbackName) : undefined]
        .filter((k): k is string => Boolean(k && k.length));
    for (const k of keys) {
        const hit = telemetry[k];
        if (
            hit &&
            typeof hit === "object" &&
            ("temperature" in hit || "cpu_usage" in hit || "traffic_gbps" in hit || "server_id" in hit || "asset_id" in hit)
        ) {
            return hit;
        }
    }
    return undefined;
}

// ─────────────────────────────────────────────
// Vertical Server Blade (Immersion Style)
// 與標準 RACK 內的伺服器同尺寸 (寬 0.44m, 深 0.8m)
// 旋轉 90° 縱向插入，不同 U 數只影響「厚度」
// ─────────────────────────────────────────────
function ImmersionServerBlade({ data, telemetry, index, totalSlots, tankInnerDepth }: {
    data: ServerData;
    telemetry?: any;
    index: number;
    totalSlots: number;
    tankInnerDepth: number;
}) {
    const materialRef = useRef<THREE.MeshStandardMaterial>(null);

    const isPoweredOff = telemetry?.power_state === 'off';

    let liveStatus = data.status;
    if (isPoweredOff) {
        liveStatus = 'offline';
    } else if (telemetry) {
        if (telemetry.temperature > 55 || telemetry.cpu_usage > 85) liveStatus = 'critical';
        else if (telemetry.temperature > 45 || telemetry.cpu_usage > 60) liveStatus = 'warning';
        else liveStatus = 'normal';
    }

    useFrame((state) => {
        if (materialRef.current) {
            if (isPoweredOff) {
                materialRef.current.emissiveIntensity = 0.05;
                return;
            }
            if (liveStatus === 'critical') {
                const t = Math.sin(state.clock.elapsedTime * 10);
                materialRef.current.emissiveIntensity = t > 0 ? 0.8 : 0.2;
            } else if (liveStatus === 'warning') {
                const t = Math.sin(state.clock.elapsedTime * 2);
                materialRef.current.emissiveIntensity = t > 0 ? 0.5 : 0.1;
            } else {
                materialRef.current.emissiveIntensity = 0.3;
            }
        }
    });

    const getColor = () => {
        if (isPoweredOff) return '#111111';
        switch (liveStatus) {
            case 'critical': return '#ef4444';
            case 'warning': return '#f59e0b';
            case 'offline': return '#64748b';
            default: return '#06b6d4';
        }
    };

    // 顏色與標準 RACK server 完全一致 (ServerModel.tsx)
    const getBodyColor = () => {
        if (isPoweredOff) return '#1a1a1a'; // 黑色 = 關機
        if (liveStatus === 'critical') return '#ef4444'; // 紅色 = 嚴重
        if (liveStatus === 'warning') return '#f59e0b'; // 黃色 = 警告
        if (data.type === 'storage') return '#1e293b';
        if (data.type === 'switch') return '#0f172a';
        return '#3b82f6'; // 藍色 = 正常運行
    };

    // 厚度 = U 數 × U_HEIGHT (跟 RACK 裡一樣，1U ≈ 4.4cm)
    const bladeThickness = data.uHeight * U_HEIGHT;

    // 縱向排列：使用 uPosition 決定 Z 軸位置（非 array index）
    // 每個 U slot 在 Z 軸上均分空間
    const slotSpacing = tankInnerDepth / Math.max(totalSlots, 1);
    const zPos = -tankInnerDepth / 2 + (data.uPosition - 1) * slotSpacing + (data.uHeight * slotSpacing) / 2;

    // 伺服器本體高度 = SERVER_DEPTH (0.8m)，寬度 = SERVER_WIDTH (0.44m)
    // 底部抬高 0.12m (底板高度)
    const yPos = 0.12 + SERVER_DEPTH / 2;

    return (
        <group position={[0, yPos, zPos]}>
            {/* Server blade body — 同 RACK 的長寬，只有厚度依 U 數變化 */}
            <mesh castShadow>
                <boxGeometry args={[SERVER_WIDTH, SERVER_DEPTH, bladeThickness - 0.002]} />
                <meshStandardMaterial color={getBodyColor()} metalness={0.3} roughness={0.7} />
            </mesh>

            {/* LED indicator strip on top edge */}
            <mesh position={[0, SERVER_DEPTH / 2 - 0.008, 0]}>
                <boxGeometry args={[SERVER_WIDTH * 0.8, 0.01, bladeThickness]} />
                <meshStandardMaterial
                    ref={materialRef}
                    color={getColor()}
                    emissive={getColor()}
                    emissiveIntensity={0.5}
                />
            </mesh>
        </group>
    );
}

// ─────────────────────────────────────────────
// Immersion Tank Main Model
// 槽體尺寸需容納完整伺服器 (寬 0.44m, 高 0.8m)
// ─────────────────────────────────────────────
export default function ImmersionTankModel({
    data,
    isSelected,
    telemetry = {}
}: {
    data: RackData;
    isSelected: boolean;
    telemetry?: Record<string, any>;
}) {
    const isDualPhase = data.type === 'immersion_dual';

    // 槽體尺寸 — 需容納 0.44m 寬 × 0.8m 高的伺服器
    const TANK_WIDTH = RACK_WIDTH;  // 與標準機櫃同寬，場景比例一致
    const TANK_DEPTH = RACK_DEPTH;
    const TANK_HEIGHT = 1.05;  // 比伺服器高度 0.8m 多留 ~0.25m 液面空間
    const TANK_INNER_DEPTH = TANK_DEPTH - 0.1; // 內部可用深度 (扣掉兩側壁厚)

    // Coolant color（雙相槽內仍用紫色介質色，外殼改白色機櫃）
    const coolantColor = isDualPhase ? '#7c3aed' : '#06b6d4';
    const coolantEmissive = isDualPhase ? '#6d28d9' : '#0891b2';
    const cabinetWhite = '#ececec';
    const cabinetRough = 0.42;
    const cabinetMetal = 0.12;

    // ── Coolant Liquid (Submerge 0.8m servers) ──
    const coolantRef = useRef<THREE.Mesh>(null);
    const LIQUID_HEIGHT = 0.85;
    const LIQUID_Y = 0.1 + LIQUID_HEIGHT / 2; // Starts from base top (0.1m)
    
    useFrame((state) => {
        if (coolantRef.current) {
            // Animate surface slightly around the target level
            coolantRef.current.position.y = LIQUID_Y + Math.sin(state.clock.elapsedTime * 1.5) * 0.005;
        }
    });

    // Power usage
    const currentKw = data.servers.reduce((sum, s) => sum + s.powerKw, 0);
    const powerUsagePercent = (currentKw / data.maxPowerKw) * 100;

    // Check for alerts
    let hasCriticalServer = false;
    let hasWarningServer = false;
    data.servers.forEach(server => {
        const sTel = pickTelemetry(telemetry, server.assetId, server.name, data.name);
        const status = getDeviceStatus(
            { type: server.type, rackType: data.type },
            sTel,
        );
        if (status === 'critical') hasCriticalServer = true;
        else if (status === 'warning') hasWarningServer = true;
    });

    const frontZ = TANK_DEPTH / 2 + 0.006;
    const hw = TANK_WIDTH / 2;
    const hd = TANK_DEPTH / 2;
    const grilleY0 = 0.11;
    const grilleY1 = 0.11 + TANK_HEIGHT * 0.34;

    return (
        <group>
            <>
                {/* ── 單相/雙相：統一白色工業機櫃外觀 ── */}
                <mesh position={[0, TANK_HEIGHT / 2, 0]} castShadow>
                    <boxGeometry args={[TANK_WIDTH, TANK_HEIGHT, TANK_DEPTH]} />
                    <meshStandardMaterial
                        color={cabinetWhite}
                        roughness={cabinetRough}
                        metalness={cabinetMetal}
                        transparent
                        opacity={0.6}
                    />
                </mesh>
                {isSelected && (
                    <mesh position={[0, TANK_HEIGHT / 2, 0]}>
                        <boxGeometry args={[TANK_WIDTH + 0.06, TANK_HEIGHT + 0.06, TANK_DEPTH + 0.06]} />
                        <meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.45} depthWrite={false} />
                    </mesh>
                )}
                {/* 底板 */}
                <mesh position={[0, 0.05, 0]}>
                    <boxGeometry args={[TANK_WIDTH, 0.1, TANK_DEPTH]} />
                    <meshStandardMaterial color="#d4d4d8" metalness={0.55} roughness={0.35} />
                </mesh>
                {/* 頂蓋 */}
                <mesh position={[0, TANK_HEIGHT - 0.015, 0]}>
                    <boxGeometry args={[TANK_WIDTH + 0.012, 0.03, TANK_DEPTH + 0.012]} />
                    <meshStandardMaterial
                        color={cabinetWhite}
                        roughness={cabinetRough}
                        metalness={cabinetMetal}
                        transparent
                        opacity={0.55}
                    />
                </mesh>
                {/* 後方加高飾板 */}
                <mesh position={[0, TANK_HEIGHT - 0.08, -hd - 0.025]}>
                    <boxGeometry args={[TANK_WIDTH * 0.92, 0.14, 0.04]} />
                    <meshStandardMaterial color="#f4f4f5" roughness={0.4} metalness={0.15} />
                </mesh>
                {/* 四腳座 */}
                {[
                    [-hw * 0.78, -hd * 0.78],
                    [hw * 0.78, -hd * 0.78],
                    [-hw * 0.78, hd * 0.78],
                    [hw * 0.78, hd * 0.78],
                ].map(([fx, fz], i) => (
                    <mesh key={`foot-${i}`} position={[fx, 0.028, fz]} castShadow>
                        <cylinderGeometry args={[0.028, 0.032, 0.045, 12]} />
                        <meshStandardMaterial color="#a1a1aa" metalness={0.65} roughness={0.35} />
                    </mesh>
                ))}
                {/* 正面下緣通風格柵 */}
                {Array.from({ length: 11 }).map((_, i) => {
                    const t = i / 10;
                    const y = grilleY0 + t * (grilleY1 - grilleY0);
                    return (
                        <mesh key={`louver-${i}`} position={[0, y, frontZ]}>
                            <boxGeometry args={[TANK_WIDTH * 0.72, 0.008, 0.02]} />
                            <meshStandardMaterial color="#27272a" metalness={0.4} roughness={0.6} />
                        </mesh>
                    );
                })}
                {/* 急停：黃色底座 + 紅色按鈕 */}
                <mesh position={[0, 0.12 + TANK_HEIGHT * 0.58, frontZ + 0.028]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.038, 0.042, 0.014, 24]} />
                    <meshStandardMaterial color="#facc15" metalness={0.35} roughness={0.45} />
                </mesh>
                <mesh position={[0, 0.12 + TANK_HEIGHT * 0.58 + 0.022, frontZ + 0.032]}>
                    <cylinderGeometry args={[0.026, 0.026, 0.018, 24]} />
                    <meshStandardMaterial color="#dc2626" metalness={0.25} roughness={0.35} />
                </mesh>
                {/* 右側門鎖/把手飾片 */}
                <mesh position={[hw * 0.52, TANK_HEIGHT * 0.52, frontZ + 0.02]}>
                    <boxGeometry args={[0.045, 0.07, 0.012]} />
                    <meshStandardMaterial color="#18181b" metalness={0.5} roughness={0.5} />
                </mesh>
                {/* 頂面前緣小金屬拉環 */}
                <mesh position={[hw * 0.38, TANK_HEIGHT + 0.018, hd * 0.72]} rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[0.028, 0.006, 8, 24]} />
                    <meshStandardMaterial color="#a1a1aa" metalness={0.85} roughness={0.25} />
                </mesh>
                {/* 後左角三色燈柱（頂層綠燈亮） */}
                <group position={[-hw + 0.045, grilleY1 + 0.12, -hd + 0.045]}>
                    {[
                        { y: 0, color: '#450a0a', em: '#000000', int: 0 },
                        { y: 0.055, color: '#422006', em: '#000000', int: 0 },
                        { y: 0.11, color: '#166534', em: '#22c55e', int: 1.2 },
                    ].map((seg, idx) => (
                        <mesh key={`stack-${idx}`} position={[0, seg.y, 0]}>
                            <cylinderGeometry args={[0.022, 0.022, 0.048, 16]} />
                            <meshStandardMaterial
                                color={seg.color}
                                emissive={seg.em}
                                emissiveIntensity={seg.int}
                                metalness={0.3}
                                roughness={0.4}
                            />
                        </mesh>
                    ))}
                </group>
                {/* 左側板螺絲點綴 */}
                {[
                    [0.22, -hd * 0.35],
                    [0.38, -hd * 0.12],
                    [0.54, hd * 0.12],
                    [0.72, hd * 0.38],
                ].map(([y, sz], i) => (
                    <mesh key={`screw-l-${i}`} position={[-hw - 0.004, y, sz]}>
                        <cylinderGeometry args={[0.012, 0.012, 0.008, 6]} />
                        <meshStandardMaterial color="#d4d4d8" metalness={0.7} roughness={0.35} />
                    </mesh>
                ))}
            </>

            {/* ── Vertical Server Blades：先畫固體，再由半透明液體疊色 ── */}
            {data.servers.map((server, i) => (
                <ImmersionServerBlade
                    key={`${data.id}-${server.id}-${i}`}
                    data={server}
                    telemetry={pickTelemetry(telemetry, server.assetId, server.name, data.name)}
                    index={i}
                    totalSlots={data.uCapacity}
                    tankInnerDepth={TANK_INNER_DEPTH}
                />
            ))}

            {/* ── Coolant Liquid（半透明、不寫入 depth，疊在 server 上可見內部） ── */}
            <mesh ref={coolantRef} position={[0, LIQUID_Y, 0]} renderOrder={2}>
                <boxGeometry args={[TANK_WIDTH - 0.04, LIQUID_HEIGHT, TANK_DEPTH - 0.04]} />
                <meshStandardMaterial
                    color={coolantColor}
                    emissive={coolantEmissive}
                    emissiveIntensity={isDualPhase ? 0.12 : 0.15}
                    transparent
                    opacity={isDualPhase ? 0.22 : 0.26}
                    depthWrite={false}
                    roughness={0.15}
                    metalness={0.05}
                />
            </mesh>

            {/* ── 雙相：後上方小型冷凝／模組示意（低調灰色，不搶白色機櫃造型） ── */}
            {isDualPhase && (
                <mesh position={[0.06, TANK_HEIGHT + 0.06, -hd * 0.35]} castShadow>
                    <boxGeometry args={[TANK_WIDTH * 0.42, 0.1, TANK_DEPTH * 0.38]} />
                    <meshStandardMaterial color="#71717a" metalness={0.75} roughness={0.35} />
                </mesh>
            )}

            {/* ── Pipe Connectors ── */}
            {[-1, 1].map((side) => (
                <group key={`pipe-${side}`} position={[side * (TANK_WIDTH / 2 + 0.04), TANK_HEIGHT * 0.3, 0]}>
                    <mesh rotation={[0, 0, Math.PI / 2]}>
                        <cylinderGeometry args={[0.025, 0.025, 0.08, 12]} />
                        <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.1} />
                    </mesh>
                </group>
            ))}

            {/* ── Label ── */}
            <Text
                position={[0, TANK_HEIGHT + (isDualPhase ? 0.22 : 0.15), 0]}
                fontSize={0.12}
                color="#1e293b"
                anchorX="center"
                anchorY="middle"
            >
                {data.name}
            </Text>

            {/* Type Tag */}
            <Text
                position={[0, TANK_HEIGHT + (isDualPhase ? 0.36 : 0.3), 0]}
                fontSize={0.08}
                color={isDualPhase ? '#7c3aed' : '#06b6d4'}
                anchorX="center"
                anchorY="middle"
            >
                {isDualPhase ? '[ DUAL PHASE ]' : '[ SINGLE PHASE ]'}
            </Text>

            {/* Alert icon */}
            {(hasCriticalServer || hasWarningServer) && (
                <Text
                    position={[0, TANK_HEIGHT + (isDualPhase ? 0.52 : 0.5), 0]}
                    fontSize={0.2}
                    color={hasCriticalServer ? "#ef4444" : "#f59e0b"}
                    anchorX="center"
                    anchorY="middle"
                >
                    {hasCriticalServer ? "🔥" : "⚠️"}
                </Text>
            )}

            {/* ── Power Usage Bar ── */}
            <mesh position={[0, TANK_HEIGHT - 0.08, TANK_DEPTH / 2 + 0.01]}>
                <planeGeometry args={[TANK_WIDTH * 0.8, 0.04]} />
                <meshBasicMaterial color="#334155" />
            </mesh>
            <mesh position={[(-TANK_WIDTH * 0.8 / 2) + ((TANK_WIDTH * 0.8 * Math.min(100, powerUsagePercent) / 100) / 2), TANK_HEIGHT - 0.08, TANK_DEPTH / 2 + 0.011]}>
                <planeGeometry args={[TANK_WIDTH * 0.8 * (Math.min(100, powerUsagePercent) / 100), 0.04]} />
                <meshBasicMaterial color={powerUsagePercent > 90 ? "#ef4444" : "#10b981"} />
            </mesh>
        </group>
    );
}
