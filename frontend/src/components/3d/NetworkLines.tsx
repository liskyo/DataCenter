"use client";
import React, { useMemo } from 'react';
import { QuadraticBezierLine } from '@react-three/drei';
import { useDcimStore } from '@/store/useDcimStore';
import * as THREE from 'three';

export default function NetworkLines() {
    const store = useDcimStore();
    const racks = useMemo(() =>
        store.racks.filter(r => r.locationId === store.currentLocationId),
        [store.racks, store.currentLocationId]
    );

    // Find all network racks in the current location
    const networkRacks = useMemo(() => racks.filter(r => r.type === 'network'), [racks]);

    if (networkRacks.length === 0) return null;

    return (
        <group>
            {racks.filter(r => r.type === 'server' || r.type === 'immersion_single' || r.type === 'immersion_dual').map((rack, idx) => {
                // Determine target rack: specific connection or first available network rack (hub)
                const targetRack = racks.find(r => r.id === rack.connectedNetworkRackId) || networkRacks[0];

                if (!targetRack) return null;

                // Palette for different server racks
                const COLORS = ['#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6'];
                const cableColor = COLORS[idx % COLORS.length];

                // Determine target height: specific switch center or default to top of rack
                const targetSwitch = targetRack.servers.find(s => s.id === rack.connectedSwitchId);
                const U_HEIGHT = 0.04445;
                let targetY = 2.2; // Default to top of rack

                if (targetSwitch) {
                    // Match ServerModel.tsx formula for exact vertical center
                    targetY = 0.1 + (targetSwitch.uPosition - 1) * U_HEIGHT + (targetSwitch.uHeight * U_HEIGHT) / 2;
                }

                const RACK_DEPTH = 1.0;
                const sourceY = rack.type === 'server' ? 2.2 : 1.15;
                const start: [number, number, number] = [rack.position[0], sourceY, rack.position[2] - RACK_DEPTH / 2];
                const end: [number, number, number] = [targetRack.position[0], targetY, targetRack.position[2] - RACK_DEPTH / 2];

                // Control point for curve (elevate it to look like overhead cabling)
                const mid: [number, number, number] = [
                    (start[0] + end[0]) / 2,
                    Math.max(start[1], end[1]) + 1.2,
                    (start[2] + end[2]) / 2
                ];

                return (
                    <QuadraticBezierLine
                        key={`${rack.id}-${targetRack.id}`}
                        start={start}
                        end={end}
                        mid={mid}
                        color={cableColor}
                        lineWidth={3}
                        transparent
                        opacity={0.6}
                        dashed={true}
                        dashScale={12}
                    />
                );
            })}
        </group>
    );
}
