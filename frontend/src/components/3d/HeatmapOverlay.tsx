"use client";
import React, { useMemo } from "react";
import * as THREE from "three";
import { RackData } from "@/store/useDcimStore";
import { resolveTelemetryRecordDeep } from "@/shared/nodeId";

type Props = {
  racks: RackData[];
  telemetry: Record<string, any>;
};

function rackMaxTemp(rack: RackData, telemetry: Record<string, any>): number {
  if (rack.type !== "server" && rack.type !== "immersion_single" && rack.type !== "immersion_dual") {
    return 25;
  }
  const temps = rack.servers.map((s) => {
    const row = resolveTelemetryRecordDeep(telemetry, s.assetId, s.name);
    const raw = row?.temperature;
    if (raw === undefined || raw === null) return undefined;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n)) return n;
    return undefined;
  });
  const finite = temps.filter((t): t is number => t !== undefined);
  if (finite.length === 0) return 25;
  const m = Math.max(...finite);
  return Number.isFinite(m) ? m : 25;
}

/**
 * 地板熱區：改為純幾何 + meshBasicMaterial，不使用 CanvasTexture。
 * 遙測更新時僅改 React props／Three 材質色，避免動態貼圖上傳在部分驅動造成整屏白畫面。
 */
export default function HeatmapOverlay({ racks, telemetry }: Props) {
  const decals = useMemo(() => {
    const out: {
      key: string;
      x: number;
      z: number;
      radius: number;
      color: string;
      opacity: number;
    }[] = [];

    for (const rack of racks) {
      if (rack.type !== "server" && rack.type !== "immersion_single" && rack.type !== "immersion_dual") continue;
      const maxTemp = rackMaxTemp(rack, telemetry);
      if (maxTemp <= 35) continue;

      const intensity = Math.min(1, (maxTemp - 35) / 50);
      const c = new THREE.Color().setHSL(0.02 + intensity * 0.05, 0.85, 0.42 + 0.15 * (1 - intensity));
      out.push({
        key: rack.id,
        x: rack.position[0],
        z: rack.position[2],
        radius: 0.42 + intensity * 0.55,
        color: `#${c.getHexString()}`,
        opacity: 0.14 + intensity * 0.32,
      });
    }
    return out;
  }, [racks, telemetry]);

  if (decals.length === 0) return null;

  return (
    <group>
      {decals.map((d) => (
        <mesh
          key={d.key}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[d.x, 0.028, d.z]}
          renderOrder={1}
        >
          <circleGeometry args={[d.radius, 48]} />
          <meshBasicMaterial
            color={d.color}
            transparent
            opacity={d.opacity}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
