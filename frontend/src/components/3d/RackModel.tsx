"use client";
import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { PivotControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { RackData, useDcimStore } from '@/store/useDcimStore';
import ServerModel from './ServerModel';

const U_HEIGHT = 0.04445;
const RACK_WIDTH = 0.6;
const RACK_DEPTH = 1.0;

export default function RackModel({ data, isSelected, telemetry = {} }: { data: RackData, isSelected: boolean, telemetry?: Record<string, any> }) {
    const rackHeight = data.uCapacity * U_HEIGHT + 0.1; // Add frame margin
    const updateRackPosition = useDcimStore(state => state.updateRackPosition);
    const selectRack = useDcimStore(state => state.selectRack);

    const groupRef = useRef<THREE.Group>(null);

    // 計算加總負載
    const currentKw = data.servers.reduce((sum, s) => sum + s.powerKw, 0);
    const powerUsagePercent = (currentKw / data.maxPowerKw) * 100;

    let hasCriticalServer = false;
    let hasWarningServer = false;

    data.servers.forEach(server => {
        const sTel = telemetry[server.name];
        if (sTel) {
            if (sTel.temperature > 50 || sTel.cpu_usage > 85) hasCriticalServer = true;
            else if (sTel.temperature > 40 || sTel.cpu_usage > 60) hasWarningServer = true;
        }
    });

    let frameColor = "#1e3a8a"; // normal blue frame
    if (powerUsagePercent > 90) {
        frameColor = "#ef4444"; // Red (Only for Power > 90%)
    } else if (powerUsagePercent > 70) {
        frameColor = "#f59e0b"; // Yellow (Only for Power > 70%)
    }

    if (isSelected) {
        frameColor = "#06b6d4"; // Highlight when selected
    }

    const handleDrag = (localMatrix: THREE.Matrix4) => {
        const pos = new THREE.Vector3();
        pos.setFromMatrixPosition(localMatrix);
        // Snap to grid (0.6 meters)
        const snappedX = Math.round(pos.x / 0.6) * 0.6;
        const snappedZ = Math.round(pos.z / 0.6) * 0.6;
        updateRackPosition(data.id, [snappedX, 0, snappedZ]);
    };

    const isEditMode = useDcimStore(state => state.isEditMode);

    return (
        <PivotControls
            visible={isEditMode && isSelected}
            disableAxes={!isEditMode}
            disableSliders={!isEditMode}
            disableRotations={true}
            activeAxes={[true, false, true]}
            onDragEnd={() => { }}
            onDrag={handleDrag}
            matrix={new THREE.Matrix4().setPosition(data.position[0], 0, data.position[2])}
        >
            <group
                ref={groupRef}
                onClick={(e) => {
                    e.stopPropagation();
                    if (isEditMode) selectRack(data.id);
                }}
            >
                {/* Rack Frame outer box (Translucent) */}
                <mesh position={[0, rackHeight / 2, 0]} castShadow>
                    <boxGeometry args={[RACK_WIDTH, rackHeight, RACK_DEPTH]} />
                    <meshStandardMaterial
                        color={frameColor}
                        transparent
                        opacity={isSelected ? 0.3 : 0.15}
                        wireframe={!isSelected}
                    />
                </mesh>

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
                {data.servers.map(server => (
                    <ServerModel key={server.id} data={server} telemetry={telemetry[server.name]} />
                ))}
            </group>
        </PivotControls>
    );
}
