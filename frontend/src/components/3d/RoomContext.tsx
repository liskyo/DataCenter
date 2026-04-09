"use client";
import React from 'react';
import { Grid, ContactShadows } from '@react-three/drei';
import { useDcimStore } from '@/store/useDcimStore';

export default function RoomContext() {
    const store = useDcimStore();
    const loc = store.locations.find(l => l.id === store.currentLocationId);
    
    // Default boundaries if undefined
    const xMin = loc?.xMin ?? -10;
    const xMax = loc?.xMax ?? 10;
    const zMin = loc?.zMin ?? -7.5;
    const zMax = loc?.zMax ?? 7.5;
    const doorPos = loc?.doorPosition || 'right';

    const width = xMax - xMin;
    const depth = zMax - zMin;
    const centerX = (xMin + xMax) / 2;
    const centerZ = (zMin + zMax) / 2;

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

            <ContactShadows position={[centerX, 0, centerZ]} color="#000000" opacity={0.5} scale={Math.max(width, depth) * 1.5} blur={2.5} far={4} />

            {/* 實體壓克力質感地板 (Dynamic bounds) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[centerX, -0.05, centerZ]} receiveShadow>
                <planeGeometry args={[width, depth]} />
                <meshStandardMaterial color="#ffffff" roughness={0.1} metalness={0.2} />
            </mesh>
            
            <Walls xMin={xMin} xMax={xMax} zMin={zMin} zMax={zMax} doorPos={doorPos} wallHeight={wallHeight} wallThick={wallThick} doorW={doorW} doorH={doorH} />
        </group>
    );
}

function Walls({ xMin, xMax, zMin, zMax, doorPos, wallHeight, wallThick, doorW, doorH }: any) {
    const width = xMax - xMin;
    const depth = zMax - zMin;
    const centerX = (xMin + xMax) / 2;
    const centerZ = (zMin + zMax) / 2;
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

        // Wall with door in the center of its specific length
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
            {/* Front Wall (+Z) - Hidden for cutaway view */}
            {/* {buildWall([centerX, 0, zMax], [0, 0, 0], width, doorPos === 'front')} */}
            {/* Back Wall (-Z) */}
            {buildWall([centerX, 0, zMin], [0, 0, 0], width, doorPos === 'back')}
            {/* Left Wall (-X) */}
            {buildWall([xMin, 0, centerZ], [0, Math.PI / 2, 0], depth, doorPos === 'left')}
            {/* Right Wall (+X) */}
            {buildWall([xMax, 0, centerZ], [0, Math.PI / 2, 0], depth, doorPos === 'right')}
        </group>
    );
}
