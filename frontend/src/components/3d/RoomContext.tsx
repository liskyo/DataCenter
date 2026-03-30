"use client";
import React from 'react';
import { Grid, ContactShadows } from '@react-three/drei';
import { useDcimStore } from '@/store/useDcimStore';

export default function RoomContext() {
    const store = useDcimStore();
    const loc = store.locations.find(l => l.id === store.currentLocationId);
    
    // Default to 20x15 if undefined
    const width = loc?.width || 20;
    const depth = loc?.depth || 15;
    const doorPos = loc?.doorPosition || 'right';

    const wallHeight = 5;
    const wallThick = 0.5;
    const doorW = 2.6; // door width
    const doorH = 3.1; // door height

    return (
        <group>
            <color attach="background" args={['#f8fafc']} />
            <ambientLight intensity={1.5} />
            <hemisphereLight args={["#ffffff", "#cbd5e1", 1.5]} />
            <directionalLight position={[15, 20, 10]} intensity={2.0} castShadow />
            <directionalLight position={[-15, 10, -10]} intensity={1.0} color="#0ea5e9" />
            <pointLight position={[0, 4, 0]} intensity={1.5} distance={20} />

            {/* 高架地板網格線 */}
            <Grid
                infiniteGrid
                fadeDistance={30}
                sectionColor="#cbd5e1"
                sectionSize={0.6}
                cellColor="#f8fafc"
                cellSize={0.6}
                position={[0, 0.01, 0]}
            />

            <ContactShadows position={[0, 0, 0]} color="#000000" opacity={0.5} scale={40} blur={2.5} far={4} />

            {/* 實體壓克力質感地板 (Dynamic size) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
                <planeGeometry args={[width, depth]} />
                <meshStandardMaterial color="#ffffff" roughness={0.1} metalness={0.2} />
            </mesh>
            
            <Walls width={width} depth={depth} doorPos={doorPos} wallHeight={wallHeight} wallThick={wallThick} doorW={doorW} doorH={doorH} />
        </group>
    );
}

function Walls({ width, depth, doorPos, wallHeight, wallThick, doorW, doorH }: any) {
    const hw = width / 2;
    const hd = depth / 2;
    const hh = wallHeight / 2;

    const buildWall = (pos: [number, number, number], rot: [number, number, number], len: number, hasDoor: boolean) => {
        if (!hasDoor) {
            return (
                <mesh position={pos} rotation={rot} receiveShadow>
                    <boxGeometry args={[len, wallHeight, wallThick]} />
                    <meshStandardMaterial color="#fef3c7" />
                </mesh>
            );
        }

        // Wall with door in the center
        const sideLen = Math.max(0, (len - doorW) / 2);
        return (
            <group position={pos} rotation={rot}>
                {/* Top header */}
                <mesh position={[0, doorH / 2, 0]} receiveShadow>
                    <boxGeometry args={[doorW, wallHeight - doorH, wallThick]} />
                    <meshStandardMaterial color="#fef3c7" />
                </mesh>
                {/* Left side */}
                <mesh position={[-doorW/2 - sideLen/2, 0, 0]} receiveShadow>
                    <boxGeometry args={[sideLen, wallHeight, wallThick]} />
                    <meshStandardMaterial color="#fef3c7" />
                </mesh>
                {/* Right side */}
                <mesh position={[doorW/2 + sideLen/2, 0, 0]} receiveShadow>
                    <boxGeometry args={[sideLen, wallHeight, wallThick]} />
                    <meshStandardMaterial color="#fef3c7" />
                </mesh>
                {/* Door assembly */}
                <group position={[0, -hh, 0]}>
                    <mesh position={[0, doorH/2, 0]}>
                        <boxGeometry args={[doorW-0.2, doorH-0.1, 0.1]} />
                        <meshStandardMaterial color="#cbd5e1" transparent opacity={0.4} roughness={0.5} metalness={0.2} />
                    </mesh>
                    <mesh position={[0, doorH-0.05, 0]}>
                        <boxGeometry args={[doorW, 0.1, 0.15]} />
                        <meshStandardMaterial color="#1e293b" />
                    </mesh>
                    <mesh position={[-(doorW-0.1)/2, doorH/2, 0]}>
                        <boxGeometry args={[0.1, doorH, 0.15]} />
                        <meshStandardMaterial color="#1e293b" />
                    </mesh>
                    <mesh position={[(doorW-0.1)/2, doorH/2, 0]}>
                        <boxGeometry args={[0.1, doorH, 0.15]} />
                        <meshStandardMaterial color="#1e293b" />
                    </mesh>
                    <mesh position={[(doorW-0.1)/2 + 0.15, doorH/2 - 0.1, 0.1]}>
                        <boxGeometry args={[0.15, 0.3, 0.05]} />
                        <meshBasicMaterial color="#ef4444" />
                    </mesh>
                </group>
            </group>
        );
    };

    return (
        <group position={[0, hh, 0]}>
            {/* Front Wall (+Z) - 預設隱藏以營造透視剖面感 */}
            {/* {buildWall([0, 0, hd], [0, 0, 0], width, doorPos === 'front')} */}
            {/* Back Wall (-Z) */}
            {buildWall([0, 0, -hd], [0, 0, 0], width, doorPos === 'back')}
            {/* Left Wall (-X) */}
            {buildWall([-hw, 0, 0], [0, Math.PI / 2, 0], depth, doorPos === 'left')}
            {/* Right Wall (+X) */}
            {buildWall([hw, 0, 0], [0, Math.PI / 2, 0], depth, doorPos === 'right')}
        </group>
    );
}
