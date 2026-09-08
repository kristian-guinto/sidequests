import { format, parseISO, differenceInHours } from "date-fns";
import { FuelGenerationPoint, TimeRange, TimeInterval } from "./types";

const DEFAULT_RANGE_INTERVALS: Record<TimeRange, TimeInterval> = {
  "1d": "5m",
  "3d": "30m",
  "7d": "30m",
  "30d": "1d",
  "1y": "1w",
};

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
 * Parses an ISO timestamp string representing the country's local market time
 * into a Date object without applying browser timezone shifting.
 */
export function parseMarketDate(timestamp: string): Date {
  if (!timestamp) return new Date();
  const s = timestamp.includes("T")
    ? timestamp.substring(0, 19)
    : timestamp.substring(0, 10);
  return parseISO(s);
}

/**
 * Formats a market timestamp in local market wall-clock time.
 */
export function formatMarketDate(
  timestamp: string,
  formatStr: string = "d MMM yyyy, h:mm a"
): string {
  try {
    const d = parseMarketDate(timestamp);
    if (isNaN(d.getTime())) return timestamp;
    return format(d, formatStr);
  } catch {
    return timestamp;
  }
}

/**
 * Calculates start_date and end_date (YYYY-MM-DD) for a given range,
 * anchoring end_date to yesterday (up to 00:00:00 of the current day)
 * so that only fully completed operational day data is queried across all countries.
 */
export function getDateRangeParams(range: TimeRange = "7d"): {
  startDate: string;
  endDate: string;
} {
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const endDate = format(yesterday, "yyyy-MM-dd");

  let days = 1;
  if (range === "3d") days = 3;
  else if (range === "7d") days = 7;
  else if (range === "30d") days = 30;
  else if (range === "1y") days = 365;

  const startDateObj = new Date(
    yesterday.getFullYear(),
    yesterday.getMonth(),
    yesterday.getDate() - (days - 1)
  );
  const startDate = format(startDateObj, "yyyy-MM-dd");

  return { startDate, endDate };
}

/**
 * Ensures that the returned dataset maintains consistent time spacing.
 * Preserves all incoming valid telemetry points, and inserts blank placeholders
 * (hasData: false) only across genuine data gaps so that missing periods render
 * faithfully without distorting the time axis.
 */
export function alignPointsToTimeGrid(
  points: FuelGenerationPoint[],
  range: TimeRange,
  interval?: TimeInterval
): FuelGenerationPoint[] {
  if (!points || points.length === 0) return [];

  const activeInterval =
    interval || (range ? DEFAULT_RANGE_INTERVALS[range] : "30m") || "30m";
  let stepMs = 30 * 60 * 1000;
  if (activeInterval === "5m") stepMs = 5 * 60 * 1000;
  else if (activeInterval === "30m") stepMs = 30 * 60 * 1000;
  else if (activeInterval === "1h") stepMs = 60 * 60 * 1000;
  else if (activeInterval === "1d") stepMs = 24 * 60 * 60 * 1000;
  else if (activeInterval === "1w") stepMs = 7 * 24 * 60 * 60 * 1000;
  else if (activeInterval === "1M" || activeInterval === "1m")
    stepMs = 30 * 24 * 60 * 60 * 1000;
  else if (points.length >= 2) {
    try {
      const t0 = parseMarketDate(points[0].timestamp).getTime();
      const t1 = parseMarketDate(points[1].timestamp).getTime();
      const diff = Math.abs(t1 - t0);
      if (diff > 0 && !isNaN(diff)) {
        stepMs = diff;
      }
    } catch { }
  }

  const result: FuelGenerationPoint[] = [];

  for (let i = 0; i < points.length; i++) {
    const pt = {
      ...points[i],
      hasData: points[i].hasData !== undefined ? points[i].hasData : true,
    };
    if (i > 0) {
      const prevTime = parseMarketDate(points[i - 1].timestamp).getTime();
      const currTime = parseMarketDate(points[i].timestamp).getTime();
      const diff = currTime - prevTime;

      // If there is an internal gap significantly larger than expected step
      if (diff > stepMs * 1.8 && !isNaN(prevTime) && !isNaN(currTime)) {
        let gapTime = prevTime + stepMs;
        while (gapTime < currTime - stepMs * 0.5) {
          const d = new Date(gapTime);
          const pad = (n: number) => String(n).padStart(2, "0");
          const tzOffset = points[0].timestamp.includes("+")
            ? points[0].timestamp.substring(points[0].timestamp.indexOf("+"))
            : "+08:00";
          result.push({
            timestamp: points[0].timestamp.includes("T")
              ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${tzOffset}`
              : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
            solar: 0,
            wind: 0,
            hydro: 0,
            geothermal: 0,
            biomass: 0,
            gas: 0,
            coal: 0,
            oil: 0,
            battery: 0,
            price: undefined,
            priceDollar: undefined,
            totalGeneration: 0,
            renewablesPct: 0,
            hasData: false,
          });
          gapTime += stepMs;
        }
      }
    }
    result.push(pt);
  }

  return result;
}

/**
 * Computes intelligent X-axis categories, tick step, and floating borderless axis styling
 * matching the Shadcn UI Area Charts specification with dark theme calibration.
 */
export function computeXAxisConfig(
  data: FuelGenerationPoint[],
  isDark: boolean = true,
  range?: TimeRange,
  interval?: TimeInterval
) {
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
    parsedDates = data.map((d) => parseMarketDate(d.timestamp));
    const firstDate = parsedDates[0];
    const lastDate = parsedDates[n - 1];
    spanHours = Math.max(1, Math.abs(differenceInHours(lastDate, firstDate)));
  } catch {
    spanHours = 24;
  }

  const is1Day = range === "1d" || spanHours <= 36;
  const is3Day = range === "3d" || (spanHours > 36 && spanHours <= 96);
  const is7Day = range === "7d" || (spanHours > 96 && spanHours <= 240);
  const is30Day = range === "30d" || (spanHours > 240 && spanHours <= 40 * 24);
  const is1Year = range === "1y" || spanHours > 40 * 24;

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
  } else if (is30Day && parsedDates.length === n) {
    for (let i = 0; i < n; i += 2) {
      tickIndexSet.add(i);
    }
  } else if (is1Year && parsedDates.length === n) {
    const step = n >= 40 ? 4 : 1;
    for (let i = 0; i < n; i += step) {
      tickIndexSet.add(i);
    }
    tickIndexSet.add(n - 1);
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
      const date = parsedDates[idx] || parseMarketDate(d.timestamp);
      if (isNaN(date.getTime())) return d.timestamp;

      if (is1Day) {
        return format(date, "HH:mm");
      } else if (is3Day) {
        return format(date, "EEE HH:mm");
      } else if (is7Day || is30Day) {
        return format(date, "EEE d MMM");
      } else if (is1Year) {
        return format(date, "MMM yyyy");
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
