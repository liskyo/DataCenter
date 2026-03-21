"use client";
import React from 'react';
import { Grid, ContactShadows, Text } from '@react-three/drei';

function CracUnit({ position, name }: { position: [number, number, number], name: string }) {
    return (
        <group position={position}>
            {/* Main Body */}
            <mesh position={[0, 1.5, 0]} castShadow receiveShadow>
                <boxGeometry args={[1.5, 3, 1.2]} />
                <meshStandardMaterial color="#94a3b8" roughness={0.6} metalness={0.2} />
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
                {name}
            </Text>
        </group>
    );
}

function PduUnit({ position, name }: { position: [number, number, number], name: string }) {
    return (
        <group position={position}>
            {/* Cabinet */}
            <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.8, 2.4, 0.8]} />
                <meshStandardMaterial color="#020617" roughness={0.4} metalness={0.7} />
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
                {name}
            </Text>
        </group>
    );
}

export default function RoomContext() {
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
                sectionSize={0.6} // 600mm標準防靜電地板
                cellColor="#f8fafc"
                cellSize={0.6}
                position={[0, 0.01, 0]}
            />

            <ContactShadows position={[0, 0, 0]} color="#000000" opacity={0.5} scale={40} blur={2.5} far={4} />

            {/* 實體壓克力質感地板 */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
                <planeGeometry args={[100, 100]} />
                <meshStandardMaterial color="#ffffff" roughness={0.1} metalness={0.2} />
            </mesh>

            {/* ==== 建築與基礎設施 ==== */}

            {/* 後方主牆 */}
            <mesh position={[0, 2.5, -6]} receiveShadow>
                <boxGeometry args={[20, 5, 0.5]} />
                <meshStandardMaterial color="#fef3c7" />
            </mesh>

            {/* 左側牆面 */}
            <mesh position={[-10, 2.5, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
                <boxGeometry args={[12, 5, 0.5]} />
                <meshStandardMaterial color="#fef3c7" />
            </mesh>

            {/* 右側牆面 (門上方) */}
            <mesh position={[10, 4.05, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
                <boxGeometry args={[12, 1.9, 0.5]} />
                <meshStandardMaterial color="#fef3c7" />
            </mesh>
            {/* 右側牆面 (門內側/後側) */}
            <mesh position={[10, 1.55, -3.65]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
                <boxGeometry args={[4.7, 3.1, 0.5]} />
                <meshStandardMaterial color="#fef3c7" />
            </mesh>
            {/* 右側牆面 (門外側/前側) */}
            <mesh position={[10, 1.55, 3.65]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
                <boxGeometry args={[4.7, 3.1, 0.5]} />
                <meshStandardMaterial color="#fef3c7" />
            </mesh>

            {/* 空調系統 (CRAC Units) - 常見於機房邊緣 */}
            <CracUnit position={[-4, 0, -5]} name="CRAC-01" />
            <CracUnit position={[0, 0, -5]} name="CRAC-02" />
            <CracUnit position={[4, 0, -5]} name="CRAC-03" />

            {/* 配電單元 (PDU/UPS) */}
            <PduUnit position={[-8, 0, -2]} name="PDU-A" />
            <PduUnit position={[-8, 0, 2]} name="PDU-B" />

            {/* 門禁管制門 (Security Door) */}
            <group position={[9.8, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
                {/* 透明玻璃門 */}
                <mesh position={[0, 1.5, 0]}>
                    <boxGeometry args={[2.4, 3, 0.1]} />
                    <meshStandardMaterial color="#cbd5e1" transparent opacity={0.4} roughness={0.5} metalness={0.2} />
                </mesh>
                {/* 門框 */}
                <mesh position={[0, 3.05, 0]}>
                    <boxGeometry args={[2.6, 0.1, 0.15]} />
                    <meshStandardMaterial color="#1e293b" />
                </mesh>
                <mesh position={[-1.25, 1.5, 0]}>
                    <boxGeometry args={[0.1, 3, 0.15]} />
                    <meshStandardMaterial color="#1e293b" />
                </mesh>
                <mesh position={[1.25, 1.5, 0]}>
                    <boxGeometry args={[0.1, 3, 0.15]} />
                    <meshStandardMaterial color="#1e293b" />
                </mesh>
                {/* 刷卡讀卡機 */}
                <mesh position={[1.4, 1.4, 0.1]}>
                    <boxGeometry args={[0.15, 0.3, 0.05]} />
                    <meshBasicMaterial color="#ef4444" />
                </mesh>
            </group>
        </group>
    );
}
