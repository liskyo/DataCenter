"use client";
import React, { useRef } from 'react';
import { PivotControls, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { EquipmentData, useDcimStore } from '@/store/useDcimStore';
import CDUModel from './CDUModel';
import { GRID, CRAC, PDU, CHILLER, DASHBOARD } from './sceneScale';
// 與首頁共用 getDeviceStatus，3D Dashboard 告警數與狀態總覽一致。
import { getDeviceStatus } from '@/shared/status';

function normalizeNodeId(value: string): string {
    const raw = (value || "").trim().toUpperCase().replace(/\s+/g, "").replace(/_/g, "-");
    const m = raw.match(/^(SERVER|SW|IMM|CDU)-?(\d+)$/);
    if (!m) return raw;
    return `${m[1]}-${String(Number(m[2])).padStart(3, "0")}`;
}

function pickTelemetry(telemetry: Record<string, any> | undefined, assetId: string | undefined, name: string) {
    if (!telemetry) return undefined;
    const keys = [assetId, name, normalizeNodeId(name)].filter((k): k is string => Boolean(k && k.length));
    for (const k of keys) {
        const hit = telemetry[k];
        if (hit) return hit;
    }
    return undefined;
}

export default function EquipmentModel({ data, telemetry }: { data: EquipmentData, telemetry?: any }) {
    const isEditMode = useDcimStore(state => state.isEditMode);
    const updateEquipmentPosition = useDcimStore(state => state.updateEquipmentPosition);
    const updateEquipmentRotation = useDcimStore(state => state.updateEquipmentRotation);
    const selectEquipment = useDcimStore(state => state.selectEquipment);
    const selectedEquipmentId = useDcimStore(state => state.selectedEquipmentId);

    const isSelected = selectedEquipmentId === data.id;
    const groupRef = useRef<THREE.Group>(null);

    const handleDrag = (localMatrix: THREE.Matrix4) => {
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        localMatrix.decompose(pos, quat, scale);

        const euler = new THREE.Euler().setFromQuaternion(quat);

        const snappedX = Math.round(pos.x / GRID) * GRID;
        const snappedZ = Math.round(pos.z / GRID) * GRID;

        updateEquipmentPosition(data.id, [snappedX, 0, snappedZ]);
        updateEquipmentRotation(data.id, [0, euler.y, 0]);
    };

    const matrix = React.useMemo(() => {
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(data.rotation[0], data.rotation[1], data.rotation[2]));
        m.compose(new THREE.Vector3(data.position[0], 0, data.position[2]), q, new THREE.Vector3(1, 1, 1));
        return m;
    }, [data.position, data.rotation]);

    const racks = useDcimStore(state => state.racks);
    const equipments = useDcimStore(state => state.equipments);
    const currentLocationId = useDcimStore(state => state.currentLocationId);

    let innerContent;

    const isPoweredOff = telemetry?.power_state === 'off';

    if (data.type === 'crac') {
        const bodyColor = isPoweredOff ? "#1a1a1a" : (isSelected ? "#38bdf8" : "#94a3b8");
        const fz = CRAC.d / 2 + 0.028;
        innerContent = (
            <group>
                <mesh position={[0, CRAC.cy, 0]} castShadow receiveShadow>
                    <boxGeometry args={[CRAC.w, CRAC.h, CRAC.d]} />
                    <meshStandardMaterial color={bodyColor} roughness={0.6} metalness={0.2} />
                </mesh>
                <mesh position={[0, CRAC.h * 0.28, fz]}>
                    <boxGeometry args={[CRAC.w * 0.82, CRAC.h * 0.32, 0.04]} />
                    <meshStandardMaterial color="#0f172a" />
                </mesh>
                <mesh position={[0, CRAC.cy + CRAC.h * 0.38, fz]}>
                    <boxGeometry args={[0.28, 0.04, 0.04]} />
                    <meshBasicMaterial color={isPoweredOff ? "#111" : "#06b6d4"} />
                </mesh>
                <Text position={[0, CRAC.h + 0.12, 0]} fontSize={0.14} color={isPoweredOff ? "#334" : "#334155"} anchorX="center" anchorY="middle">
                    {data.name} {isPoweredOff && "(OFF)"}
                </Text>
            </group>
        );
    } else if (data.type === 'pdu') {
        const bodyColor = isPoweredOff ? "#0a0a0a" : (isSelected ? "#1e40af" : "#020617");
        innerContent = (
            <group>
                <mesh position={[0, PDU.cy, 0]} castShadow receiveShadow>
                    <boxGeometry args={[PDU.w, PDU.h, PDU.d]} />
                    <meshStandardMaterial color={bodyColor} roughness={0.4} metalness={0.7} />
                </mesh>
                <mesh position={[0, PDU.cy + PDU.h * 0.12, PDU.d / 2 + 0.028]}>
                    <boxGeometry args={[PDU.w * 0.45, 0.2, 0.04]} />
                    <meshBasicMaterial color={isPoweredOff ? "#111" : "#10b981"} />
                </mesh>
                <mesh position={[0, PDU.cy + PDU.h * 0.42, 0]}>
                    <cylinderGeometry args={[0.045, 0.045, 0.08]} />
                    <meshBasicMaterial color={isPoweredOff ? "#222" : "#f59e0b"} />
                </mesh>
                <Text position={[0, PDU.h + 0.08, 0]} fontSize={0.12} color="#334155" anchorX="center" anchorY="middle">
                    {data.name}
                </Text>
            </group>
        );
    } else if (data.type === 'cdu') {
        innerContent = (
            <CDUModel
                name={data.name}
                isSelected={isSelected}
                telemetry={telemetry}
            />
        );
    } else if (data.type === 'ups') {
        const bodyColor = isPoweredOff ? "#0f172a" : (isSelected ? "#b45309" : "#1c1917");
        innerContent = (
            <group>
                <mesh position={[0, PDU.cy, 0]} castShadow receiveShadow>
                    <boxGeometry args={[PDU.w, PDU.h, PDU.d]} />
                    <meshStandardMaterial color={bodyColor} roughness={0.5} metalness={0.5} />
                </mesh>
                <mesh position={[0, PDU.cy, PDU.d / 2 + 0.026]}>
                    <boxGeometry args={[0.07, PDU.h * 0.72, 0.04]} />
                    <meshStandardMaterial color={isPoweredOff ? "#111" : "#166534"} emissive={isPoweredOff ? "#000" : "#22c55e"} emissiveIntensity={isPoweredOff ? 0 : 0.5} />
                </mesh>
                <Text position={[0, PDU.h + 0.06, 0]} fontSize={0.12} color="#475569" anchorX="center" anchorY="middle">
                    {data.name} (UPS)
                </Text>
            </group>
        );
    } else if (data.type === 'chiller') {
        const bodyColor = isPoweredOff ? "#0a0a0a" : (isSelected ? "#0284c7" : "#0f172a");
        const chZ = CHILLER.d / 2 + 0.02;
        innerContent = (
            <group>
                <mesh position={[0, CHILLER.cy, 0]} castShadow receiveShadow>
                    <boxGeometry args={[CHILLER.w, CHILLER.h, CHILLER.d]} />
                    <meshStandardMaterial color={bodyColor} roughness={0.2} metalness={0.8} />
                </mesh>

                <mesh position={[0, CHILLER.cy, 0]}>
                    <cylinderGeometry args={[0.22, 0.22, CHILLER.h * 0.98, 16]} />
                    <meshStandardMaterial
                        color={isPoweredOff ? "#111" : "#0ea5e9"}
                        emissive={isPoweredOff ? "#000" : "#0284c7"}
                        emissiveIntensity={isPoweredOff ? 0 : (isSelected ? 1.4 : 0.9)}
                        transparent
                        opacity={isPoweredOff ? 0.3 : 0.55}
                    />
                </mesh>

                <mesh position={[0, CHILLER.cy + 0.12, chZ]}>
                    <boxGeometry args={[CHILLER.w * 0.65, 0.22, 0.018]} />
                    <meshBasicMaterial color="#000" />
                </mesh>
                <Text position={[0, CHILLER.cy + 0.12, chZ + 0.012]} fontSize={0.055} color={isPoweredOff ? "#334" : "#22d3ee"} anchorX="center" anchorY="middle">
                    {isPoweredOff ? "SYSTEM: OFF" : "COOLANT: OPTIMAL"}
                </Text>

                {!isPoweredOff && (
                    <mesh position={[0, CHILLER.h - 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <torusGeometry args={[0.24, 0.014, 16, 32]} />
                        <meshBasicMaterial color="#38bdf8" />
                    </mesh>
                )}

                <Text position={[0, CHILLER.h + 0.1, 0]} fontSize={0.12} color={isPoweredOff ? "#334" : "#7dd3fc"} anchorX="center" anchorY="middle">
                    {data.name} (CHILLER)
                </Text>
            </group>
        );
    } else if (data.type === 'dashboard') {
        const locationRacks = racks.filter((r) => r.locationId === currentLocationId);
        const locationEquipments = equipments.filter((e) => e.locationId === currentLocationId);
        const rackServers = locationRacks.flatMap((r) =>
            r.servers.map((s) => ({
                ...s,
                assetId: s.assetId || normalizeNodeId(s.name),
                rackName: r.name,
                rackType: r.type,
            })),
        );
        const standaloneEquips = locationEquipments.map((e) => ({
            id: e.id,
            assetId: normalizeNodeId(e.name),
            name: e.name,
            type: e.type,
            rackName: 'Facility',
            rackType: 'equipment',
        }));
        const allItems = [...rackServers, ...standaloneEquips];

        const uniqueTelemetry = new Map<string, any>();
        Object.values(telemetry || {}).forEach((s: any) => {
            const id = s?.asset_id || s?.server_id;
            if (typeof id === 'string' && id.length > 0) uniqueTelemetry.set(id, s);
        });

        const stats = {
            traffic: allItems.reduce((acc: number, itemInStore: any) => {
                const s = pickTelemetry(telemetry, itemInStore.assetId, itemInStore.name);
                return acc + (s?.traffic_gbps || 0);
            }, 0),
            alarms: allItems.filter((itemInStore: any) => {
                const s = pickTelemetry(telemetry, itemInStore.assetId, itemInStore.name);
                const status = getDeviceStatus(itemInStore, s);
                return status === 'warning' || status === 'critical';
            }).length,
        };

        const isCriticalHub = stats.alarms > 0;

        const D = DASHBOARD;
        const cabinetTop = D.cabinetBottomY + D.cabinetH;
        const workY = cabinetTop + D.workT / 2;
        const surfaceTop = cabinetTop + D.workT;
        const monW = 0.32;
        const monH = 0.22;
        const dx = D.w * 0.2;
        /** 螢幕組中心較檯面抬高（與 poleH 協調） */
        const armY = surfaceTop + 0.2;
        const metal = isSelected ? "#475569" : "#3d4a5c";
        const metalDark = "#1e293b";

        innerContent = (
            <group>
                {/* 走道用腳輪 */}
                {[
                    [-D.w * 0.38, -D.d * 0.36],
                    [D.w * 0.38, -D.d * 0.36],
                    [-D.w * 0.38, D.d * 0.36],
                    [D.w * 0.38, D.d * 0.36],
                ].map(([x, z], i) => (
                    <mesh key={`wh-${i}`} position={[x, 0.03, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                        <cylinderGeometry args={[0.026, 0.026, 0.04, 12]} />
                        <meshStandardMaterial color="#0f172a" metalness={0.4} roughness={0.65} />
                    </mesh>
                ))}

                {/* 下櫃金屬殼體 */}
                <mesh position={[0, D.cabinetBottomY + D.cabinetH / 2, 0]} castShadow receiveShadow>
                    <boxGeometry args={[D.w, D.cabinetH, D.d]} />
                    <meshStandardMaterial color={metal} metalness={0.55} roughness={0.42} />
                </mesh>
                {/* 正面通風百葉 */}
                {Array.from({ length: 6 }).map((_, i) => (
                    <mesh
                        key={`vent-${i}`}
                        position={[0, D.cabinetBottomY + 0.07 + i * 0.045, D.d / 2 + 0.012]}
                    >
                        <boxGeometry args={[D.w * 0.62, 0.01, 0.016]} />
                        <meshStandardMaterial color="#0f172a" metalness={0.3} roughness={0.75} />
                    </mesh>
                ))}
                {/* 側邊機櫃耳 / 導軌意象 */}
                <mesh position={[-D.w / 2 - 0.01, D.cabinetBottomY + D.cabinetH * 0.5, 0]}>
                    <boxGeometry args={[0.014, 0.14, D.d * 0.55]} />
                    <meshStandardMaterial color="#64748b" metalness={0.75} roughness={0.35} />
                </mesh>
                <mesh position={[D.w / 2 + 0.01, D.cabinetBottomY + D.cabinetH * 0.5, 0]}>
                    <boxGeometry args={[0.014, 0.14, D.d * 0.55]} />
                    <meshStandardMaterial color="#64748b" metalness={0.75} roughness={0.35} />
                </mesh>
                {/* 前面板標示條 */}
                <mesh position={[0, D.cabinetBottomY + D.cabinetH * 0.82, D.d / 2 + 0.014]}>
                    <boxGeometry args={[D.w * 0.45, 0.028, 0.012]} />
                    <meshStandardMaterial color={metalDark} metalness={0.5} roughness={0.5} />
                </mesh>
                <Text position={[0, D.cabinetBottomY + D.cabinetH * 0.82, D.d / 2 + 0.022]} fontSize={0.045} color="#94a3b8" anchorX="center" anchorY="middle">
                    DCIM CONSOLE
                </Text>

                {/* 工作臺面 */}
                <mesh position={[0, workY, 0]} castShadow receiveShadow>
                    <boxGeometry args={[D.w * 0.99, D.workT, D.d * 0.99]} />
                    <meshStandardMaterial color="#334155" metalness={0.72} roughness={0.28} />
                </mesh>
                {/* 檯面前緣狀態燈條 */}
                <mesh position={[0, surfaceTop + 0.008, D.d / 2 - 0.012]}>
                    <boxGeometry args={[D.w * 0.72, 0.008, 0.014]} />
                    <meshStandardMaterial
                        color={isCriticalHub ? "#f87171" : "#22d3ee"}
                        emissive={isCriticalHub ? "#ef4444" : "#06b6d4"}
                        emissiveIntensity={0.45}
                    />
                </mesh>
                {/* 鍵盤屜 */}
                <mesh position={[0, workY - 0.045, D.d * 0.12]}>
                    <boxGeometry args={[D.w * 0.72, 0.018, D.d * 0.38]} />
                    <meshStandardMaterial color="#0f172a" metalness={0.4} roughness={0.6} />
                </mesh>
                {/* 後方理線槽 */}
                <mesh position={[0, workY + 0.06, -D.d / 2 - 0.022]}>
                    <boxGeometry args={[0.055, 0.2, 0.035]} />
                    <meshStandardMaterial color="#1e293b" metalness={0.45} roughness={0.55} />
                </mesh>

                {/* 螢幕支臂立柱 */}
                {[-dx, dx].map((x, i) => (
                    <mesh key={`pole-${i}`} position={[x, surfaceTop + D.poleH / 2, -D.d * 0.12]} castShadow>
                        <cylinderGeometry args={[0.018, 0.02, D.poleH, 10]} />
                        <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.25} />
                    </mesh>
                ))}

                <group position={[-dx, armY, D.d * 0.06]} rotation={[0, 0.18, 0]}>
                    <mesh position={[0, 0, 0]} castShadow>
                        <boxGeometry args={[monW, monH, 0.022]} />
                        <meshStandardMaterial color="#0f172a" metalness={0.2} roughness={0.85} />
                    </mesh>
                    <mesh position={[0, 0, 0.013]}>
                        <planeGeometry args={[monW * 0.92, monH * 0.9]} />
                        <meshBasicMaterial color="#000" />
                    </mesh>
                    <mesh position={[0, 0, 0.015]}>
                        <planeGeometry args={[monW * 0.94, monH * 0.94]} />
                        <meshBasicMaterial color="#06b6d4" transparent opacity={0.26} />
                    </mesh>
                    <Text position={[0, monH * 0.28, 0.018]} fontSize={0.042} color="#06b6d4" anchorX="center" anchorY="middle">
                        TRAFFIC
                    </Text>
                    <Text position={[0, 0.02, 0.018]} fontSize={0.11} color="#fff" anchorX="center" anchorY="middle">
                        {stats.traffic.toFixed(1)}
                    </Text>
                    <Text position={[0, -monH * 0.32, 0.018]} fontSize={0.035} color="#0e7490" anchorX="center" anchorY="middle">
                        Gbps
                    </Text>
                </group>

                <group position={[dx, armY, D.d * 0.06]} rotation={[0, -0.18, 0]}>
                    <mesh position={[0, 0, 0]} castShadow>
                        <boxGeometry args={[monW, monH, 0.022]} />
                        <meshStandardMaterial color="#0f172a" metalness={0.2} roughness={0.85} />
                    </mesh>
                    <mesh position={[0, 0, 0.013]}>
                        <planeGeometry args={[monW * 0.92, monH * 0.9]} />
                        <meshBasicMaterial color="#000" />
                    </mesh>
                    <mesh position={[0, 0, 0.015]}>
                        <planeGeometry args={[monW * 0.94, monH * 0.94]} />
                        <meshBasicMaterial color={isCriticalHub ? "#ef4444" : "#10b981"} transparent opacity={0.26} />
                    </mesh>
                    <Text position={[0, monH * 0.28, 0.018]} fontSize={0.042} color={isCriticalHub ? "#f87171" : "#34d399"} anchorX="center" anchorY="middle">
                        ALARMS
                    </Text>
                    <Text position={[0, 0.02, 0.018]} fontSize={0.13} color={isCriticalHub ? "#ef4444" : "#10b981"} anchorX="center" anchorY="middle">
                        {stats.alarms}
                    </Text>
                    <Text position={[0, -monH * 0.32, 0.018]} fontSize={0.03} color={isCriticalHub ? "#991b1b" : "#064e3b"} anchorX="center" anchorY="middle">
                        {isCriticalHub ? "CRITICAL" : "OPTIMAL"}
                    </Text>
                </group>

                <group position={[0, surfaceTop + D.poleH + 0.18, 0]}>
                    <Text fontSize={0.075} color="#22d3ee" anchorX="center" anchorY="middle">
                        {data.ipAddress || "172.168.100.1"}
                    </Text>
                    <Text position={[0, 0.12, 0]} fontSize={0.1} color={isCriticalHub ? "#ef4444" : "#06b6d4"} anchorX="center" anchorY="middle">
                        {data.name} · NOC
                    </Text>
                    {isCriticalHub && (
                        <mesh position={[0, 0.28, 0]} castShadow>
                            <sphereGeometry args={[0.045, 18, 18]} />
                            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.8} />
                        </mesh>
                    )}
                </group>
            </group>
        );
    }

    return (
        <PivotControls
            visible={isEditMode && isSelected}
            disableAxes={!isEditMode}
            disableSliders={!isEditMode}
            disableRotations={true}
            activeAxes={[true, true, true]}
            onDragEnd={() => { }}
            onDrag={handleDrag}
            matrix={matrix}
        >
            <group
                ref={groupRef}
                onClick={(e) => {
                    e.stopPropagation();
                    selectEquipment(data.id);
                }}
            >
                {innerContent}
            </group>
        </PivotControls>
    );
}
