"use client";
import React, { useRef } from 'react';
import { PivotControls, Text, Html } from '@react-three/drei';
import * as THREE from 'three';
import { EquipmentData, useDcimStore } from '@/store/useDcimStore';
import CDUModel from './CDUModel';

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

        // Snap to grid (0.6 meters)
        const snappedX = Math.round(pos.x / 0.6) * 0.6;
        const snappedZ = Math.round(pos.z / 0.6) * 0.6;

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

    let innerContent;

    const isPoweredOff = telemetry?.power_state === 'off';

    if (data.type === 'crac') {
        const bodyColor = isPoweredOff ? "#1a1a1a" : (isSelected ? "#38bdf8" : "#94a3b8");
        innerContent = (
            <group>
                {/* Main Body */}
                <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
                    <boxGeometry args={[1.5, 3, 1.2]} />
                    <meshStandardMaterial color={bodyColor} roughness={0.6} metalness={0.2} />
                </mesh>
                {/* Vent grille (bottom) */}
                <mesh position={[0, 0.5, 0.61]}>
                    <boxGeometry args={[1.2, 0.8, 0.05]} />
                    <meshStandardMaterial color="#0f172a" />
                </mesh>
                {/* Brand / Logo LED */}
                <mesh position={[0, 2.6, 0.61]}>
                    <boxGeometry args={[0.3, 0.05, 0.05]} />
                    <meshBasicMaterial color={isPoweredOff ? "#111" : "#06b6d4"} />
                </mesh>
                <Text position={[0, 3.2, 0]} fontSize={0.2} color={isPoweredOff ? "#334" : "#334155"} anchorX="center" anchorY="middle">
                    {data.name} {isPoweredOff && "(OFF)"}
                </Text>
            </group>
        );
    } else if (data.type === 'pdu') {
        const bodyColor = isPoweredOff ? "#0a0a0a" : (isSelected ? "#1e40af" : "#020617");
        innerContent = (
            <group>
                {/* Cabinet */}
                <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
                    <boxGeometry args={[0.8, 2.4, 0.8]} />
                    <meshStandardMaterial color={bodyColor} roughness={0.4} metalness={0.7} />
                </mesh>
                {/* Display Screen */}
                <mesh position={[0, 1.8, 0.41]}>
                    <boxGeometry args={[0.4, 0.25, 0.05]} />
                    <meshBasicMaterial color={isPoweredOff ? "#111" : "#10b981"} />
                </mesh>
                {/* Indicator light top */}
                <mesh position={[0, 2.45, 0]}>
                    <cylinderGeometry args={[0.06, 0.06, 0.1]} />
                    <meshBasicMaterial color={isPoweredOff ? "#222" : "#f59e0b"} />
                </mesh>
                <Text position={[0, 2.7, 0]} fontSize={0.15} color="#334155" anchorX="center" anchorY="middle">
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
                {/* Main Battery Cabinet */}
                <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
                    <boxGeometry args={[0.8, 2.4, 0.8]} />
                    <meshStandardMaterial color={bodyColor} roughness={0.5} metalness={0.5} />
                </mesh>
                {/* Battery Status Indicator Bar */}
                <mesh position={[0, 1.2, 0.41]}>
                    <boxGeometry args={[0.1, 1.8, 0.05]} />
                    <meshStandardMaterial color={isPoweredOff ? "#111" : "#166534"} emissive={isPoweredOff ? "#000" : "#22c55e"} emissiveIntensity={isPoweredOff ? 0 : 0.5} />
                </mesh>
                <mesh position={[0, 2.7, 0]}>
                    <Text fontSize={0.15} color="#475569" anchorX="center" anchorY="middle">
                        {data.name} (UPS)
                    </Text>
                </mesh>
            </group>
        );
    } else if (data.type === 'chiller') {
        const bodyColor = isPoweredOff ? "#0a0a0a" : (isSelected ? "#0284c7" : "#0f172a");
        innerContent = (
            <group>
                {/* Slim High-Tech Body */}
                <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
                    <boxGeometry args={[1.2, 2.4, 1.2]} />
                    <meshStandardMaterial color={bodyColor} roughness={0.2} metalness={0.8} />
                </mesh>
                
                {/* Glowing Core Tube / Coolant Pipe */}
                <mesh position={[0, 1.2, 0]}>
                    <cylinderGeometry args={[0.4, 0.4, 2.45, 16]} />
                    <meshStandardMaterial 
                        color={isPoweredOff ? "#111" : "#0ea5e9"} 
                        emissive={isPoweredOff ? "#000" : "#0284c7"} 
                        emissiveIntensity={isPoweredOff ? 0 : (isSelected ? 2 : 1.2)} 
                        transparent 
                        opacity={isPoweredOff ? 0.3 : 0.6} 
                    />
                </mesh>

                {/* Digital HUD Panel */}
                <mesh position={[0, 1.8, 0.61]}>
                    <boxGeometry args={[0.8, 0.4, 0.02]} />
                    <meshBasicMaterial color="#000" />
                </mesh>
                <Text position={[0, 1.8, 0.63]} fontSize={0.08} color={isPoweredOff ? "#334" : "#22d3ee"} anchorX="center" anchorY="middle">
                    {isPoweredOff ? "SYSTEM: OFF" : "COOLANT: OPTIMAL"}
                </Text>

                {/* Top Holographic Halo */}
                {!isPoweredOff && (
                    <mesh position={[0, 2.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
                        <torusGeometry args={[0.45, 0.02, 16, 32]} />
                        <meshBasicMaterial color="#38bdf8" />
                    </mesh>
                )}

                <mesh position={[0, 2.8, 0]}>
                    <Text fontSize={0.15} color={isPoweredOff ? "#334" : "#7dd3fc"} anchorX="center" anchorY="middle">
                        {data.name} (CHILLER)
                    </Text>
                </mesh>
            </group>
        );
    } else if (data.type === 'dashboard') {
        const allServers = racks.flatMap(r => r.servers.map(s => ({ ...s, rackType: r.type })));

        const stats = {
            traffic: Object.values(telemetry || {}).reduce((acc: number, s: any) => acc + (s.traffic_gbps || 0), 0) as number,
            alarms: allServers.filter(srvInStore => {
                const s = telemetry[srvInStore.name];
                if (!s) return false;
                const cpu = s.cpu_usage || 0;
                const temp = s.temperature || 0;
                const traffic = s.traffic_gbps || 0;
                const ports = s.ports_active || 0;

                // Unified Critical Thresholds
                if (srvInStore.type === 'switch' || srvInStore.rackType === 'network') {
                    return cpu > 85 || temp > 55 || traffic > 35 || ports > 42;
                } else {
                    return cpu > 85 || temp > 55;
                }
            }).length
        };

        const isCriticalHub = stats.alarms > 0;

        innerContent = (
            <group>
                {/* Desk Surface (Slim) */}
                <mesh position={[0, 0.725, 0]}>
                    <boxGeometry args={[1.8, 0.05, 0.9]} />
                    <meshStandardMaterial color={isSelected ? "#334155" : "#1e293b"} roughness={0.4} metalness={0.7} />
                </mesh>
                {/* Metallic Legs */}
                {[[-0.8, -0.35], [0.8, -0.35], [-0.8, 0.35], [0.8, 0.35]].map(([x, z], i) => (
                    <mesh key={`leg-${i}`} position={[x, 0.35, z]}>
                        <boxGeometry args={[0.06, 0.7, 0.06]} />
                        <meshStandardMaterial color="#94a3b8" metalness={1} roughness={0.1} />
                    </mesh>
                ))}

                {/* Left Monitor (High-Visibility Stats) */}
                <group position={[-0.45, 0.75, -0.2]} rotation={[0, 0.2, 0]}>
                    <mesh position={[0, 0.1, 0]}>
                        <boxGeometry args={[0.05, 0.2, 0.03]} />
                        <meshStandardMaterial color="#020617" />
                    </mesh>
                    <mesh position={[0, 0.25, 0.01]} castShadow>
                        <boxGeometry args={[0.8, 0.45, 0.04]} />
                        <meshStandardMaterial color="#020617" />
                    </mesh>
                    {/* Screen Background + Frame */}
                    <mesh position={[0, 0.25, 0.031]}>
                        <planeGeometry args={[0.76, 0.41]} />
                        <meshBasicMaterial color="#000" />
                    </mesh>
                    <mesh position={[0, 0.25, 0.032]}>
                        <planeGeometry args={[0.78, 0.43]} />
                        <meshBasicMaterial color="#06b6d4" transparent opacity={0.3} />
                    </mesh>
                    {/* Large Native Text for perfect stability */}
                    <Text position={[0, 0.32, 0.035]} fontSize={0.08} color="#06b6d4" anchorX="center" anchorY="middle">
                        TRAFFIC
                    </Text>
                    <Text position={[0, 0.18, 0.035]} fontSize={0.24} color="#fff" anchorX="center" anchorY="middle">
                        {stats.traffic.toFixed(1)}
                    </Text>
                    <Text position={[0, 0.05, 0.035]} fontSize={0.06} color="#0e7490" anchorX="center" anchorY="middle">
                        Gbps
                    </Text>
                </group>

                {/* Right Monitor (High-Visibility Alarms) */}
                <group position={[0.45, 0.75, -0.2]} rotation={[0, -0.2, 0]}>
                    <mesh position={[0, 0.1, 0]}>
                        <boxGeometry args={[0.05, 0.2, 0.03]} />
                        <meshStandardMaterial color="#020617" />
                    </mesh>
                    <mesh position={[0, 0.25, 0.01]} castShadow>
                        <boxGeometry args={[0.8, 0.45, 0.04]} />
                        <meshStandardMaterial color="#020617" />
                    </mesh>
                    {/* Screen Background + Frame */}
                    <mesh position={[0, 0.25, 0.031]}>
                        <planeGeometry args={[0.76, 0.41]} />
                        <meshBasicMaterial color="#000" />
                    </mesh>
                    <mesh position={[0, 0.25, 0.032]}>
                        <planeGeometry args={[0.78, 0.43]} />
                        <meshBasicMaterial color={isCriticalHub ? "#ef4444" : "#10b981"} transparent opacity={0.3} />
                    </mesh>
                    {/* Large Native Text for perfect stability */}
                    <Text position={[0, 0.32, 0.035]} fontSize={0.08} color={isCriticalHub ? "#f87171" : "#34d399"} anchorX="center" anchorY="middle">
                        ALARMS
                    </Text>
                    <Text position={[0, 0.18, 0.035]} fontSize={0.28} color={isCriticalHub ? "#ef4444" : "#10b981"} anchorX="center" anchorY="middle">
                        {stats.alarms}
                    </Text>
                    <Text position={[0, 0.05, 0.035]} fontSize={0.05} color={isCriticalHub ? "#991b1b" : "#064e3b"} anchorX="center" anchorY="middle">
                        {isCriticalHub ? 'CRITICAL ALERT' : 'SYSTEM OPTIMAL'}
                    </Text>
                </group>

                {/* Peripherals */}
                <mesh position={[0, 0.755, 0.1]}>
                    <boxGeometry args={[0.5, 0.01, 0.18]} />
                    <meshStandardMaterial color="#020617" />
                </mesh>
                <mesh position={[0.4, 0.755, 0.15]}>
                    <boxGeometry args={[0.06, 0.01, 0.1]} />
                    <meshStandardMaterial color="#020617" />
                </mesh>

                {/* Command Floating HUD */}
                <group position={[0, 1.4, 0]}>
                    <Text fontSize={0.12} color="#22d3ee" anchorX="center" anchorY="middle">
                        IP: {data.ipAddress || "172.168.100.1"}
                    </Text>
                    <Text position={[0, 0.25, 0]} fontSize={0.18} color={isCriticalHub ? "#ef4444" : "#06b6d4"} anchorX="center" anchorY="middle">
                        {data.name} (HUB)
                    </Text>
                    {isCriticalHub && (
                        <mesh position={[0, 0.5, 0]} castShadow>
                            <sphereGeometry args={[0.07, 24, 24]} />
                            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={2} />
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
