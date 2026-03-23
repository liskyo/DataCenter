"use client";
import React, { useRef } from 'react';
import { PivotControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { EquipmentData, useDcimStore } from '@/store/useDcimStore';

export default function EquipmentModel({ data }: { data: EquipmentData }) {
    const isEditMode = useDcimStore(state => state.isEditMode);
    const updateEquipmentPosition = useDcimStore(state => state.updateEquipmentPosition);
    const selectEquipment = useDcimStore(state => state.selectEquipment);
    const selectedEquipmentId = useDcimStore(state => state.selectedEquipmentId);

    const isSelected = selectedEquipmentId === data.id;
    const groupRef = useRef<THREE.Group>(null);

    const handleDrag = (localMatrix: THREE.Matrix4) => {
        const pos = new THREE.Vector3();
        pos.setFromMatrixPosition(localMatrix);
        // Snap to grid (0.6 meters)
        const snappedX = Math.round(pos.x / 0.6) * 0.6;
        const snappedZ = Math.round(pos.z / 0.6) * 0.6;
        updateEquipmentPosition(data.id, [snappedX, 0, snappedZ]);
    };

    let innerContent;

    if (data.type === 'crac') {
        innerContent = (
            <group>
                {/* Main Body */}
                <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
                    <boxGeometry args={[1.5, 3, 1.2]} />
                    <meshStandardMaterial color={isSelected ? "#38bdf8" : "#94a3b8"} roughness={0.6} metalness={0.2} />
                </mesh>
                {/* Vent grille (bottom) */}
                <mesh position={[0, 0.5, 0.61]}>
                    <boxGeometry args={[1.2, 0.8, 0.05]} />
                    <meshStandardMaterial color="#0f172a" />
                </mesh>
                {/* Brand / Logo LED */}
                <mesh position={[0, 2.6, 0.61]}>
                    <boxGeometry args={[0.3, 0.05, 0.05]} />
                    <meshBasicMaterial color="#06b6d4" />
                </mesh>
                <Text position={[0, 3.2, 0]} fontSize={0.2} color="#334155" anchorX="center" anchorY="middle">
                    {data.name}
                </Text>
            </group>
        );
    } else if (data.type === 'pdu') {
        innerContent = (
            <group>
                {/* Cabinet */}
                <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
                    <boxGeometry args={[0.8, 2.4, 0.8]} />
                    <meshStandardMaterial color={isSelected ? "#1e40af" : "#020617"} roughness={0.4} metalness={0.7} />
                </mesh>
                {/* Display Screen */}
                <mesh position={[0, 1.8, 0.41]}>
                    <boxGeometry args={[0.4, 0.25, 0.05]} />
                    <meshBasicMaterial color="#10b981" />
                </mesh>
                {/* Indicator light top */}
                <mesh position={[0, 2.45, 0]}>
                    <cylinderGeometry args={[0.06, 0.06, 0.1]} />
                    <meshBasicMaterial color="#f59e0b" />
                </mesh>
                <Text position={[0, 2.7, 0]} fontSize={0.15} color="#334155" anchorX="center" anchorY="middle">
                    {data.name}
                </Text>
            </group>
        );
    } else if (data.type === 'cdu') {
        innerContent = (
            <group>
                <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
                    <boxGeometry args={[0.6, 2.4, 1.0]} />
                    <meshStandardMaterial color={isSelected ? "#2dd4bf" : "#334155"} roughness={0.3} metalness={0.6} />
                </mesh>
                <mesh position={[0, 2.45, -0.2]}>
                    <cylinderGeometry args={[0.05, 0.05, 0.2]} />
                    <meshStandardMaterial color="#ef4444" />
                </mesh>
                <mesh position={[0, 2.45, 0.2]}>
                    <cylinderGeometry args={[0.05, 0.05, 0.2]} />
                    <meshStandardMaterial color="#3b82f6" />
                </mesh>
                <mesh position={[0, 1.5, 0.51]}>
                    <boxGeometry args={[0.3, 0.5, 0.05]} />
                    <meshBasicMaterial color="#0ea5e9" />
                </mesh>
                <Text position={[0, 2.7, 0]} fontSize={0.15} color="#334155" anchorX="center" anchorY="middle">
                    {data.name}
                </Text>
            </group>
        );
    } else if (data.type === 'ups') {
        innerContent = (
            <group>
                {/* Main Battery Cabinet */}
                <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
                    <boxGeometry args={[0.8, 2.4, 0.8]} />
                    <meshStandardMaterial color={isSelected ? "#b45309" : "#1c1917"} roughness={0.5} metalness={0.5} />
                </mesh>
                {/* Battery Status Indicator Bar */}
                <mesh position={[0, 1.2, 0.41]}>
                    <boxGeometry args={[0.1, 1.8, 0.05]} />
                    <meshStandardMaterial color="#166534" emissive="#22c55e" emissiveIntensity={0.5} />
                </mesh>
                <mesh position={[0, 2.7, 0]}>
                    <Text fontSize={0.15} color="#475569" anchorX="center" anchorY="middle">
                        {data.name} (UPS)
                    </Text>
                </mesh>
            </group>
        );
    } else if (data.type === 'chiller') {
        innerContent = (
            <group>
                {/* Industrial Cooling Unit */}
                <mesh position={[0, 1.3, 0]} castShadow receiveShadow>
                    <boxGeometry args={[2.5, 2.6, 2.0]} />
                    <meshStandardMaterial color={isSelected ? "#1e40af" : "#cbd5e1"} roughness={0.4} metalness={0.6} />
                </mesh>
                {/* Blue accents / Fans */}
                <mesh position={[0, 2.61, 0]}>
                    <cylinderGeometry args={[0.8, 0.8, 0.1, 32]} />
                    <meshStandardMaterial color="#3b82f6" transparent opacity={0.6} />
                </mesh>
                <mesh position={[0, 2.9, 0]}>
                    <Text fontSize={0.2} color="#1e3a8a" anchorX="center" anchorY="middle">
                        {data.name} (CHILLER)
                    </Text>
                </mesh>
            </group>
        );
    } else if (data.type === 'dashboard') {
        innerContent = (
            <group>
                {/* Desk */}
                <mesh position={[0, 0.375, 0]} castShadow>
                    <boxGeometry args={[1.6, 0.75, 0.8]} />
                    <meshStandardMaterial color="#475569" />
                </mesh>
                {/* Monitor 1 */}
                <mesh position={[-0.4, 0.9, -0.1]} rotation={[0, 0.2, 0]}>
                    <boxGeometry args={[0.7, 0.4, 0.05]} />
                    <meshStandardMaterial color="#000" emissive="#06b6d4" emissiveIntensity={0.2} />
                </mesh>
                {/* Monitor 2 */}
                <mesh position={[0.4, 0.9, -0.1]} rotation={[0, -0.2, 0]}>
                    <boxGeometry args={[0.7, 0.4, 0.05]} />
                    <meshStandardMaterial color="#000" emissive="#06b6d4" emissiveIntensity={0.2} />
                </mesh>
                {/* IP Label */}
                {data.ipAddress && (
                    <Text position={[0, 1.2, 0]} fontSize={0.12} color="#22d3ee" anchorX="center" anchorY="middle">
                        IP: {data.ipAddress}
                    </Text>
                )}
                <Text position={[0, 1.4, 0]} fontSize={0.15} color="#334155" anchorX="center" anchorY="middle">
                    {data.name} (HUB)
                </Text>
            </group>
        );
    }

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
                    selectEquipment(data.id);
                }}
            >
                {innerContent}
            </group>
        </PivotControls>
    );
}
