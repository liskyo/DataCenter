"use client";
import React, { useRef } from 'react';
import { PivotControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { RackData, useDcimStore } from '@/store/useDcimStore';
import { ServerBodyInstance, ServerLedInstance } from './ServerModel';
import { Instances } from '@react-three/drei';
import ImmersionTankModel from './ImmersionTankModel';
import { U_HEIGHT, RACK_WIDTH, RACK_DEPTH } from './sceneScale';
import { getDeviceStatus } from '@/shared/status';

function normalizeNodeId(value: string): string {
    const raw = (value || "").trim().toUpperCase().replace(/\s+/g, "").replace(/_/g, "-");
    const m = raw.match(/^(SERVER|SW|IMM|CDU)-?(\d+)$/);
    if (!m) return raw;
    return `${m[1]}-${String(Number(m[2])).padStart(3, "0")}`;
}

function pickTelemetry(telemetry: Record<string, any>, assetId: string | undefined, name: string) {
    const keys = [assetId, name, normalizeNodeId(name)].filter((k): k is string => Boolean(k && k.length));
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

export default function RackModel({ data, isSelected, telemetry = {} }: { data: RackData, isSelected: boolean, telemetry?: Record<string, any> }) {
    const rackHeight = data.uCapacity * U_HEIGHT + 0.2; // Add 0.1 bottom + 0.1 top margins
    const updateRackPosition = useDcimStore(state => state.updateRackPosition);
    const updateRackRotation = useDcimStore(state => state.updateRackRotation);
    const selectRack = useDcimStore(state => state.selectRack);

    const groupRef = useRef<THREE.Group>(null);

    // 計算加總負載
    const currentKw = data.servers.reduce((sum, s) => sum + s.powerKw, 0);
    const powerUsagePercent = (currentKw / data.maxPowerKw) * 100;

    let hasCriticalServer = false;
    let hasWarningServer = false;

    data.servers.forEach(server => {
        const sTel = pickTelemetry(telemetry, server.assetId, server.name);
        const status = getDeviceStatus(
            { type: server.type, rackType: data.type },
            sTel,
        );
        if (status === 'critical') hasCriticalServer = true;
        else if (status === 'warning') hasWarningServer = true;
    });

    let frameColor = "#364152"; // charcoal gray frame
    if (powerUsagePercent > 95) {
        frameColor = "#ef4444"; // Red (Only for Power > 95%)
    } else if (powerUsagePercent > 90) {
        frameColor = "#f59e0b"; // Yellow (Only for Power > 90%)
    }

    if (isSelected) {
        frameColor = "#06b6d4"; // Highlight when selected
    }

    // Heatmap data: average temp of servers in this rack
    const temps = data.servers
        .map((s) => pickTelemetry(telemetry, s.assetId, s.name)?.temperature)
        .map((t) => (typeof t === "number" ? t : Number(t)))
        .filter((t): t is number => Number.isFinite(t));
    const avgTemp = temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : 22;

    const getHeatColor = (t: number) => {
        if (t > 50) return "#ef4444";
        if (t > 40) return "#f59e0b";
        return "#3b82f6";
    };

    const heatmapColor = getHeatColor(avgTemp);

    const handleDrag = (localMatrix: THREE.Matrix4) => {
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        localMatrix.decompose(pos, quat, scale);

        const euler = new THREE.Euler().setFromQuaternion(quat);

        // Snap to grid (0.6 meters)
        const snappedX = Math.round(pos.x / 0.6) * 0.6;
        const snappedZ = Math.round(pos.z / 0.6) * 0.6;

        updateRackPosition(data.id, [snappedX, 0, snappedZ]);
        updateRackRotation(data.id, [0, euler.y, 0]);
    };

    const matrix = React.useMemo(() => {
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(data.rotation[0], data.rotation[1], data.rotation[2]));
        m.compose(new THREE.Vector3(data.position[0], 0, data.position[2]), q, new THREE.Vector3(1, 1, 1));
        return m;
    }, [data.position, data.rotation]);

    const isEditMode = useDcimStore(state => state.isEditMode);

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
                    selectRack(data.id);
                }}
            >
                {/* Immersion tank delegation */}
                {(data.type === 'immersion_single' || data.type === 'immersion_dual') ? (
                    <ImmersionTankModel data={data} isSelected={isSelected} telemetry={telemetry} />
                ) : (<>
                {/* Rack Frame outer box (Translucent) */}
                <mesh position={[0, rackHeight / 2, 0]} castShadow>
                    <boxGeometry args={[RACK_WIDTH, rackHeight, RACK_DEPTH]} />
                    <meshStandardMaterial
                        color={frameColor}
                        transparent
                        opacity={isSelected ? 0.3 : 0.15}
                        wireframe={!isSelected}
                        emissive="#000"
                        emissiveIntensity={0}
                    />
                </mesh>

                {/* Industrial Corner Pillars for Network Rack */}
                {data.type === 'network' && (
                    <group>
                        {[
                            [-RACK_WIDTH / 2, 0, -RACK_DEPTH / 2],
                            [RACK_WIDTH / 2, 0, -RACK_DEPTH / 2],
                            [-RACK_WIDTH / 2, 0, RACK_DEPTH / 2],
                            [RACK_WIDTH / 2, 0, RACK_DEPTH / 2]
                        ].map((pos, i) => (
                            <mesh key={i} position={[pos[0], rackHeight / 2, pos[2]]}>
                                <boxGeometry args={[0.04, rackHeight, 0.04]} />
                                <meshStandardMaterial color="#57534e" metalness={0.65} roughness={0.35} />
                            </mesh>
                        ))}
                    </group>
                )}

                {/* Rack Base / Roof for solid look */}
                <mesh position={[0, 0.05, 0]}>
                    <boxGeometry args={[RACK_WIDTH, 0.1, RACK_DEPTH]} />
                    <meshStandardMaterial color={frameColor} />
                </mesh>
                <mesh position={[0, rackHeight - 0.05, 0]}>
                    <boxGeometry args={[RACK_WIDTH, 0.1, RACK_DEPTH]} />
                    <meshStandardMaterial color={frameColor} />
                </mesh>

                {/* Label */}
                <Text
                    position={[0, rackHeight + 0.1, 0]}
                    fontSize={0.15}
                    color="#1e293b"
                    anchorX="center"
                    anchorY="middle"
                >
                    {data.name}
                </Text>

                {/* Server Anomaly Floating Icon */}
                {(hasCriticalServer || hasWarningServer) && (
                    <Text
                        position={[0, rackHeight + 0.35, 0]}
                        fontSize={0.25}
                        color={hasCriticalServer ? "#ef4444" : "#f59e0b"}
                        anchorX="center"
                        anchorY="middle"
                    >
                        {hasCriticalServer ? "🔥" : "⚠️"}
                    </Text>
                )}

                {/* Power Usage Mini Bar */}
                <mesh position={[0, rackHeight - 0.15, RACK_DEPTH / 2 + 0.01]}>
                    <planeGeometry args={[RACK_WIDTH * 0.8, 0.05]} />
                    <meshBasicMaterial color="#334155" />
                </mesh>
                <mesh position={[(-RACK_WIDTH * 0.8 / 2) + ((RACK_WIDTH * 0.8 * Math.min(100, powerUsagePercent) / 100) / 2), rackHeight - 0.15, RACK_DEPTH / 2 + 0.011]}>
                    <planeGeometry args={[RACK_WIDTH * 0.8 * (Math.min(100, powerUsagePercent) / 100), 0.05]} />
                    <meshBasicMaterial color={powerUsagePercent > 90 ? "#ef4444" : "#10b981"} />
                </mesh>

                {/* Render Servers inside */}
                {data.servers.length > 0 && (
                    <group>
                        <Instances limit={Math.max(1, data.servers.length)} castShadow receiveShadow>
                            <boxGeometry args={[1, 1, 1]} />
                            <meshStandardMaterial metalness={0.2} roughness={0.8} />
                            {data.servers.map((server, idx) => (
                                <ServerBodyInstance
                                    key={`body-${data.id}-${server.id}-${idx}`}
                                    data={server}
                                    telemetry={pickTelemetry(telemetry, server.assetId, server.name)}
                                />
                            ))}
                        </Instances>

                        <Instances limit={Math.max(1, data.servers.length)}>
                            <boxGeometry args={[1, 1, 1]} />
                            <meshBasicMaterial toneMapped={false} />
                            {data.servers.map((server, idx) => (
                                <ServerLedInstance
                                    key={`led-${data.id}-${server.id}-${idx}`}
                                    data={server}
                                    telemetry={pickTelemetry(telemetry, server.assetId, server.name)}
                                />
                            ))}
                        </Instances>
                    </group>
                )}

                {/* Heatmap Environmental Sensor Nodes (Front) */}
                <group position={[0, 0, RACK_DEPTH / 2 + 0.05]}>
                    {/* Top Sensor */}
                    <mesh position={[0, rackHeight - 0.2, 0]}>
                        <sphereGeometry args={[0.04, 16, 16]} />
                        <meshStandardMaterial color={heatmapColor} emissive={heatmapColor} emissiveIntensity={0.8} transparent opacity={0.6} />
                    </mesh>
                    {/* Mid Sensor */}
                    <mesh position={[0, rackHeight / 2, 0]}>
                        <sphereGeometry args={[0.04, 16, 16]} />
                        <meshStandardMaterial color={heatmapColor} emissive={heatmapColor} emissiveIntensity={0.8} transparent opacity={0.6} />
                    </mesh>
                    {/* Bottom Sensor */}
                    <mesh position={[0, 0.2, 0]}>
                        <sphereGeometry args={[0.04, 16, 16]} />
                        <meshStandardMaterial color={heatmapColor} emissive={heatmapColor} emissiveIntensity={0.8} transparent opacity={0.6} />
                    </mesh>
                </group>

                {/* Network Rack Identifier */}
                {data.type === 'network' && (
                    <Text position={[0, rackHeight + 0.25, 0]} fontSize={0.12} color="#a855f7">
                        [ NETWORK CORE ]
                    </Text>
                )}
                </>)}
            </group>
        </PivotControls>
    );
}
