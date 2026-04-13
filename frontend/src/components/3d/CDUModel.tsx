"use client";
import React, { useRef, useState, useMemo } from "react";
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

/** Build a CanvasTexture with live CDU metrics */
function useCDUCanvasTexture(t?: CDUTelemetry, status?: string): THREE.CanvasTexture {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 384;
    const ctx = canvas.getContext("2d")!;

    // Background
    ctx.fillStyle = "#020b1a";
    ctx.fillRect(0, 0, 256, 384);

    // Border
    const borderColor = status === "leak" || status === "critical" ? "#ef4444" : status === "warning" ? "#f59e0b" : "#06b6d4";
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 248, 376);

    // Title
    ctx.fillStyle = borderColor;
    ctx.font = "bold 18px monospace";
    ctx.textAlign = "center";
    ctx.fillText("◈ CDU MONITOR ◈", 128, 32);

    ctx.fillStyle = "#334155";
    ctx.fillRect(10, 40, 236, 2);

    // Metric rows
    const rows = [
      { label: "Supply Temp", value: t?.inlet_temp !== undefined ? `${t.inlet_temp}°C` : "---", color: "#38bdf8" },
      { label: "Return Temp", value: t?.outlet_temp !== undefined ? `${t.outlet_temp}°C` : "---", color: t?.outlet_temp && t.outlet_temp > 45 ? "#ef4444" : "#f97316" },
      { label: "Flow Rate", value: t?.flow_rate_lpm !== undefined ? `${t.flow_rate_lpm} LPM` : "---", color: t?.flow_rate_lpm && t.flow_rate_lpm < 5 ? "#ef4444" : "#22d3ee" },
      { label: "Pressure", value: t?.pressure_bar !== undefined ? `${t.pressure_bar} bar` : "---", color: "#a78bfa" },
      { label: "Pump A", value: t?.pump_a_rpm !== undefined ? `${t.pump_a_rpm} RPM` : "---", color: "#34d399" },
      { label: "Pump B", value: t?.pump_b_rpm !== undefined ? `${t.pump_b_rpm} RPM` : "---", color: "#34d399" },
      { label: "Reservoir", value: t?.reservoir_level !== undefined ? `${t.reservoir_level}%` : "---", color: t?.reservoir_level && t.reservoir_level < 30 ? "#ef4444" : "#94a3b8" },
      { label: "CHW Supply", value: t?.facility_supply_temp !== undefined ? `${t.facility_supply_temp}°C` : "---", color: "#67e8f9" },
      { label: "CHW Return", value: t?.facility_return_temp !== undefined ? `${t.facility_return_temp}°C` : "---", color: "#67e8f9" },
    ];

    rows.forEach((row, i) => {
      const y = 70 + i * 32;
      ctx.fillStyle = "#64748b";
      ctx.font = "12px monospace";
      ctx.textAlign = "left";
      ctx.fillText(row.label, 18, y);
      ctx.fillStyle = status === "off" ? "#334155" : row.color;
      ctx.font = "bold 13px monospace";
      ctx.textAlign = "right";
      ctx.fillText(row.value, 238, y);
    });

    if (status === "off") {
      ctx.fillStyle = "rgba(10, 10, 10, 0.7)";
      ctx.fillRect(10, 60, 236, 270);
      ctx.fillStyle = "#475569";
      ctx.font = "bold 20px monospace";
      ctx.textAlign = "center";
      ctx.fillText("POWERED OFF", 128, 180);
      
      ctx.fillStyle = "#334155";
      ctx.font = "bold 13px monospace";

      ctx.textAlign = "center";
      ctx.fillText("● OFFLINE", 128, 370);
    } else if (t?.leak_detected) {
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.fillText("⚠ LEAK DETECTED ⚠", 128, 370);
    } else {
      const statusText = status === "normal" ? "● SYSTEM NORMAL" : status === "warning" ? "▲ WARNING" : "✕ CRITICAL";
      ctx.fillStyle = borderColor;
      ctx.font = "bold 13px monospace";
      ctx.textAlign = "center";
      ctx.fillText(statusText, 128, 370);
    }

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    t?.inlet_temp, t?.outlet_temp, t?.flow_rate_lpm, t?.pressure_bar,
    t?.pump_a_rpm, t?.pump_b_rpm, t?.reservoir_level,
    t?.facility_supply_temp, t?.facility_return_temp, t?.leak_detected, status,
  ]);
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

  const canvasTexture = useCDUCanvasTexture(telemetry, status);

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

      {/* ── Front Panel Canvas Screen ─────────────────── */}
      <mesh position={[0, CDU.cy, CDU.d / 2 + 0.012]}>
        <planeGeometry args={[CDU.w * 0.88, CDU.h * 0.78]} />
        <meshBasicMaterial map={canvasTexture} />
      </mesh>

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
