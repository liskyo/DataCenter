"use client";
import React, { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { CDU } from "./sceneScale";

interface CDUTelemetry {
  inlet_temp?: number;
  outlet_temp?: number;
  flow_rate_lpm?: number;
  pressure_bar?: number;
  pump_a_rpm?: number;
  pump_b_rpm?: number;
  valve_position?: number;
  reservoir_level?: number;
  leak_detected?: boolean;
  facility_supply_temp?: number;
  facility_return_temp?: number;
  power_state?: 'on' | 'off';
}

interface CDUModelProps {
  name: string;
  isSelected?: boolean;
  telemetry?: CDUTelemetry;
}

/** Get CDU status based on telemetry data */
function getCDUStatus(t?: CDUTelemetry): "normal" | "warning" | "critical" | "leak" | "off" {
  if (t?.power_state === 'off') return "off";
  if (!t) return "normal";
  if (t.leak_detected === true) return "leak";
  if (
    (t.outlet_temp !== undefined && t.outlet_temp > 50) ||
    (t.flow_rate_lpm !== undefined && t.flow_rate_lpm < 4.0) ||
    (t.reservoir_level !== undefined && t.reservoir_level < 30)
  )
    return "critical";
  if (
    (t.outlet_temp !== undefined && t.outlet_temp > 42) ||
    (t.inlet_temp !== undefined && t.inlet_temp > 30) ||
    (t.pressure_bar !== undefined && t.pressure_bar > 2.8)
  )
    return "warning";
  return "normal";
}

const STATUS_COLORS = {
  normal: { body: "#1e3a5f", emissive: "#06b6d4", intensity: 0.3, speed: 1.2 },
  warning: { body: "#3d2e0a", emissive: "#f59e0b", intensity: 0.9, speed: 2.5 },
  critical: { body: "#3d0a0a", emissive: "#ef4444", intensity: 1.6, speed: 5.0 },
  leak: { body: "#3d0a0a", emissive: "#ef4444", intensity: 2.0, speed: 8.0 },
  off: { body: "#0a0a0a", emissive: "#000000", intensity: 0, speed: 0 },
};

function formatMetric(value: number | undefined, suffix: string): string {
  return value !== undefined ? `${value}${suffix}` : "---";
}

export default function CDUModel({ name, isSelected, telemetry }: CDUModelProps) {
  const status = getCDUStatus(telemetry);
  const colors = STATUS_COLORS[status];

  const [hovered, setHovered] = useState(false);
  const bodyOpacity = hovered ? 0.2 : 1.0;

  const bodyRef = useRef<THREE.Mesh>(null!);
  const pumpARef = useRef<THREE.Mesh>(null!);
  const pumpBRef = useRef<THREE.Mesh>(null!);
  const leakLightRef = useRef<THREE.Mesh>(null!);
  const panelAccent =
    status === "leak" || status === "critical" ? "#ef4444" : status === "warning" ? "#f59e0b" : "#06b6d4";
  const panelRows = [
    { label: "SUPPLY", value: formatMetric(telemetry?.inlet_temp, "C"), color: "#38bdf8" },
    {
      label: "RETURN",
      value: formatMetric(telemetry?.outlet_temp, "C"),
      color: telemetry?.outlet_temp !== undefined && telemetry.outlet_temp > 45 ? "#ef4444" : "#f97316",
    },
    {
      label: "FLOW",
      value: formatMetric(telemetry?.flow_rate_lpm, " LPM"),
      color: telemetry?.flow_rate_lpm !== undefined && telemetry.flow_rate_lpm < 5 ? "#ef4444" : "#22d3ee",
    },
    { label: "PRESS", value: formatMetric(telemetry?.pressure_bar, " bar"), color: "#a78bfa" },
    {
      label: "LEVEL",
      value: formatMetric(telemetry?.reservoir_level, "%"),
      color: telemetry?.reservoir_level !== undefined && telemetry.reservoir_level < 30 ? "#ef4444" : "#94a3b8",
    },
  ];
  const statusText =
    status === "off"
      ? "OFFLINE"
      : status === "leak"
        ? "LEAK"
        : status === "warning"
          ? "WARNING"
          : status === "critical"
            ? "CRITICAL"
            : "NORMAL";

  // Animate emissive breathing and pump rotation
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pulse = Math.abs(Math.sin(t * colors.speed));

    if (bodyRef.current) {
      const mat = bodyRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = colors.intensity * pulse;
    }

    // Pump rotation: RPM → radians/frame (at 60fps: rpm / 60 / 60 * 2π)
    const rpmA = telemetry?.pump_a_rpm ?? 3000;
    const rpmB = telemetry?.pump_b_rpm ?? 3000;
    if (pumpARef.current) pumpARef.current.rotation.y += (rpmA / 60 / 60) * Math.PI * 2 * 0.3;
    if (pumpBRef.current) pumpBRef.current.rotation.y += (rpmB / 60 / 60) * Math.PI * 2 * 0.3;

    // Leak alert flash
    if (leakLightRef.current) {
      const mat = leakLightRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = Math.abs(Math.sin(t * 8)) * 3;
    }
  });

  return (
    <group
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      {/* ── Main Cabinet Body ───────────────────────────── */}
      <mesh ref={bodyRef} position={[0, CDU.cy, 0]} castShadow receiveShadow>
        <boxGeometry args={[CDU.w, CDU.h, CDU.d]} />
        <meshStandardMaterial
          color={isSelected ? "#2dd4bf" : colors.body}
          emissive={colors.emissive}
          emissiveIntensity={colors.intensity}
          roughness={0.3}
          metalness={0.7}
          transparent={hovered}
          opacity={bodyOpacity}
        />
      </mesh>

      {/* 動態 CanvasTexture 在部分驅動上會於遙測更新後導致白屏；改成靜態幾何面板。 */}
      <group position={[0, CDU.cy, CDU.d / 2 + 0.012]}>
        <mesh renderOrder={2}>
          <planeGeometry args={[CDU.w * 0.88, CDU.h * 0.78]} />
          <meshBasicMaterial color="#020b1a" toneMapped={false} />
        </mesh>
        <mesh position={[0, CDU.h * 0.325, 0.001]} renderOrder={3}>
          <planeGeometry args={[CDU.w * 0.84, 0.055]} />
          <meshBasicMaterial color={panelAccent} transparent opacity={0.18} toneMapped={false} depthWrite={false} />
        </mesh>
        <mesh position={[0, -CDU.h * 0.33, 0.001]} renderOrder={3}>
          <planeGeometry args={[CDU.w * 0.84, 0.05]} />
          <meshBasicMaterial color={panelAccent} transparent opacity={0.12} toneMapped={false} depthWrite={false} />
        </mesh>
        <Text position={[0, CDU.h * 0.325, 0.002]} fontSize={0.038} color={panelAccent} anchorX="center" anchorY="middle">
          CDU MONITOR
        </Text>
        {panelRows.map((row, index) => {
          const y = CDU.h * 0.19 - index * 0.105;
          return (
            <group key={row.label} position={[0, y, 0.002]}>
              <Text position={[-CDU.w * 0.33, 0, 0]} fontSize={0.03} color="#64748b" anchorX="left" anchorY="middle">
                {row.label}
              </Text>
              <Text
                position={[CDU.w * 0.33, 0, 0]}
                fontSize={0.032}
                color={status === "off" ? "#334155" : row.color}
                anchorX="right"
                anchorY="middle"
              >
                {row.value}
              </Text>
            </group>
          );
        })}
        <Text position={[0, -CDU.h * 0.33, 0.002]} fontSize={0.034} color={status === "off" ? "#475569" : panelAccent} anchorX="center" anchorY="middle">
          {statusText}
        </Text>
      </group>

      {/* ── Corner frame accent lines ─────────────────── */}
      {[
        [-CDU.w / 2 + 0.03, CDU.cy + CDU.h / 2 - 0.02, 0],
        [CDU.w / 2 - 0.03, CDU.cy + CDU.h / 2 - 0.02, 0],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]}>
          <boxGeometry args={[0.03, 0.03, CDU.d]} />
          <meshBasicMaterial color={colors.emissive} />
        </mesh>
      ))}

      {/* ── Coolant Pipe Stubs (Return = Red, Supply = Blue) */}
      <mesh position={[0, CDU.cy + CDU.h / 2 - 0.08, -CDU.d * 0.22]}>
        <cylinderGeometry args={[0.04, 0.04, 0.18]} />
        <meshStandardMaterial color="#ef4444" emissive="#991b1b" emissiveIntensity={0.6} metalness={0.8} />
      </mesh>
      <mesh position={[0, CDU.cy + CDU.h / 2 - 0.08, CDU.d * 0.22]}>
        <cylinderGeometry args={[0.04, 0.04, 0.18]} />
        <meshStandardMaterial color="#3b82f6" emissive="#1d4ed8" emissiveIntensity={0.6} metalness={0.8} />
      </mesh>

      {/* ── Internal Components (visible when X-ray / hovered) ── */}
      {/* Pump A */}
      <mesh ref={pumpARef} position={[-0.11, CDU.h * 0.38, 0]} visible={hovered}>
        <cylinderGeometry args={[0.09, 0.09, 0.22, 16]} />
        <meshStandardMaterial color="#334155" emissive="#06b6d4" emissiveIntensity={0.5} metalness={0.9} />
      </mesh>
      {/* Pump A label */}
      {hovered && (
        <Text position={[-0.11, CDU.h * 0.62, CDU.d / 2 + 0.02]} fontSize={0.05} color="#34d399" anchorX="center">
          PUMP A {telemetry?.pump_a_rpm ?? "---"} RPM
        </Text>
      )}
      {/* Pump B */}
      <mesh ref={pumpBRef} position={[0.11, CDU.h * 0.38, 0]} visible={hovered}>
        <cylinderGeometry args={[0.09, 0.09, 0.22, 16]} />
        <meshStandardMaterial color="#334155" emissive="#06b6d4" emissiveIntensity={0.5} metalness={0.9} />
      </mesh>
      {hovered && (
        <Text position={[0.11, CDU.h * 0.62, CDU.d / 2 + 0.02]} fontSize={0.05} color="#34d399" anchorX="center">
          PUMP B {telemetry?.pump_b_rpm ?? "---"} RPM
        </Text>
      )}
      {/* Reservoir Tank */}
      <mesh position={[0, CDU.h * 0.22, 0]} visible={hovered}>
        <boxGeometry args={[0.22, 0.38, 0.48]} />
        <meshStandardMaterial color="#0ea5e9" transparent opacity={0.4} emissive="#0284c7" emissiveIntensity={0.5} />
      </mesh>

      {/* ── Status Label ───────────────────────────────── */}
      <Text position={[0, CDU.h + 0.1, 0]} fontSize={0.11} color={colors.emissive} anchorX="center" anchorY="middle">
        {name}
      </Text>
      {hovered && (
        <Text position={[0, CDU.h + 0.24, 0]} fontSize={0.06} color="#94a3b8" anchorX="center" anchorY="middle">
          ← HOVER: X-RAY MODE →
        </Text>
      )}

      {/* ── LEAK ALERT: Flashing Red Sphere + Warning Text */}
      {(status === "leak") && (
        <group position={[0, CDU.h + 0.42, 0]}>
          <mesh ref={leakLightRef}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={2.5} />
          </mesh>
          <Text position={[0, 0.2, 0]} fontSize={0.12} color="#ef4444" anchorX="center">
            ⚠ LEAK DETECTED ⚠
          </Text>
        </group>
      )}

      {/* ── Warning icon for non-normal status */}
      {(status === "warning" || status === "critical") && (
        <mesh position={[0, CDU.h + 0.36, 0]}>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial
            color={status === "critical" ? "#ef4444" : "#f59e0b"}
            emissive={status === "critical" ? "#ef4444" : "#f59e0b"}
            emissiveIntensity={1.5}
          />
        </mesh>
      )}
    </group>
  );
}
