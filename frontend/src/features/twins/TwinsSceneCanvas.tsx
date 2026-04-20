"use client";

import React, { memo, useCallback, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { EquipmentData, RackData } from "@/store/useDcimStore";
import RoomContext from "@/components/3d/RoomContext";
import RackModel from "@/components/3d/RackModel";
import EquipmentModel from "@/components/3d/EquipmentModel";
import NetworkLines from "@/components/3d/NetworkLines";
import CoolantFlow from "@/components/3d/CoolantFlow";
import HeatmapOverlay from "@/components/3d/HeatmapOverlay";
import { useDcimStore } from "@/store/useDcimStore";

export type TwinsSceneCanvasProps = {
  locationRacks: RackData[];
  locationEquipments: EquipmentData[];
  selectedRackId: string | null;
  telemetry: Record<string, unknown>;
  showConnectionLines: boolean;
  onPointerMissed: () => void;
};

function TwinsSceneCanvasInner({
  locationRacks,
  locationEquipments,
  selectedRackId,
  telemetry,
  showConnectionLines,
  onPointerMissed,
}: TwinsSceneCanvasProps) {
  const [canvasKey, setCanvasKey] = useState(0);
  const [didRecoverContext, setDidRecoverContext] = useState(false);
  const store = useDcimStore();
  const loc = store.locations.find(l => l.id === store.currentLocationId);
  const xMin = loc?.xMin ?? -10;
  const xMax = loc?.xMax ?? 10;
  const zMin = loc?.zMin ?? -7.5;
  const zMax = loc?.zMax ?? 7.5;
  /** 環繞目標設在機房中心，避免原點與場景偏移時搭配 minPolarAngle=0 造成控制數值不穩 */
  const orbitTarget: [number, number, number] = [(xMin + xMax) / 2, 0, (zMin + zMax) / 2];
  const handleCanvasCreated = useCallback(({ gl }: { gl: { domElement: HTMLCanvasElement } }) => {
    const canvas = gl.domElement;
    const onContextLost = (event: Event) => {
      event.preventDefault();
      setDidRecoverContext(true);
      setCanvasKey((key) => key + 1);
    };

    canvas.addEventListener("webglcontextlost", onContextLost, { once: true });
  }, []);

  return (
    <div className="absolute inset-0 min-h-[120px] min-w-[120px]">
    {didRecoverContext && (
      <div className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-md border border-amber-500/40 bg-slate-950/75 px-3 py-1 text-xs text-amber-200 backdrop-blur">
        3D 畫面已自動恢復
      </div>
    )}
    <Canvas
      key={canvasKey}
      camera={{ position: [5, 4, 8], fov: 45, near: 0.08, far: 260 }}
      className="block h-full w-full outline-none touch-none"
      gl={{ alpha: false, antialias: true, powerPreference: "default", stencil: false }}
      dpr={[1, 1.25]}
      shadows={false}
      onPointerMissed={onPointerMissed}
      onCreated={handleCanvasCreated}
    >
      <RoomContext />
      <HeatmapOverlay racks={locationRacks} telemetry={telemetry} />
      {locationRacks.map((rack) => (
        <RackModel key={rack.id} data={rack} isSelected={rack.id === selectedRackId} telemetry={telemetry} />
      ))}
      {locationEquipments.map((eq) => (
        <EquipmentModel key={eq.id} data={eq} telemetry={telemetry} />
      ))}
      {showConnectionLines && <NetworkLines />}
      {showConnectionLines &&
        locationEquipments
          .filter((eq) => eq.type === "cdu")
          .flatMap((cdu) => {
            const cduPos: [number, number, number] = [cdu.position[0], 0, cdu.position[2]];
            const cduTelem = telemetry[cdu.name] as { flow_rate_lpm?: number } | undefined;
            const flowRate = cduTelem?.flow_rate_lpm ?? 8.0;

            const allServerRacks = locationRacks.filter(
              (r) => r.type === "server" || r.type === "immersion_single" || r.type === "immersion_dual",
            );
            const targetRacks =
              cdu.connectedRackIds && cdu.connectedRackIds.length > 0
                ? allServerRacks.filter((r) => cdu.connectedRackIds!.includes(r.id))
                : allServerRacks
                    .map((r) => ({
                      rack: r,
                      dist: Math.hypot(r.position[0] - cdu.position[0], r.position[2] - cdu.position[2]),
                    }))
                    .sort((a, b) => a.dist - b.dist)
                    .slice(0, 3)
                    .map((x) => x.rack);

            return targetRacks.flatMap((rack) => {
              const rackPos: [number, number, number] = [rack.position[0], 0, rack.position[2]];
              return [
                <CoolantFlow key={`supply-${cdu.id}-${rack.id}`} from={cduPos} to={rackPos} type="supply" flowRate={flowRate} />,
                <CoolantFlow key={`return-${rack.id}-${cdu.id}`} from={rackPos} to={cduPos} type="return" flowRate={flowRate} />,
              ];
            });
          })}
      <OrbitControls
        makeDefault
        target={orbitTarget}
        /* minPolarAngle=0 易在天頂附近退化 → WebGL 畫面空白／白屏；保留小角度遠離奇異點 */
        minPolarAngle={0.12}
        maxPolarAngle={Math.PI / 2 - 0.1}
        minDistance={1.2}
        maxDistance={72}
        enableDamping
        dampingFactor={0.08}
      />
    </Canvas>
    </div>
  );
}

/** 3D 場景與 UI 面板分離，僅依 props 更新；搭配 dynamic(ssr:false) 減少首屏 bundle。 */
export const TwinsSceneCanvas = memo(TwinsSceneCanvasInner);
