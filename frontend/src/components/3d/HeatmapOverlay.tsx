"use client";
import React, { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { RackData } from '@/store/useDcimStore';

type Props = {
    racks: RackData[];
    telemetry: Record<string, any>;
    xMin: number;
    xMax: number;
    zMin: number;
    zMax: number;
};

// Normalize names similar to RackModel
function normalizeNodeId(value: string): string {
    const raw = (value || "").trim().toUpperCase().replace(/\s+/g, "").replace(/_/g, "-");
    const m = raw.match(/^(SERVER|SW|IMM|CDU)-?(\d+)$/);
    if (!m) return raw;
    return `${m[1]}-${String(Number(m[2])).padStart(3, "0")}`;
}

export default function HeatmapOverlay({ racks, telemetry, xMin, xMax, zMin, zMax }: Props) {
    const width = xMax - xMin;
    const depth = zMax - zMin;
    const centerX = (xMin + xMax) / 2;
    const centerZ = (zMin + zMax) / 2;
    
    // We use a high-res canvas (e.g. 512x512) for smoother gradients
    const canvasRes = 512;
    const { canvas, ctx, texture } = useMemo(() => {
        const c = document.createElement("canvas");
        c.width = canvasRes;
        c.height = canvasRes;
        const context = c.getContext("2d");
        const tex = new THREE.CanvasTexture(c);
        return { canvas: c, ctx: context, texture: tex };
    }, []);

    // Perform drawing only when telemetry or layout changes (120x optimization vs useFrame)
    useEffect(() => {
        if (!ctx) return;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvasRes, canvasRes);
        ctx.globalCompositeOperation = 'screen';

        // Draw heat sources
        let hasHeat = false;
        racks.forEach(rack => {
            if (rack.type !== 'server' && rack.type !== 'immersion_single' && rack.type !== 'immersion_dual') return;
            
            // Calculate average temperature
            const temps = rack.servers.map(s => {
                const keys = [s.assetId, s.name, normalizeNodeId(s.name)].filter((k): k is string => Boolean(k && k.length));
                for (const k of keys) {
                    if (telemetry[k]?.temperature !== undefined) {
                        return telemetry[k].temperature;
                    }
                }
                return undefined;
            }).filter((t): t is number => t !== undefined);
            
            const maxTemp = temps.length > 0 ? Math.max(...temps) : 25;
            
            // Only draw heat if > 35 degrees (configurable threshold for glowing)
            if (maxTemp <= 35) return;
            hasHeat = true;
            
            // Normalize rack coordinates to canvas space [0, canvasRes]
            const rX = rack.position[0];
            const rZ = rack.position[2];
            
            const cx = ((rX - xMin) / width) * canvasRes;
            const cy = ((rZ - zMin) / depth) * canvasRes; 
            
            // Intensity based on temp (e.g. 35 -> 0, 85 -> 1)
            const intensity = Math.min(1, (maxTemp - 35) / 50);
            const radius = 50 + intensity * 60;
            
            const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            const colorR = Math.floor(255);
            const colorG = Math.floor(200 * (1 - intensity)); 
            const colorB = Math.floor(50 * (1 - Math.min(1, intensity * 2))); 
            
            gradient.addColorStop(0, `rgba(${colorR}, ${colorG}, ${colorB}, ${0.85 * intensity})`);
            gradient.addColorStop(1, "rgba(255, 0, 0, 0)");
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fill();
        });

        // Trigger memory flush if there was heat drawn, or if we just cleared previous heat
        texture.needsUpdate = true;
    }, [racks, telemetry, width, depth, xMin, zMin, texture, ctx]);

    useEffect(() => {
        return () => {
            texture.dispose();
        }
    }, [texture]);

    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, 0.02, centerZ]} receiveShadow>
            <planeGeometry args={[width, depth]} />
            <meshBasicMaterial map={texture} transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
    );
}
