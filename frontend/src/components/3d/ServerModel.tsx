"use client";
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { ServerData } from '@/store/useDcimStore';
import * as THREE from 'three';
import { Instance } from '@react-three/drei';
import { U_HEIGHT } from './sceneScale';

const SERVER_WIDTH = 0.44; // 19 inch rack internal
const SERVER_DEPTH = 0.8;

// Helper to determine status and power metrics
function getLiveStatus(data: ServerData, telemetry: any) {
    let liveStatus = data.status;
    const isPoweredOff = telemetry?.power_state === 'off';

    if (isPoweredOff) {
        liveStatus = 'offline';
    } else if (telemetry) {
        if (telemetry.temperature > 55 || telemetry.cpu_usage > 85) liveStatus = 'critical';
        else if (telemetry.temperature > 45 || telemetry.cpu_usage > 60) liveStatus = 'warning';
        else liveStatus = 'normal';
    }
    return { liveStatus, isPoweredOff };
}

export function ServerBodyInstance({ data, telemetry }: { data: ServerData, telemetry?: any }) {
    const ref = useRef<any>(null);
    const { liveStatus, isPoweredOff } = getLiveStatus(data, telemetry);

    const getBodyColor = () => {
        if (isPoweredOff) return '#1a1a1a'; // Power Off Color
        if (liveStatus === 'critical') return '#ef4444'; // Overheat -> Solid Red
        if (liveStatus === 'warning') return '#f59e0b'; // Near limit -> Yellow
        if (data.type === 'storage') return '#1e293b';
        if (data.type === 'switch') return '#0f172a';
        return '#3b82f6';
    };

    const yPos = 0.1 + (data.uPosition - 1) * U_HEIGHT + (data.uHeight * U_HEIGHT) / 2;

    return (
        <Instance
            ref={ref}
            position={[0, yPos, 0]}
            scale={[SERVER_WIDTH, data.uHeight * U_HEIGHT - 0.002, SERVER_DEPTH]}
            color={getBodyColor()}
        />
    );
}

export function ServerLedInstance({ data, telemetry }: { data: ServerData, telemetry?: any }) {
    const ref = useRef<any>(null);
    const { liveStatus, isPoweredOff } = getLiveStatus(data, telemetry);

    const getStatusColor = () => {
        if (isPoweredOff) return new THREE.Color('#111111');
        switch (liveStatus) {
            case 'critical': return new THREE.Color('#ef4444');
            case 'warning': return new THREE.Color('#f59e0b');
            case 'offline': return new THREE.Color('#64748b');
            case 'normal':
            default: return new THREE.Color('#06b6d4');
        }
    };

    const yPos = 0.1 + (data.uPosition - 1) * U_HEIGHT + (data.uHeight * U_HEIGHT) / 2;
    const baseColor = getStatusColor();

    useFrame((state) => {
        // Direct Mutation: bypasses React rendering lifecycle and sends color directly to InstancedMesh buffer!
        if (ref.current && ref.current.color) {
            if (isPoweredOff) {
                ref.current.color.copy(baseColor).multiplyScalar(0.2);
            } else if (liveStatus === 'critical') {
                const t = Math.sin(state.clock.elapsedTime * 10);
                ref.current.color.copy(baseColor).multiplyScalar(t > 0 ? 1.0 : 0.2);
            } else if (liveStatus === 'warning') {
                const t = Math.sin(state.clock.elapsedTime * 2);
                ref.current.color.copy(baseColor).multiplyScalar(t > 0 ? 1.0 : 0.5);
            } else {
                ref.current.color.copy(baseColor).multiplyScalar(1.0);
            }
        }
    });

    return (
        <Instance
            ref={ref}
            position={[SERVER_WIDTH / 2 - 0.05, yPos, SERVER_DEPTH / 2 + 0.001]}
            scale={[0.02, 0.01, 0.01]}
        />
    );
}
