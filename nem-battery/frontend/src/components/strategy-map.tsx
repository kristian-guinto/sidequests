"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  BATTERY_COLORS,
  BATTERY_DISPLAY_NAMES,
  BATTERY_MWH_CAPACITY,
  CLUSTER_COLORS,
  CLUSTER_NAMES,
  type ColorMode,
  type StrategyPoint,
} from "@/lib/strategy-types"
import { generateSimulatedData } from "@/lib/strategy-sim"

// Dynamically import the Three.js canvas — no SSR
const StrategyCanvas = dynamic(
  () => import("./strategy-canvas").then((m) => m.StrategyCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Loading 3D scene…
      </div>
    ),
  }
)

const COLOR_MODES: { mode: ColorMode; label: string }[] = [
  { mode: "cluster", label: "Strategy Cluster" },
  { mode: "battery", label: "Battery" },
  { mode: "revenue", label: "Revenue" },
]

function fmtAud(n: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n)
}

function clusterLabel(id: number, isSimulated: boolean): string {
  if (id < 0) return "Noise"
  if (isSimulated) return CLUSTER_NAMES[id] ?? `Cluster ${id}`
  return `Cluster ${id}`
}

function clusterColor(id: number): string {
  if (id < 0) return "#6b7280"
  return CLUSTER_COLORS[id % CLUSTER_COLORS.length]
}

export function StrategyMap() {
  const [points, setPoints] = useState<StrategyPoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSimulated, setIsSimulated] = useState(false)
  const [colorMode, setColorMode] = useState<ColorMode>("cluster")
  const [hoveredPoint, setHoveredPoint] = useState<StrategyPoint | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [loPct, setLoPct] = useState(2)
  const [hiPct, setHiPct] = useState(98)

  useEffect(() => {
    fetch("/api/strategy/points3d")
      .then((res) => res.json())
      .then((data: StrategyPoint[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setPoints(data)
          setIsSimulated(false)
        } else {
          setPoints(generateSimulatedData())
          setIsSimulated(true)
        }
      })
      .catch(() => {
        setPoints(generateSimulatedData())
        setIsSimulated(true)
      })
      .finally(() => setIsLoading(false))
  }, [])

  const handleHover = useCallback((p: StrategyPoint | null) => setHoveredPoint(p), [])

  const { minRev, maxRev, uniqueClusters, batteryCount, dayCount } = useMemo(() => {
    if (points.length === 0)
      return { minRev: 0, maxRev: 0, uniqueClusters: [] as number[], batteryCount: 0, dayCount: 0 }
    const sorted = [...points.map((pt) => {
      const cap = BATTERY_MWH_CAPACITY[pt.battery_key] ?? 1
      return pt.daily_revenue / cap
    })].sort((a, b) => a - b)
    const pct = (p: number) => {
      const idx = (p / 100) * (sorted.length - 1)
      const lo = Math.floor(idx), hi = Math.ceil(idx)
      return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
    }
    const uniqueClusters = [...new Set(points.map((p) => p.cluster_id))].sort((a, b) => {
      if (a < 0) return 1   // noise sorts last
      if (b < 0) return -1
      return a - b
    })
    const batteryCount = new Set(points.map((p) => p.battery_key)).size
    const dayCount = new Set(points.map((p) => p.date)).size
    return {
      minRev: pct(loPct),
      maxRev: pct(hiPct),
      uniqueClusters,
      batteryCount,
      dayCount,
    }
  }, [points, loPct, hiPct])

  return (
    <div
      className="flex flex-col h-screen bg-background"
      onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
    >
      {/* Header */}
      <header className="flex-shrink-0 border-b bg-card">
        <div className="px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Dashboard
            </Link>
            <Separator orientation="vertical" className="h-5" />
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Strategy Map</h1>
              <p className="text-xs text-muted-foreground">
                Battery trading strategies · 3D UMAP embedding ·{" "}
                {isLoading ? "Loading…" : isSimulated ? "Simulated data" : "Live data"}
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-68 flex-shrink-0 border-r bg-card overflow-y-auto">
          <div className="p-4 space-y-5">

            {/* Colour mode */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Colour By
              </p>
              <div className="flex flex-col gap-1.5">
                {COLOR_MODES.map(({ mode, label }) => (
                  <Button
                    key={mode}
                    variant={colorMode === mode ? "default" : "outline"}
                    size="sm"
                    className="justify-start"
                    onClick={() => setColorMode(mode)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Legend */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Legend
              </p>

              {colorMode === "cluster" && (
                <div className="space-y-1.5">
                  {uniqueClusters.map((id) => (
                    <div key={id} className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: clusterColor(id) }}
                      />
                      <span className="text-sm">{clusterLabel(id, isSimulated)}</span>
                    </div>
                  ))}
                </div>
              )}

              {colorMode === "battery" && (
                <div className="space-y-1.5">
                  {Object.entries(BATTERY_COLORS).map(([key, color]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ background: color }}
                      />
                      <span className="text-sm">{BATTERY_DISPLAY_NAMES[key]}</span>
                    </div>
                  ))}
                </div>
              )}

              {colorMode === "revenue" && (
                <div className="space-y-3">
                  <div>
                    <div
                      className="h-2.5 rounded-full w-full"
                      style={{
                        background: "linear-gradient(to right, #3b82f6, #10b981, #ef4444)",
                      }}
                    />
                    <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                      <span>{fmtAud(minRev)}/MWh</span>
                      <span>{fmtAud(maxRev)}/MWh</span>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Low clip</span>
                        <span className="font-mono">p{loPct}</span>
                      </div>
                      <input
                        type="range" min={0} max={49} value={loPct}
                        onChange={(e) => setLoPct(Number(e.target.value))}
                        className="w-full h-1 cursor-pointer accent-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>High clip</span>
                        <span className="font-mono">p{hiPct}</span>
                      </div>
                      <input
                        type="range" min={51} max={100} value={hiPct}
                        onChange={(e) => setHiPct(Number(e.target.value))}
                        className="w-full h-1 cursor-pointer accent-red-500"
                      />
                    </div>
                    {(loPct !== 2 || hiPct !== 98) && (
                      <button
                        onClick={() => { setLoPct(2); setHiPct(98) }}
                        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                      >
                        Reset to p2 – p98
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Hovered info */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Hovered Point
              </p>
              {hoveredPoint ? (
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground shrink-0">Battery</span>
                    <span className="font-medium text-right truncate">
                      {BATTERY_DISPLAY_NAMES[hoveredPoint.battery_key] ?? hoveredPoint.battery_key}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Date</span>
                    <span className="font-medium font-mono text-xs">{hoveredPoint.date}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Revenue</span>
                    <span className="font-medium text-right">
                      {fmtAud(hoveredPoint.daily_revenue)}
                      <span className="text-muted-foreground font-normal ml-1 text-xs">
                        ({fmtAud(hoveredPoint.daily_revenue / (BATTERY_MWH_CAPACITY[hoveredPoint.battery_key] ?? 1))}/MWh)
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Cluster</span>
                    <span className="font-medium text-right text-xs">
                      {clusterLabel(hoveredPoint.cluster_id, isSimulated)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground text-xs">xyz</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {hoveredPoint.x.toFixed(2)}, {hoveredPoint.y.toFixed(2)},{" "}
                      {hoveredPoint.z.toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Hover over a point</p>
              )}
            </div>

            <Separator />

            {/* Dataset stats */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Dataset
              </p>
              <div className="space-y-1 text-sm">
                {[
                  ["Points", points.length.toLocaleString()],
                  ["Batteries", batteryCount],
                  ["Clusters", uniqueClusters.filter((id) => id >= 0).length],
                  ["Days", dayCount],
                ].map(([label, val]) => (
                  <div key={String(label)} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{val}</span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <p className="text-xs text-muted-foreground leading-relaxed">
              Drag to rotate · Scroll to zoom · Right-drag to pan
            </p>
          </div>
        </aside>

        {/* Canvas area */}
        <div className="relative flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Loading embeddings…
            </div>
          ) : (
            <StrategyCanvas
              points={points}
              colorMode={colorMode}
              minRevenue={minRev}
              maxRevenue={maxRev}
              hoveredId={hoveredPoint?.id ?? null}
              onHover={handleHover}
            />
          )}

          {/* Floating tooltip */}
          {hoveredPoint && (
            <div
              className="pointer-events-none fixed z-50 bg-popover text-popover-foreground border border-border rounded-md px-3 py-2 shadow-lg text-sm"
              style={{ left: mousePos.x + 16, top: mousePos.y - 64 }}
            >
              <p className="font-medium">
                {BATTERY_DISPLAY_NAMES[hoveredPoint.battery_key] ?? hoveredPoint.battery_key}
              </p>
              <p className="text-muted-foreground text-xs">{hoveredPoint.date}</p>
              <p className="font-mono">{fmtAud(hoveredPoint.daily_revenue)}</p>
              <p className="text-muted-foreground text-xs font-mono">
                {fmtAud(hoveredPoint.daily_revenue / (BATTERY_MWH_CAPACITY[hoveredPoint.battery_key] ?? 1))}/MWh
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
