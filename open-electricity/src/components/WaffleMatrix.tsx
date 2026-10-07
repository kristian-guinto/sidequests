"use client";

import React, { useMemo } from "react";
import { FuelTech, PaletteMode, FuelBreakdownRow } from "@/lib/types";
import { getFuelMeta } from "@/lib/colors";
import { useTheme } from "@/components/ThemeProvider";

interface WaffleMatrixProps {
  breakdown: FuelBreakdownRow[];
  paletteMode: PaletteMode;
  hoveredFuel: FuelTech | null;
  onHoverFuel: (fuel: FuelTech | null) => void;
  className?: string;
}

// Canonical stacking order: Fossil base to Clean canopy
const CANONICAL_FUEL_ORDER: FuelTech[] = [
  "coal",
  "oil",
  "gas",
  "biomass",
  "geothermal",
  "battery",
  "hydro",
  "wind",
  "solar",
];

export function WaffleMatrix({
  breakdown,
  paletteMode,
  hoveredFuel,
  onHoverFuel,
  className = "",
}: WaffleMatrixProps) {
  const { isDark } = useTheme();

  // Compute exact 100 tiles using Hamilton's largest-remainder method
  const tiles = useMemo(() => {
    // Map breakdown to lookup
    const pctMap = new Map<FuelTech, number>();
    for (const row of breakdown) {
      if (row.percentage > 0) {
        pctMap.set(row.fuelTech, row.percentage);
      }
    }

    const totalPct = Array.from(pctMap.values()).reduce((a, b) => a + b, 0);
    if (totalPct <= 0) {
      const emptyColor = isDark ? "#18181B" : "#F4F4F5";
      return Array.from({ length: 100 }, () => ({
        fuel: "other" as FuelTech,
        color: emptyColor,
        label: "No Data",
      }));
    }

    // Active fuels in canonical order
    const activeFuels = CANONICAL_FUEL_ORDER.filter((f) => (pctMap.get(f) || 0) > 0);

    // Initial floor distribution
    let allocatedCount = 0;
    const items = activeFuels.map((fuel) => {
      const raw = ((pctMap.get(fuel) || 0) / totalPct) * 100;
      const floor = Math.floor(raw);
      const remainder = raw - floor;
      allocatedCount += floor;
      return { fuel, floor, remainder };
    });

    // Distribute remaining tiles to highest remainders
    let remaining = 100 - allocatedCount;
    const sortedByRemainder = [...items].sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; i < remaining; i++) {
      sortedByRemainder[i % sortedByRemainder.length].floor += 1;
    }

    // Generate ordered tiles array (fossil to clean)
    const resultTiles: { fuel: FuelTech; color: string; label: string }[] = [];
    for (const item of items) {
      const meta = getFuelMeta(item.fuel, isDark, paletteMode);
      for (let i = 0; i < item.floor; i++) {
        resultTiles.push({
          fuel: item.fuel,
          color: meta.color,
          label: meta.label,
        });
      }
    }

    // Pad or trim strictly to 100
    while (resultTiles.length < 100 && activeFuels.length > 0) {
      const lastFuel = activeFuels[activeFuels.length - 1];
      const meta = getFuelMeta(lastFuel, isDark, paletteMode);
      resultTiles.push({ fuel: lastFuel, color: meta.color, label: meta.label });
    }
    return resultTiles.slice(0, 100);
  }, [breakdown, isDark, paletteMode]);

  return (
    <div className={`select-none ${className}`}>
      {/* 10x10 Waffle Grid — flush on card, no inner container */}
      <div
        className="grid grid-cols-10 gap-[3px] sm:gap-[5px]"
        onMouseLeave={() => onHoverFuel(null)}
      >
        {tiles.map((tile, idx) => {
          const isHighlighted = hoveredFuel === null || hoveredFuel === tile.fuel;
          const isDirectlyHovered = hoveredFuel === tile.fuel;

          return (
            <div
              key={idx}
              onMouseEnter={() => onHoverFuel(tile.fuel)}
              style={{
                backgroundColor: tile.color,
              }}
              className={`aspect-square rounded-[3px] transition-all duration-150 cursor-pointer ${isDirectlyHovered
                ? "ring-1.5 ring-white/80 dark:ring-white/70 shadow-lg z-10 scale-105"
                : isHighlighted
                  ? "opacity-90"
                  : "opacity-20"
                }`}
              title={tile.label}
            />
          );
        })}
      </div>
    </div>
  );
}
