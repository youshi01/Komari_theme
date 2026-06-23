import type { MarqueeStyleSettings } from "@/hooks/useVisualStyle";
import { CanvasStrip } from "./CanvasStrip";
import {
  drawMarqueeStrip,
  getMarqueeFrameInterval,
  shouldAnimateMarqueeStyle,
} from "./marqueeStyle";
import { lossHeatColor } from "@/utils/metricTone";
import type { PingOverviewBucket } from "@/types/komari";

interface QualityBarsProps {
  value: number | null | undefined;
  count?: number;
  buckets?: PingOverviewBucket[];
  color?: string;
  marqueeStyle: MarqueeStyleSettings;
  redrawKey?: string;
  onHoverIndex?: (index: number | null) => void;
}

export function QualityBars({
  value,
  count,
  buckets,
  color,
  marqueeStyle,
  redrawKey,
  onHoverIndex,
}: QualityBarsProps) {
  const hasValue = value != null && Number.isFinite(value);
  const fallbackTone = color ?? (hasValue ? lossHeatColor(value) : "var(--progress-bg)");
  const resolvedCount = count ?? Math.max(1, buckets?.length ?? 24);
  const hasBucketHistory = Boolean(buckets?.length);
  const fallbackLoss = hasValue ? Math.max(0, value) : 0;
  const fallbackActiveDots =
    !hasBucketHistory && fallbackLoss > 0
      ? Math.max(1, Math.min(4, Math.ceil(fallbackLoss / 8)))
      : 0;
  const bars = Array.from({ length: resolvedCount }, (_, index) => {
    const bucket = buckets?.[index] ?? null;
    const bucketLoss = bucket?.loss;
    const hasBucketSamples = (bucket?.total ?? 0) > 0;
    const hasBucketValue =
      bucketLoss != null && Number.isFinite(bucketLoss) && hasBucketSamples;
    const loss = hasBucketValue ? bucketLoss : null;
    const hasSamples = hasBucketSamples || (!hasBucketHistory && hasValue);
    const hasLoss = hasBucketHistory
      ? (loss ?? 0) > 0
      : fallbackActiveDots > 0 && index >= resolvedCount - fallbackActiveDots;
    const active = Boolean(hasSamples && hasLoss);
    const tone = color ?? fallbackTone;

    return {
      active,
      bucket,
      level: active ? Math.max(0.22, Math.min(1, (loss ?? fallbackLoss) / 30)) : 0.18,
      hasSamples,
      tone,
    };
  });
  const lossMarqueeStyle: MarqueeStyleSettings = {
    ...marqueeStyle,
    shape: "classic",
    density: Math.min(58, Math.max(38, marqueeStyle.density)),
    radius: 100,
    glow: Math.min(36, Math.round(marqueeStyle.glow * 0.5)),
    motion: Math.min(22, Math.round(marqueeStyle.motion * 0.38)),
  };
  const points = bars.map(({ active, level, tone }) => ({
    active,
    level,
    opacity: active ? 0.82 + level * 0.16 : 0,
    accentShare: active ? 0.08 : 0,
    color: tone,
    hideInactive: true,
    toneOffset: active ? -0.1 - level * 0.14 : 0,
  }));
  const hasActivePoints = points.some((point) => point.active);

  return (
    <CanvasStrip
      className="mini-bar-row"
      aria-hidden
      height={16}
      redrawKey={redrawKey}
      animated={hasActivePoints && shouldAnimateMarqueeStyle(lossMarqueeStyle)}
      frameIntervalMs={getMarqueeFrameInterval(lossMarqueeStyle)}
      getHoverIndex={(offsetX, width) => {
        if (bars.length === 0 || width <= 0) return null;
        const slotWidth = width / bars.length;
        const index = Math.max(0, Math.min(bars.length - 1, Math.floor(offsetX / slotWidth)));
        const bar = bars[index];
        return bar?.bucket?.index ?? (bar?.hasSamples ? index : null);
      }}
      onHoverIndex={onHoverIndex}
      draw={(ctx, width, height, now) =>
        drawMarqueeStrip(ctx, width, height, {
          points,
          style: lossMarqueeStyle,
          variant: "trend",
          now,
          colors: {
            base: color ?? "var(--ys-metric-loss, var(--status-offline))",
            accent: color ?? "var(--ys-metric-loss, var(--status-offline))",
            inactive: "var(--progress-bg)",
          },
        })
      }
    />
  );
}
