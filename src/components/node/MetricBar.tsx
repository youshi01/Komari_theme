import { useCallback, useMemo, type ReactNode } from "react";
import type { MarqueeStyleSettings } from "@/hooks/useVisualStyle";
import { CanvasStrip } from "./CanvasStrip";
import {
  buildProgressPoints,
  drawMarqueeStrip,
  getMarqueeFrameInterval,
  shouldAnimateMarqueeStyle,
} from "./marqueeStyle";

type MetricPaint =
  | {
      kind: "solid";
      color: string;
    }
  | {
      kind: "gradient";
      from: string;
      to: string;
    };

interface MetricBarProps {
  icon: ReactNode;
  label: string;
  valueText: string;
  unit?: string;
  detailText?: string;
  fraction: number; // 0..1
  redrawKey?: string;
  paint: MetricPaint;
  marqueeStyle: MarqueeStyleSettings;
}

export function MetricBar({
  icon,
  label,
  valueText,
  unit,
  detailText,
  fraction,
  redrawKey,
  paint,
  marqueeStyle,
}: MetricBarProps) {
  const clamped = Math.max(0, Math.min(1, fraction));
  const points = useMemo(
    () => buildProgressPoints(clamped, marqueeStyle),
    [clamped, marqueeStyle],
  );
  const activeColor = paint.kind === "gradient" ? paint.from : paint.color;
  const accentColor =
    paint.kind === "gradient"
      ? paint.to
      : "var(--ys-marquee-peak, var(--status-warning))";
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number, now: number) =>
      drawMarqueeStrip(ctx, width, height, {
        points,
        style: marqueeStyle,
        variant: "progress",
        now,
        colors: {
          base: activeColor,
          accent: accentColor,
          inactive: "var(--progress-bg)",
        },
      }),
    [accentColor, activeColor, marqueeStyle, points],
  );

  return (
    <div className="metric-item">
      <div className="flex justify-between items-center gap-3 min-w-0">
        <div className="flex items-center gap-1.5 text-[var(--text-secondary)] flex-shrink-0">
          <span>{icon}</span>
          <span className="text-[11px] font-medium tracking-[0.02em]">{label}</span>
        </div>
        <div className="tabular text-[13px] text-[var(--text-primary)] whitespace-nowrap overflow-hidden text-ellipsis max-w-full text-right">
          <span className="font-semibold">{valueText}</span>
          {unit && (
            <span className="ml-[1px] text-[11px] text-[var(--text-tertiary)]">{unit}</span>
          )}
        </div>
      </div>
      <div
        className="metric-detail"
        title={detailText}
        data-empty={detailText ? "false" : "true"}
      >
        {detailText ?? "\u00A0"}
      </div>
      <div className="metric-track">
        <CanvasStrip
          className="metric-track-canvas"
          height={10}
          ariaHidden
          redrawKey={redrawKey}
          animated={shouldAnimateMarqueeStyle(marqueeStyle)}
          frameIntervalMs={getMarqueeFrameInterval(marqueeStyle)}
          draw={draw}
        />
      </div>
    </div>
  );
}
