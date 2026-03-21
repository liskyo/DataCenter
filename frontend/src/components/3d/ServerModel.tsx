"use client";
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { ServerData } from '@/store/useDcimStore';
import * as THREE from 'three';

const U_HEIGHT = 0.04445; // 1U = 1.75 inches = 0.04445 meters
const SERVER_WIDTH = 0.44; // 19 inch rack internal
const SERVER_DEPTH = 0.8;

export default function ServerModel({ data, telemetry }: { data: ServerData, telemetry?: any }) {
    const meshRef = useRef<THREE.Mesh>(null);

    let liveStatus = data.status;
    if (telemetry) {
        if (telemetry.temperature > 50 || telemetry.cpu_usage > 85) liveStatus = 'critical';
        else if (telemetry.temperature > 40 || telemetry.cpu_usage > 60) liveStatus = 'warning';
        else liveStatus = 'normal';
    }

    // Position based on U-space (1 to 42, bottom to top)
    const yPos = (data.uPosition - 1) * U_HEIGHT + (data.uHeight * U_HEIGHT) / 2;

    // 動態網格發光指示燈
    const materialRef = useRef<THREE.MeshStandardMaterial>(null);

    useFrame((state) => {
        if (materialRef.current) {
            if (liveStatus === 'critical') {
                const t = Math.sin(state.clock.elapsedTime * 10);
                materialRef.current.emissiveIntensity = t > 0 ? 0.8 : 0.2;
            } else if (liveStatus === 'warning') {
                const t = Math.sin(state.clock.elapsedTime * 2);
                materialRef.current.emissiveIntensity = t > 0 ? 0.5 : 0.1;
            } else {
                materialRef.current.emissiveIntensity = 0.2;
            }
        }
    });

    const getStatusColor = () => {
        switch (liveStatus) {
            case 'critical': return '#ef4444';
            case 'warning': return '#f59e0b';
            case 'offline': return '#64748b';
            case 'normal':
            default: return '#06b6d4';
        }
    };

    const getBodyColor = () => {
        if (liveStatus === 'critical') return '#ef4444'; // Overheat -> Solid Red
        if (liveStatus === 'warning') return '#f59e0b'; // Near limit -> Yellow
        if (data.type === 'storage') return '#1e293b';
        if (data.type === 'switch') return '#0f172a';
        return '#3b82f6';
    };

    return (
        <group position={[0, yPos, 0]}>
            <mesh ref={meshRef} castShadow receiveShadow>
                <boxGeometry args={[SERVER_WIDTH, data.uHeight * U_HEIGHT - 0.002, SERVER_DEPTH]} />
                <meshStandardMaterial color={getBodyColor()} metalness={0.2} roughness={0.8} />
            </mesh>

            {/* Front Panel LED Indicator */}
            <mesh position={[SERVER_WIDTH / 2 - 0.05, 0, SERVER_DEPTH / 2 + 0.001]}>
                <boxGeometry args={[0.02, 0.01, 0.01]} />
                <meshStandardMaterial
                    ref={materialRef}
                    color={getStatusColor()}
                    emissive={getStatusColor()}
                    emissiveIntensity={0.5}
                />
            </mesh>
        </group>
    );
}
