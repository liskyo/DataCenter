"use client";

import React, { memo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { EquipmentData, RackData } from "@/store/useDcimStore";
import RoomContext from "@/components/3d/RoomContext";
import RackModel from "@/components/3d/RackModel";
import EquipmentModel from "@/components/3d/EquipmentModel";
import NetworkLines from "@/components/3d/NetworkLines";
import CoolantFlow from "@/components/3d/CoolantFlow";

export type TwinsSceneCanvasProps = {
  locationRacks: RackData[];
  locationEquipments: EquipmentData[];
  selectedRackId: string | null;
  telemetry: Record<string, any>;
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
  return (
    <Canvas
      camera={{ position: [5, 4, 8], fov: 45 }}
      className="w-full h-full outline-none"
      onPointerMissed={onPointerMissed}
    >
      <RoomContext />
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
      <OrbitControls makeDefault minPolarAngle={0} maxPolarAngle={Math.PI / 2 - 0.05} />
    </Canvas>
  );
}

/** 3D 場景與 UI 面板分離，僅依 props 更新；搭配 dynamic(ssr:false) 減少首屏 bundle。 */
export const TwinsSceneCanvas = memo(TwinsSceneCanvasInner);
