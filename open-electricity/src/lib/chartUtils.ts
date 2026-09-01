import { format, parseISO, differenceInHours } from "date-fns";
import { FuelGenerationPoint } from "./types";

/**
 * Creates a modern Shadcn UI vertical linear gradient for ECharts area fills.
 */
export function createShadcnGradient(hexColor: string, topOpacity = 0.65, bottomOpacity = 0.08) {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;

  return {
    type: "linear",
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: `rgba(${r}, ${g}, ${b}, ${topOpacity})` },
      { offset: 1, color: `rgba(${r}, ${g}, ${b}, ${bottomOpacity})` },
    ],
  };
}

/**
 * Computes intelligent X-axis categories, tick step, and floating borderless axis styling
 * matching the Shadcn UI Area Charts specification with dark theme calibration.
 */
export function computeXAxisConfig(data: FuelGenerationPoint[], isDark: boolean = true) {
  if (!data || data.length === 0) {
    return {
      timestamps: [],
      axisLabel: { show: true },
      grid: { left: 55, right: 20, top: 14, bottom: 26, containLabel: true },
    };
  }

  const n = data.length;

  let spanHours = 24;
  let parsedDates: Date[] = [];
  try {
    parsedDates = data.map((d) => parseISO(d.timestamp));
    const firstDate = parsedDates[0];
    const lastDate = parsedDates[n - 1];
    spanHours = Math.max(1, Math.abs(differenceInHours(lastDate, firstDate)));
  } catch {
    spanHours = 24;
  }

  const is1Day = spanHours <= 36;
  const is3Day = spanHours > 36 && spanHours <= 96;
  const is7Day = spanHours > 96 && spanHours <= 240;

  const tickIndexSet = new Set<number>();

  if (is1Day && parsedDates.length === n) {
    for (let i = 0; i < n; i++) {
      const d = parsedDates[i];
      if (!isNaN(d.getTime())) {
        if (d.getMinutes() === 0 && d.getHours() % 3 === 0) {
          tickIndexSet.add(i);
        }
      }
    }
  } else if (is3Day && parsedDates.length === n) {
    for (let i = 0; i < n; i++) {
      const d = parsedDates[i];
      if (!isNaN(d.getTime())) {
        if (d.getMinutes() === 0 && (d.getHours() === 0 || d.getHours() === 12)) {
          tickIndexSet.add(i);
        }
      }
    }
  } else if (is7Day && parsedDates.length === n) {
    for (let i = 0; i < n; i++) {
      const d = parsedDates[i];
      if (!isNaN(d.getTime())) {
        if (d.getMinutes() === 0 && d.getHours() === 0) {
          tickIndexSet.add(i);
        }
      }
    }
  }

  if (tickIndexSet.size < 4) {
    const targetTicks = 7;
    const step = Math.max(1, Math.round(n / targetTicks));
    for (let i = 0; i < n; i += step) {
      tickIndexSet.add(i);
    }
    tickIndexSet.add(n - 1);
  }

  const timestamps = data.map((d, idx) => {
    try {
      const date = parsedDates[idx] || parseISO(d.timestamp);
      if (isNaN(date.getTime())) return d.timestamp;

      if (is1Day) {
        return format(date, "HH:mm");
      } else if (is3Day) {
        return format(date, "EEE HH:mm");
      } else if (is7Day) {
        return format(date, "EEE d MMM");
      } else if (spanHours <= 24 * 60) {
        return format(date, "d MMM");
      } else {
        return format(date, "MMM yyyy");
      }
    } catch {
      return d.timestamp;
    }
  });

  return {
    timestamps,
    axisLabel: {
      show: true,
      color: isDark ? "#A1A1AA" : "#64748B",
      fontSize: 10,
      margin: 8,
      interval: (index: number) => tickIndexSet.has(index),
    },
    grid: {
      left: 55,
      right: 20,
      top: 14,
      bottom: 26,
      containLabel: true,
    },
  };
}

/**
 * Axis Pointer configuration for ECharts (hiding floating popover while keeping synchronized cursor line).
 */
export function getShadcnTooltipConfig(isDark: boolean = true) {
  return {
    trigger: "axis",
    showContent: false, // Hides floating box popover completely
    axisPointer: {
      type: "line",
      lineStyle: {
        color: isDark ? "#71717A" : "#94A3B8",
        width: 1.5,
        type: "dashed",
      },
    },
  };
}

export const SHADCN_TOOLTIP_CONFIG = getShadcnTooltipConfig(true);
