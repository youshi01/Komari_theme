import { useEffect, useState } from "react";
import type uPlot from "uplot";

export interface TimeRangeOption {
  label: string;
  value: number;
}

export const LOAD_TIME_RANGE_OPTIONS: TimeRangeOption[] = [
  { label: "1 小时", value: 1 },
  { label: "4 小时", value: 4 },
  { label: "1 天", value: 24 },
  { label: "7 天", value: 168 },
  { label: "30 天", value: 720 },
  { label: formatRangeLabel(7200), value: 7200 },
];

function formatRangeLabel(hours: number) {
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `${days} 天`;
  }

  return `${hours} 小时`;
}

function buildHistoryRangeOptions(
  presets: TimeRangeOption[],
  maxHours: number | null | undefined,
  includeRealtime: boolean,
) {
  const options = includeRealtime ? [{ label: "实时", value: 0 }] : [];
  if (!Number.isFinite(maxHours) || !maxHours || maxHours <= 0) {
    return [...options, ...presets];
  }

  const safeMaxHours = Math.floor(maxHours);
  const resolved = presets.filter((option) => option.value <= safeMaxHours);
  const hasExactMatch = resolved.some((option) => option.value === safeMaxHours);

  if (safeMaxHours > 0 && !hasExactMatch) {
    resolved.push({
      label: formatRangeLabel(safeMaxHours),
      value: safeMaxHours,
    });
  }

  return [...options, ...resolved];
}

export function buildLoadTimeRangeOptions(maxHours: number | null | undefined) {
  return buildHistoryRangeOptions(LOAD_TIME_RANGE_OPTIONS, maxHours, true);
}

export function buildPingTimeRangeOptions(maxHours: number | null | undefined) {
  return buildHistoryRangeOptions(LOAD_TIME_RANGE_OPTIONS, maxHours, false);
}

const GRID_CHART_DEFAULT = { w: 420, h: 150 };
const GRID_CHART_DESKTOP_MAX_WIDTH = 480;
const GRID_CHART_TABLET_MAX_WIDTH = 560;
const GRID_CHART_DESKTOP_GUTTER = 180;
const GRID_CHART_TABLET_GUTTER = 100;
const GRID_CHART_MOBILE_GUTTER = 56;
const GRID_CHART_HEIGHT = 148;
const WIDE_CHART_MIN_WIDTH = 300;
const WIDE_CHART_MAX_WIDTH = 1280;
const WIDE_CHART_GUTTER = 96;
const WIDE_CHART_HEIGHT = 340;
const WIDE_CHART_TABLET_HEIGHT = 300;
const WIDE_CHART_MOBILE_HEIGHT = 260;

export function toChartSeconds(value: string | number): number {
  if (typeof value === "number") {
    return value > 1_000_000_000_000 ? value / 1000 : value;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed / 1000;
}

export function formatHourMinuteAxis(_self: uPlot, splits: number[]): string[] {
  return splits.map((value) => {
    const date = new Date(value * 1000);
    return `${date.getHours().toString().padStart(2, "0")}:${date
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
  });
}

function pad2(value: number) {
  return value.toString().padStart(2, "0");
}

function getDateParts(timestampSeconds: number) {
  const date = new Date(timestampSeconds * 1000);
  return {
    year: date.getFullYear(),
    month: pad2(date.getMonth() + 1),
    day: pad2(date.getDate()),
    hour: pad2(date.getHours()),
    minute: pad2(date.getMinutes()),
    second: pad2(date.getSeconds()),
  };
}

function formatAxisTime(timestampSeconds: number, rangeHours: number) {
  const parts = getDateParts(timestampSeconds);
  if (rangeHours >= 72) return `${parts.month}/${parts.day}`;
  return `${parts.hour}:${parts.minute}`;
}

export function createTimeAxisFormatter(rangeHours: number) {
  return (_self: uPlot, splits: number[]): string[] =>
    splits.map((value) => formatAxisTime(value, rangeHours));
}

export function formatTooltipTime(timestampSeconds: number, rangeHours = 0): string {
  const parts = getDateParts(timestampSeconds);
  if (rangeHours >= 24) {
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
  }
  return `${parts.hour}:${parts.minute}:${parts.second}`;
}

export function formatChartCoverageTime(timestampSeconds: number): string {
  const parts = getDateParts(timestampSeconds);
  return `${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function getChartTooltipPosition({
  containerWidth,
  containerHeight,
  anchorX,
  anchorY,
  rowCount,
  estimatedWidth = 188,
}: {
  containerWidth: number;
  containerHeight: number;
  anchorX: number;
  anchorY: number;
  rowCount: number;
  estimatedWidth?: number;
}) {
  const margin = 10;
  const offsetX = 18;
  const offsetY = 16;
  const estimatedHeight = 34 + rowCount * 22;
  const maxLeft = Math.max(margin, containerWidth - estimatedWidth - margin);
  const maxTop = Math.max(margin, containerHeight - estimatedHeight - margin);

  let left =
    anchorX + estimatedWidth + offsetX <= containerWidth - margin
      ? anchorX + offsetX
      : anchorX - estimatedWidth - offsetX;
  left = clamp(left, margin, maxLeft);

  let top = anchorY - estimatedHeight - offsetY;
  if (top < margin) top = anchorY + offsetY;
  top = clamp(top, margin, maxTop);

  return { left, top };
}

export function useResponsiveChartSize(mode: "grid" | "wide") {
  const [size, setSize] = useState(
    mode === "grid"
      ? GRID_CHART_DEFAULT
      : { w: WIDE_CHART_MAX_WIDTH, h: WIDE_CHART_HEIGHT },
  );

  useEffect(() => {
    function update() {
      const width = window.innerWidth;
      if (mode === "wide") {
        const height =
          width < 720
            ? WIDE_CHART_MOBILE_HEIGHT
            : width < 1024
              ? WIDE_CHART_TABLET_HEIGHT
              : WIDE_CHART_HEIGHT;
        setSize({
          w: Math.min(WIDE_CHART_MAX_WIDTH, Math.max(WIDE_CHART_MIN_WIDTH, width - WIDE_CHART_GUTTER)),
          h: height,
        });
        return;
      }

      if (width >= 1280) {
        setSize({
          w: Math.min(GRID_CHART_DESKTOP_MAX_WIDTH, (width - GRID_CHART_DESKTOP_GUTTER) / 3),
          h: GRID_CHART_HEIGHT,
        });
        return;
      }

      if (width >= 768) {
        setSize({
          w: Math.min(GRID_CHART_TABLET_MAX_WIDTH, (width - GRID_CHART_TABLET_GUTTER) / 2),
          h: GRID_CHART_HEIGHT,
        });
        return;
      }

      setSize({
        w: Math.max(WIDE_CHART_MIN_WIDTH - 20, width - GRID_CHART_MOBILE_GUTTER),
        h: 136,
      });
    }

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [mode]);

  return size;
}
