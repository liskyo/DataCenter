"use client";
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";

type Props = {
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
};

/**
 * 以 THREE.GridHelper 取代 @react-three/drei 的 shader Grid，
 * 避免部分驅動在遙測觸發重繪時與無限網格著色器互動異常。
 */
export default function RoomFloorGrid({ centerX, centerZ, width, depth }: Props) {
  const helper = useMemo(() => {
    const w = Math.max(0.1, Math.abs(width));
    const d = Math.max(0.1, Math.abs(depth));
    const size = Math.max(8, w + 8, d + 8);
    const divisions = Math.min(120, Math.max(16, Math.round(size / 0.6)));
    const g = new THREE.GridHelper(size, divisions, 0x64748b, 0x94a3b8);
    g.position.set(centerX, 0.012, centerZ);
    return g;
  }, [centerX, centerZ, width, depth]);

  useEffect(() => {
    return () => {
      helper.geometry.dispose();
      if (Array.isArray(helper.material)) {
        helper.material.forEach((m) => m.dispose());
      } else {
        helper.material.dispose();
      }
    };
  }, [helper]);

  return <primitive object={helper} />;
}
