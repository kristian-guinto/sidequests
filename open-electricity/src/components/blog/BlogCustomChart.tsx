"use client";

import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { useTheme } from "@/components/ThemeProvider";

interface BlogCustomChartProps {
  title?: string;
  subtitle?: string;
  caption?: string;
  option: Record<string, any>;
  height?: string;
}

export function BlogCustomChart({
  title,
  subtitle,
  caption,
  option,
  height = "320px",
}: BlogCustomChartProps) {
  const { isDark } = useTheme();

  // Merge theme defaults with user option
  const themedOption = useMemo(() => {
    const textColor = isDark ? "#A1A1AA" : "#71717A";
    const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)";

    const base = {
      backgroundColor: "transparent",
      textStyle: {
        fontFamily: "inherit",
        color: textColor,
      },
      tooltip: {
        backgroundColor: isDark ? "#18181B" : "#FFFFFF",
        borderColor: isDark ? "#27272A" : "#E4E4E7",
        textStyle: {
          color: isDark ? "#FAFAFA" : "#09090B",
          fontSize: 12,
        },
        extraCssText: "box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); border-radius: 8px;",
      },
      grid: {
        containLabel: true,
        left: 55,
        right: 25,
        top: 30,
        bottom: 30,
      },
    };

    return {
      ...base,
      ...option,
      textStyle: {
        ...base.textStyle,
        ...(option.textStyle || {}),
      },
      grid: {
        ...base.grid,
        ...(option.grid || {}),
      },
      tooltip: {
        ...base.tooltip,
        ...(option.tooltip || {}),
      },
    };
  }, [option, isDark]);

  return (
    <figure className="my-8 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0d0d10] shadow-sm overflow-hidden not-prose">
      {(title || subtitle) && (
        <div className="px-4 py-3 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-[#121215]/50">
          {title && (
            <h4 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
              {title}
            </h4>
          )}
          {subtitle && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      )}

      <div className="p-3 sm:p-4">
        <ReactECharts
          option={themedOption}
          style={{ height, width: "100%" }}
          notMerge={true}
          lazyUpdate={true}
        />
      </div>

      {caption && (
        <figcaption className="px-4 py-2 text-xs text-neutral-500 dark:text-neutral-400 border-t border-neutral-100 dark:border-neutral-800/80 italic bg-neutral-50/30 dark:bg-[#121215]/30">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

