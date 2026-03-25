"use client"

import { memo, useMemo, useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import {
  BATTERY_COLORS,
  BATTERY_MWH_CAPACITY,
  CLUSTER_COLORS,
  type ColorMode,
  type StrategyPoint,
} from "@/lib/strategy-types"

// ── colour helpers ──────────────────────────────────────────────────────────

function revenueColor(revenue: number, min: number, max: number): string {
  const range = max - min
  const t = range > 0 ? Math.max(0, Math.min(1, (revenue - min) / range)) : 0.5
  const low = new THREE.Color("#3b82f6")
  const mid = new THREE.Color("#10b981")
  const high = new THREE.Color("#ef4444")
  const c = new THREE.Color()
  if (t < 0.5) {
    c.lerpColors(low, mid, t * 2)
  } else {
    c.lerpColors(mid, high, (t - 0.5) * 2)
  }
  return `#${c.getHexString()}`
}

function getColor(point: StrategyPoint, mode: ColorMode, min: number, max: number): string {
  if (mode === "battery") return BATTERY_COLORS[point.battery_key] ?? "#888888"
  if (mode === "cluster") {
    if (point.cluster_id < 0) return "#6b7280"   // DBSCAN noise → gray
    return CLUSTER_COLORS[point.cluster_id % CLUSTER_COLORS.length]
  }
  const cap = BATTERY_MWH_CAPACITY[point.battery_key] ?? 1
  return revenueColor(point.daily_revenue / cap, min, max)
}

// ── single point mesh ───────────────────────────────────────────────────────

interface PointMeshProps {
  point: StrategyPoint
  color: string
  hovered: boolean
  onHover: (p: StrategyPoint | null) => void
}

function PointMesh({ point, color, hovered, onHover }: PointMeshProps) {
  const ref = useRef<THREE.Mesh>(null)

  // Smoothly animate scale towards target
  useFrame(() => {
    if (!ref.current) return
    const target = hovered ? 1.9 : 1.0
    const s = ref.current.scale.x
    ref.current.scale.setScalar(s + (target - s) * 0.12)
  })

  return (
    <mesh
      ref={ref}
      position={[point.x, point.y, point.z]}
      onPointerOver={(e) => { e.stopPropagation(); onHover(point) }}
      onPointerOut={() => onHover(null)}
    >
      <sphereGeometry args={[0.07, 10, 10]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={hovered ? 0.7 : 0.15}
        roughness={0.3}
        metalness={0.2}
      />
    </mesh>
  )
}

// ── axis lines ──────────────────────────────────────────────────────────────

const AXIS_DEFS = [
  { points: [-4, 0, 0, 4, 0, 0], color: "#ef4444" }, // X — red
  { points: [0, -4, 0, 0, 4, 0], color: "#22c55e" }, // Y — green
  { points: [0, 0, -4, 0, 0, 4], color: "#60a5fa" }, // Z — blue
]

function Axes() {
  const lines = useMemo(
    () =>
      AXIS_DEFS.map(({ points, color }) => {
        const geo = new THREE.BufferGeometry()
        geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3))
        return new THREE.Line(geo, new THREE.LineBasicMaterial({ color, opacity: 0.4, transparent: true }))
      }),
    []
  )

  return (
    <>
      {lines.map((line, i) => (
        <primitive key={i} object={line} />
      ))}
    </>
  )
}

// ── scene ───────────────────────────────────────────────────────────────────

interface SceneProps {
  points: StrategyPoint[]
  colorMode: ColorMode
  minRevenue: number
  maxRevenue: number
  hoveredId: string | null
  onHover: (p: StrategyPoint | null) => void
}

function Scene({ points, colorMode, minRevenue, maxRevenue, hoveredId, onHover }: SceneProps) {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[8, 10, 6]} intensity={1.2} />
      <pointLight position={[-6, -6, -4]} intensity={0.4} color="#6366f1" />
      <OrbitControls enableDamping dampingFactor={0.07} minDistance={3} maxDistance={28} />
      <Axes />
      {points.map((p) => (
        <PointMesh
          key={p.id}
          point={p}
          color={getColor(p, colorMode, minRevenue, maxRevenue)}
          hovered={p.id === hoveredId}
          onHover={onHover}
        />
      ))}
    </>
  )
}

// ── exported canvas ─────────────────────────────────────────────────────────

export interface StrategyCanvasProps {
  points: StrategyPoint[]
  colorMode: ColorMode
  minRevenue: number
  maxRevenue: number
  hoveredId: string | null
  onHover: (p: StrategyPoint | null) => void
}

function StrategyCanvasInner({ points, colorMode, minRevenue, maxRevenue, hoveredId, onHover }: StrategyCanvasProps) {
  return (
    <Canvas
      camera={{ position: [7, 5, 9], fov: 55, near: 0.1, far: 100 }}
      dpr={[1, 2]}
      style={{ background: "#0a0a0a" }}
    >
      <Scene
        points={points}
        colorMode={colorMode}
        minRevenue={minRevenue}
        maxRevenue={maxRevenue}
        hoveredId={hoveredId}
        onHover={onHover}
      />
    </Canvas>
  )
}

export const StrategyCanvas = memo(StrategyCanvasInner)
