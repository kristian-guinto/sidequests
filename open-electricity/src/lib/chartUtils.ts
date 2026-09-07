import { format, parseISO, differenceInHours } from "date-fns";
import { FuelGenerationPoint, TimeRange, TimeInterval, RANGE_CONFIG } from "./types";

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
 * Ensures that the returned dataset spans the full expected time range ending at yesterday.
 * Any points that fall on or after today (current day) are excluded for data completeness.
 * Time buckets within the full range that have no data are padded with empty points (hasData: false)
 * so that the x-axis displays the complete time range and missing periods render as blank.
 */
export function alignPointsToTimeGrid(
  points: FuelGenerationPoint[],
  range: TimeRange,
  interval?: TimeInterval
): FuelGenerationPoint[] {
  const activeInterval = interval || RANGE_CONFIG[range]?.defaultInterval || "30m";
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  // Filter out any incoming points on or after today (incomplete current day)
  const validPoints = (points || []).filter((p) => {
    try {
      const d = parseISO(p.timestamp);
      return d.getTime() < todayStart.getTime();
    } catch {
      return true;
    }
  });

  // Reference end date is yesterday
  let refDate = yesterday;
  if (validPoints.length > 0) {
    const maxPtTime = Math.max(
      ...validPoints
        .map((p) => {
          try {
            return parseISO(p.timestamp).getTime();
          } catch {
            return NaN;
          }
        })
        .filter((t) => !isNaN(t))
    );
    if (isFinite(maxPtTime)) {
      const maxPtDate = new Date(maxPtTime);
      const daysDiff = (yesterday.getTime() - maxPtDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 2) {
        refDate = new Date(maxPtDate.getFullYear(), maxPtDate.getMonth(), maxPtDate.getDate(), 0, 0, 0, 0);
      }
    }
  }

  interface SlotInfo {
    timestamp: string;
    date: Date;
    matchKey: string;
  }

  const slots: SlotInfo[] = [];

  if (range === "30d") {
    if (activeInterval === "1w") {
      for (let i = 0; i < 4; i++) {
        const d = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - (3 - i) * 7, 0, 0, 0, 0);
        const ts = format(d, "yyyy-MM-dd");
        slots.push({ timestamp: ts, date: d, matchKey: ts });
      }
    } else {
      for (let i = 0; i < 30; i++) {
        const d = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - (29 - i), 0, 0, 0, 0);
        const ts = format(d, "yyyy-MM-dd");
        slots.push({ timestamp: ts, date: d, matchKey: ts });
      }
    }
  } else if (range === "1y") {
    if (activeInterval === "1M") {
      for (let i = 0; i < 12; i++) {
        const d = new Date(refDate.getFullYear(), refDate.getMonth() - (11 - i), 1, 0, 0, 0, 0);
        const ts = format(d, "yyyy-MM-dd");
        slots.push({ timestamp: ts, date: d, matchKey: format(d, "yyyy-MM") });
      }
    } else {
      for (let i = 0; i < 52; i++) {
        const d = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - (51 - i) * 7, 0, 0, 0, 0);
        const ts = format(d, "yyyy-MM-dd");
        slots.push({ timestamp: ts, date: d, matchKey: ts });
      }
    }
  } else if (range === "7d") {
    if (activeInterval === "1d") {
      for (let i = 0; i < 7; i++) {
        const d = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - (6 - i), 0, 0, 0, 0);
        const ts = format(d, "yyyy-MM-dd");
        slots.push({ timestamp: ts, date: d, matchKey: ts });
      }
    } else {
      const stepMins = activeInterval === "1h" ? 60 : 30;
      const count = 7 * (1440 / stepMins);
      const start = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - 6, 0, 0, 0, 0);
      for (let i = 0; i < count; i++) {
        const d = new Date(start.getTime() + i * stepMins * 60 * 1000);
        const ts = format(d, "yyyy-MM-dd'T'HH:mm:ssXXX");
        const matchKey = format(d, "yyyy-MM-dd'T'HH:mm");
        slots.push({ timestamp: ts, date: d, matchKey });
      }
    }
  } else if (range === "3d") {
    const stepMins = activeInterval === "1h" ? 60 : 30;
    const count = 3 * (1440 / stepMins);
    const start = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - 2, 0, 0, 0, 0);
    for (let i = 0; i < count; i++) {
      const d = new Date(start.getTime() + i * stepMins * 60 * 1000);
      const ts = format(d, "yyyy-MM-dd'T'HH:mm:ssXXX");
      const matchKey = format(d, "yyyy-MM-dd'T'HH:mm");
      slots.push({ timestamp: ts, date: d, matchKey });
    }
  } else if (range === "1d") {
    const stepMins = activeInterval === "30m" ? 30 : 5;
    const count = 1440 / stepMins;
    const start = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 0, 0, 0, 0);
    for (let i = 0; i < count; i++) {
      const d = new Date(start.getTime() + i * stepMins * 60 * 1000);
      const ts = format(d, "yyyy-MM-dd'T'HH:mm:ssXXX");
      const matchKey = format(d, "yyyy-MM-dd'T'HH:mm");
      slots.push({ timestamp: ts, date: d, matchKey });
    }
  }

  // Create lookup maps
  const dayMap = new Map<string, FuelGenerationPoint>();
  const monthMap = new Map<string, FuelGenerationPoint>();
  const subDailyMap = new Map<string, FuelGenerationPoint>();

  validPoints.forEach((p) => {
    try {
      const d = parseISO(p.timestamp);
      if (!isNaN(d.getTime())) {
        dayMap.set(format(d, "yyyy-MM-dd"), p);
        monthMap.set(format(d, "yyyy-MM"), p);
        subDailyMap.set(format(d, "yyyy-MM-dd'T'HH:mm"), p);
      }
    } catch {
      dayMap.set(p.timestamp.substring(0, 10), p);
    }
  });

  const isMonthly = range === "1y" && activeInterval === "1M";
  const isDailyOrWeekly = activeInterval === "1d" || activeInterval === "1w";

  return slots.map((slot) => {
    let matched: FuelGenerationPoint | undefined;
    if (isMonthly) {
      matched = monthMap.get(slot.matchKey);
    } else if (isDailyOrWeekly) {
      matched = dayMap.get(slot.matchKey);
      if (!matched && activeInterval === "1w") {
        const slotMs = slot.date.getTime();
        for (const vp of validPoints) {
          try {
            const vpMs = parseISO(vp.timestamp).getTime();
            if (vpMs >= slotMs && vpMs < slotMs + 7 * 24 * 3600 * 1000) {
              matched = vp;
              break;
            }
          } catch { }
        }
      }
    } else {
      matched = subDailyMap.get(slot.matchKey);
      if (!matched) {
        const slotMs = slot.date.getTime();
        for (const vp of validPoints) {
          try {
            const vpMs = parseISO(vp.timestamp).getTime();
            if (Math.abs(vpMs - slotMs) <= 15 * 60 * 1000) {
              matched = vp;
              break;
            }
          } catch { }
        }
      }
    }

    if (matched) {
      return {
        ...matched,
        timestamp: slot.timestamp,
        hasData: true,
      };
    }

    return {
      timestamp: slot.timestamp,
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
    };
  });
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
    parsedDates = data.map((d) => parseISO(d.timestamp));
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
      const date = parsedDates[idx] || parseISO(d.timestamp);
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
