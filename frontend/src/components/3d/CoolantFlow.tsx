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
  particleCount = 24,
}: CoolantFlowProps) {
  const pointsRef = useRef<THREE.Points>(null!);

  // Build a curved spline: arc slightly upward through a mid-waypoint
  const curve = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const mid = start.clone().lerp(end, 0.5);
    mid.y += 1.2; // arc height above floor

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
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        color={color}
        size={0.06}
        sizeAttenuation
        transparent
        opacity={0.85}
        depthWrite={false}
      />
    </points>
  );
}
