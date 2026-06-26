import { useCallback, useMemo } from "react";
import type { MarqueeStyleSettings } from "@/hooks/useVisualStyle";
import { CanvasStrip } from "./CanvasStrip";
import {
  drawMarqueeStrip,
  getMarqueeFrameInterval,
  shouldAnimateMarqueeStyle,
} from "./marqueeStyle";
import { latencyHeatColor } from "@/utils/metricTone";
import type { PingOverviewBucket } from "@/types/komari";

interface MiniBarsProps {
  /** Raw latency values (ms) ordered oldest→newest. Values ≤0 are treated as lost and dimmed. */
  values: number[];
  /** Denominator for 0..1 normalization (use the max across the window). */
  max: number;
  /** Color tier threshold based on this value (fallback path only). */
  lastValue?: number;
  /** How many bars to render (pads older buckets with empty). */
  count?: number;
  buckets?: PingOverviewBucket[];
  color?: string;
  marqueeStyle: MarqueeStyleSettings;
  redrawKey?: string;
  onHoverIndex?: (index: number | null) => void;
}

/** Pixel-matched latency histogram (24 bars, 8px tall, 1px gap). */
export function MiniBars({
  values,
  max,
  lastValue,
  count = 24,
  buckets,
  color,
  marqueeStyle,
  redrawKey,
  onHoverIndex,
}: MiniBarsProps) {
  const baseTone = color ?? latencyHeatColor(lastValue);
  const bars: Array<{
    value: number;
    bucket: PingOverviewBucket | null;
    hasSamples: boolean;
    tone: string;
  }> = useMemo(
    () =>
      buckets && buckets.length > 0
      ? buckets.map((bucket) => {
          const value = bucket.value ?? 0;
          return {
            value,
            bucket,
            hasSamples: bucket.total > 0,
            tone: baseTone,
          };
        })
      : (() => {
          const nextBars: Array<{
            value: number;
            bucket: PingOverviewBucket | null;
            hasSamples: boolean;
            tone: string;
          }> = [];

          if (values.length === 0) {
            for (let i = 0; i < count; i++) {
              nextBars.push({
                value: 0,
                bucket: null,
                hasSamples: false,
                tone: baseTone,
              });
            }
            return nextBars;
          }

          if (values.length <= count) {
            const padding = count - values.length;
            for (let i = 0; i < padding; i++) {
              nextBars.push({
                value: 0,
                bucket: null,
                hasSamples: false,
                tone: baseTone,
              });
            }
            values.forEach((value) => {
              nextBars.push({
                value,
                bucket: null,
                hasSamples: true,
                tone: baseTone,
              });
            });
            return nextBars;
          }

          const bucketSize = values.length / count;
          for (let i = 0; i < count; i++) {
            const start = Math.floor(i * bucketSize);
            const end = Math.floor((i + 1) * bucketSize);
            const slice = values.slice(start, end);
            const positive = slice.filter((v) => v > 0);
            const avg = positive.length
              ? positive.reduce((a, b) => a + b, 0) / positive.length
              : 0;
            nextBars.push({
              value: avg,
              bucket: null,
              hasSamples: slice.length > 0,
              tone: baseTone,
            });
          }
          return nextBars;
        })(),
    [baseTone, buckets, count, values],
  );
  const safeMax = Math.max(1, max);
  const positiveValues = bars
    .map((bar) => bar.value)
    .filter((value) => value > 0 && Number.isFinite(value));
  const latencyMin = positiveValues.length > 0 ? Math.min(...positiveValues) : 0;
  const latencyMax = positiveValues.length > 0 ? Math.max(...positiveValues) : safeMax;
  const latencyRange = Math.max(1, latencyMax - latencyMin);
  const detailMarqueeStyle = useMemo(
    () => ({
      ...marqueeStyle,
      glow: Math.min(42, Math.round(marqueeStyle.glow * 0.58)),
      motion: Math.min(32, Math.round(marqueeStyle.motion * 0.52)),
    }),
    [marqueeStyle],
  );
  const points = useMemo(
    () =>
      bars.map(({ value, tone, hasSamples }) => {
        const active = hasSamples && value > 0;
        const relative = active
          ? latencyRange > 3
            ? Math.max(0, Math.min(1, (value - latencyMin) / latencyRange))
            : Math.max(0, Math.min(1, value / safeMax))
          : 0;
        return {
          level: active ? Math.max(0.2, Math.min(1, value / safeMax)) : 0.18,
          active,
          opacity: active ? 0.74 + relative * 0.22 : 0.42,
          accentShare: 0,
          color: tone,
          toneOffset: active ? 0.24 - relative * 0.5 : 0,
        };
      }),
    [bars, latencyMax, latencyMin, latencyRange, safeMax],
  );
  const hasActivePoints = points.some((point) => point.active);
  const getHoverIndex = useCallback(
    (offsetX: number, width: number) => {
      if (bars.length === 0 || width <= 0) return null;
      const slotWidth = width / bars.length;
      const index = Math.max(0, Math.min(bars.length - 1, Math.floor(offsetX / slotWidth)));
      const bar = bars[index];
      return bar?.bucket?.index ?? (bar?.hasSamples ? index : null);
    },
    [bars],
  );
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number, now: number) =>
      drawMarqueeStrip(ctx, width, height, {
        points,
        style: detailMarqueeStyle,
        variant: "histogram",
        now,
        colors: {
          base: color ?? "var(--ys-metric-latency, var(--status-online))",
          accent: color ?? "var(--ys-metric-latency, var(--status-online))",
          inactive: "var(--progress-bg)",
        },
      }),
    [color, detailMarqueeStyle, points],
  );

  return (
    <CanvasStrip
      className="mini-bar-row"
      height={16}
      ariaHidden
      redrawKey={redrawKey}
      animated={hasActivePoints && shouldAnimateMarqueeStyle(detailMarqueeStyle)}
      frameIntervalMs={getMarqueeFrameInterval(detailMarqueeStyle)}
      getHoverIndex={getHoverIndex}
      onHoverIndex={onHoverIndex}
      draw={draw}
    />
  );
}
