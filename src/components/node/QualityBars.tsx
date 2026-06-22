import { CanvasStrip, fillRoundedRect, resolveCssColor } from "./CanvasStrip";
import { lossHeatColor } from "@/utils/metricTone";
import type { PingOverviewBucket } from "@/types/komari";

const ACTIVE_BAR_HEIGHT = 0.84;

interface QualityBarsProps {
  value: number | null | undefined;
  count?: number;
  buckets?: PingOverviewBucket[];
  color?: string;
  redrawKey?: string;
  onHoverIndex?: (index: number | null) => void;
}

export function QualityBars({
  value,
  count,
  buckets,
  color,
  redrawKey,
  onHoverIndex,
}: QualityBarsProps) {
  const hasValue = value != null && Number.isFinite(value);
  const fallbackTone = color ?? (hasValue ? lossHeatColor(value) : "var(--progress-bg)");
  const resolvedCount = count ?? Math.max(1, buckets?.length ?? 24);
  const bars = Array.from({ length: resolvedCount }, (_, index) => {
    const bucket = buckets?.[index] ?? null;
    const bucketLoss = bucket?.loss;
    const hasBucketValue =
      bucketLoss != null &&
      Number.isFinite(bucketLoss) &&
      (bucket?.total ?? 0) > 0;
    const loss = hasBucketValue ? bucketLoss : null;
    const active = hasBucketValue || (!buckets?.length && hasValue);
    const tone = color ?? (hasBucketValue ? lossHeatColor(loss) : fallbackTone);

    return {
      active,
      bucket,
      tone,
    };
  });

  return (
    <CanvasStrip
      className="mini-bar-row"
      aria-hidden
      height={16}
      redrawKey={redrawKey}
      getHoverIndex={(offsetX, width) => {
        if (bars.length === 0 || width <= 0) return null;
        const slotWidth = width / bars.length;
        const index = Math.max(0, Math.min(bars.length - 1, Math.floor(offsetX / slotWidth)));
        const bar = bars[index];
        return bar?.bucket?.index ?? (bar?.active ? index : null);
      }}
      onHoverIndex={onHoverIndex}
      draw={(ctx, width, height) => {
        const styles = getComputedStyle(document.documentElement);
        const inactiveColor = resolveCssColor("var(--progress-bg)", styles);
        const gap = bars.length > 48 ? 1 : 2;
        const barWidth = Math.max(1, (width - gap * (bars.length - 1)) / Math.max(1, bars.length));
        const barHeight = height * ACTIVE_BAR_HEIGHT;
        const y = height - barHeight;

        bars.forEach(({ active, tone }, index) => {
          const x = index * (barWidth + gap);
          ctx.globalAlpha = active ? 0.94 : 0.42;
          ctx.fillStyle = active ? resolveCssColor(tone, styles) : inactiveColor;
          fillRoundedRect(ctx, x, y, barWidth, barHeight, 2);
        });

        ctx.globalAlpha = 1;
      }}
    />
  );
}
