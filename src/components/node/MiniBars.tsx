import { CanvasStrip, fillRoundedRect, resolveCssColor } from "./CanvasStrip";
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
  redrawKey,
  onHoverIndex,
}: MiniBarsProps) {
  const bars: Array<{ value: number; bucket: PingOverviewBucket | null; hasSamples: boolean; tone: string }> =
    buckets && buckets.length > 0
      ? buckets.map((bucket) => {
          const value = bucket.value ?? 0;
          return {
            value,
            bucket,
            hasSamples: bucket.total > 0,
            tone: latencyHeatColor(bucket.value),
          };
        })
      : (() => {
          const fallbackTone = latencyHeatColor(lastValue);
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
                tone: fallbackTone,
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
                tone: fallbackTone,
              });
            }
            values.forEach((value) => {
              nextBars.push({
                value,
                bucket: null,
                hasSamples: true,
                tone: latencyHeatColor(value > 0 ? value : lastValue),
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
              tone: latencyHeatColor(avg > 0 ? avg : lastValue),
            });
          }
          return nextBars;
        })();

  return (
    <CanvasStrip
      className="mini-bar-row"
      height={16}
      ariaHidden
      redrawKey={redrawKey}
      getHoverIndex={(offsetX, width) => {
        if (bars.length === 0 || width <= 0) return null;
        const slotWidth = width / bars.length;
        const index = Math.max(0, Math.min(bars.length - 1, Math.floor(offsetX / slotWidth)));
        const bar = bars[index];
        return bar?.bucket?.index ?? (bar?.hasSamples ? index : null);
      }}
      onHoverIndex={onHoverIndex}
      draw={(ctx, width, height) => {
        const inactiveColor = resolveCssColor("var(--progress-bg)");
        const gap = bars.length > 48 ? 1 : 2;
        const barWidth = Math.max(1, (width - gap * (bars.length - 1)) / Math.max(1, bars.length));

        bars.forEach(({ value, tone }, index) => {
          const has = value > 0;
          const barHeight = height * (has ? Math.max(0.2, Math.min(1, value / max)) : 0.25);
          const x = index * (barWidth + gap);
          const y = height - barHeight;

          ctx.globalAlpha = has ? 0.92 : 0.55;
          ctx.fillStyle = has ? tone : inactiveColor;
          fillRoundedRect(ctx, x, y, barWidth, barHeight, 2);
        });

        ctx.globalAlpha = 1;
      }}
    />
  );
}
