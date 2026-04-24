"use client";
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface CoolantFlowProps {
  /** World-space start point (CDU position) */
  from: [number, number, number];
  /** World-space end point (Rack position) */
  to: [number, number, number];
  /** Coolant flow rate in LPM — controls particle speed */
  flowRate?: number;
  /** "supply" = blue (cold water CDU→Rack), "return" = orange (hot water Rack→CDU) */
  type: "supply" | "return";
  /** Number of particles per line (default 24) */
  particleCount?: number;
}

const SUPPLY_COLOR = new THREE.Color("#38bdf8"); // ice blue
const RETURN_COLOR = new THREE.Color("#f97316"); // hot orange

/**
 * CoolantFlow renders an animated particle stream along a CatmullRom spline
 * between CDU and a rack. Speed scales with flow_rate_lpm.
 */
export default function CoolantFlow({
  from,
  to,
  flowRate = 8.0,
  type,
  /** Number of particles per line (default 64) */
  particleCount = 64,
}: CoolantFlowProps) {
  const pointsRef = useRef<THREE.Points>(null!);

  // Build a curved spline: arc slightly upward through a mid-waypoint
  const curve = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const mid = start.clone().lerp(end, 0.5);

    // 計算水平方向的垂直向量 (Perpendicular vector on XZ plane)
    const dir = end.clone().sub(start);
    const perp = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    
    // 強制讓弧線朝向 Z 軸正方向（機房的「前方」走道）
    // 若機房是直向排列（即 perp.z 趨近 0），則強制朝向 X 軸正方向
    if (Math.abs(perp.z) > 0.1) {
        if (perp.z < 0) perp.negate();
    } else {
        if (perp.x < 0) perp.negate();
    }
    
    // 統一往前拋出 1.5 單位
    mid.add(perp.multiplyScalar(1.5));
    
    // 將水管路線壓低至貼近地面
    mid.y = 0.1;

    return new THREE.CatmullRomCurve3([start, mid, end]);
  }, [from, to]);

  // Initialize particle offsets staggered along [0, 1]
  const offsets = useMemo(() => {
    const arr = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      arr[i] = i / particleCount;
    }
    return arr;
  }, [particleCount]);

  // Pre-allocate geometry positions buffer
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [particleCount]);

  const color = type === "supply" ? SUPPLY_COLOR : RETURN_COLOR;

  // 建立一條半透明的實體管線作為軌道，讓水路痕跡更加明顯
  const tubeGeometry = useMemo(() => {
    return new THREE.TubeGeometry(curve, 64, 0.015, 8, false);
  }, [curve]);

  // Normal speed at 8 LPM = 0.004 per frame; scales linearly
  const speed = (flowRate / 8.0) * 0.004;

  useFrame(() => {
    const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = positions.array as Float32Array;

    for (let i = 0; i < particleCount; i++) {
      // Advance each particle along the curve
      offsets[i] = (offsets[i] + speed) % 1.0;
      const pt = curve.getPoint(offsets[i]);
      arr[i * 3 + 0] = pt.x;
      arr[i * 3 + 1] = pt.y;
      arr[i * 3 + 2] = pt.z;
    }

    positions.needsUpdate = true;
  });

  return (
    <group>
      {/* 底部半透明管線軌道，確保就算粒子很稀疏也能看出路線 */}
      <mesh geometry={tubeGeometry}>
        <meshBasicMaterial color={color} transparent opacity={0.3} depthTest={false} depthWrite={false} />
      </mesh>
      {/* 表面流動的大顆粒子 */}
      <points ref={pointsRef} geometry={geometry}>
        <pointsMaterial
          color={color}
          size={0.08}
          sizeAttenuation
          transparent
          opacity={0.95}
          depthWrite={false}
          depthTest={false} // 關閉深度測試，讓水路粒子可以穿透機櫃顯示（X-ray 效果）
        />
      </points>
    </group>
  );
}
