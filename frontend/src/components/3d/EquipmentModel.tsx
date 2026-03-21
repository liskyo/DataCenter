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
                    if (isEditMode) selectEquipment(data.id);
                }}
            >
                {innerContent}
            </group>
        </PivotControls>
    );
}
