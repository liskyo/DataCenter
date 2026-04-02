"use client";
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { RackData } from '@/store/useDcimStore';
import { ServerData } from '@/store/useDcimStore';

const U_HEIGHT = 0.04445; // 1U = 0.04445 meters
const SERVER_WIDTH = 0.44; // 19 inch rack standard (same as ServerModel)
const SERVER_DEPTH = 0.8;  // same depth as ServerModel

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
    const TANK_WIDTH = 0.6;    // 比伺服器寬 0.44m 多留邊距
    const TANK_DEPTH = 1.0;    // Z 方向：容納 20 片縱向 blade
    const TANK_HEIGHT = 1.05;  // 比伺服器高度 0.8m 多留 ~0.25m 液面空間
    const TANK_INNER_DEPTH = TANK_DEPTH - 0.1; // 內部可用深度 (扣掉兩側壁厚)

    // Coolant color
    const coolantColor = isDualPhase ? '#7c3aed' : '#06b6d4';
    const coolantEmissive = isDualPhase ? '#6d28d9' : '#0891b2';
    const frameColor = isSelected ? '#22d3ee' : (isDualPhase ? '#a855f7' : '#0ea5e9');

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
        const sTel = telemetry[server.name];
        if (sTel) {
            if (sTel.temperature > 55 || sTel.cpu_usage > 85) hasCriticalServer = true;
            else if (sTel.temperature > 45 || sTel.cpu_usage > 60) hasWarningServer = true;
        }
    });

    return (
        <group>
            {/* ── Tank Outer Shell (Translucent Glass) ── */}
            <mesh position={[0, TANK_HEIGHT / 2, 0]} castShadow>
                <boxGeometry args={[TANK_WIDTH, TANK_HEIGHT, TANK_DEPTH]} />
                <meshStandardMaterial
                    color={frameColor}
                    transparent
                    opacity={isSelected ? 0.25 : 0.12}
                    wireframe={!isSelected}
                    side={THREE.DoubleSide}
                />
            </mesh>

            {/* ── Tank Solid Edges ── */}
            {/* Bottom plate (0.1m thick) */}
            <mesh position={[0, 0.05, 0]}>
                <boxGeometry args={[TANK_WIDTH, 0.1, TANK_DEPTH]} />
                <meshStandardMaterial color={frameColor} metalness={0.6} roughness={0.3} />
            </mesh>
            {/* Top rim */}
            <mesh position={[0, TANK_HEIGHT - 0.02, 0]}>
                <boxGeometry args={[TANK_WIDTH + 0.02, 0.04, TANK_DEPTH + 0.02]} />
                <meshStandardMaterial color={frameColor} metalness={0.8} roughness={0.2} />
            </mesh>

            {/* ── Coolant Liquid (Submerged servers) ── */}
            <mesh ref={coolantRef} position={[0, LIQUID_Y, 0]}>
                <boxGeometry args={[TANK_WIDTH - 0.04, LIQUID_HEIGHT, TANK_DEPTH - 0.04]} />
                <meshStandardMaterial
                    color={coolantColor}
                    emissive={coolantEmissive}
                    emissiveIntensity={0.3}
                    transparent
                    opacity={0.35}
                />
            </mesh>

            {/* ── Vertical Server Blades (Full-size, rotated 90°) ── */}
            {data.servers.map((server, i) => (
                <ImmersionServerBlade
                    key={server.id}
                    data={server}
                    telemetry={telemetry[server.name]}
                    index={i}
                    totalSlots={data.uCapacity}
                    tankInnerDepth={TANK_INNER_DEPTH}
                />
            ))}

            {/* ── Dual-Phase: Condenser Unit on Top ── */}
            {isDualPhase && (
                <group position={[0, TANK_HEIGHT + 0.15, 0]}>
                    <mesh castShadow>
                        <boxGeometry args={[TANK_WIDTH * 0.8, 0.2, TANK_DEPTH * 0.6]} />
                        <meshStandardMaterial color="#1e1b4b" metalness={0.7} roughness={0.3} />
                    </mesh>
                    {[-0.15, -0.05, 0.05, 0.15].map((z, i) => (
                        <mesh key={`fin-${i}`} position={[0, 0, z]}>
                            <boxGeometry args={[TANK_WIDTH * 0.75, 0.18, 0.015]} />
                            <meshStandardMaterial color="#312e81" metalness={0.9} roughness={0.1} />
                        </mesh>
                    ))}
                    <mesh position={[0, 0.15, 0]}>
                        <sphereGeometry args={[0.06, 16, 16]} />
                        <meshStandardMaterial
                            color="#a78bfa"
                            emissive="#7c3aed"
                            emissiveIntensity={1.5}
                            transparent
                            opacity={0.8}
                        />
                    </mesh>
                    <Text position={[0, 0.28, 0]} fontSize={0.06} color="#a78bfa" anchorX="center" anchorY="middle">
                        CONDENSER
                    </Text>
                </group>
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
                position={[0, TANK_HEIGHT + (isDualPhase ? 0.55 : 0.15), 0]}
                fontSize={0.12}
                color="#1e293b"
                anchorX="center"
                anchorY="middle"
            >
                {data.name}
            </Text>

            {/* Type Tag */}
            <Text
                position={[0, TANK_HEIGHT + (isDualPhase ? 0.7 : 0.3), 0]}
                fontSize={0.08}
                color={isDualPhase ? '#a855f7' : '#06b6d4'}
                anchorX="center"
                anchorY="middle"
            >
                {isDualPhase ? '[ DUAL PHASE ]' : '[ SINGLE PHASE ]'}
            </Text>

            {/* Alert icon */}
            {(hasCriticalServer || hasWarningServer) && (
                <Text
                    position={[0, TANK_HEIGHT + (isDualPhase ? 0.9 : 0.5), 0]}
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
