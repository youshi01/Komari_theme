import { useCallback, useMemo } from "react";
import type {
  MarqueeStyleSettings,
  VisualMetricColors,
} from "@/hooks/useVisualStyle";
import { CanvasStrip } from "./CanvasStrip";
import {
  drawMarqueeStrip,
  getMarqueeFrameInterval,
  shouldAnimateMarqueeStyle,
} from "./marqueeStyle";

const PREVIEW_LEVELS = [
  0.12, 0.28, 0.55, 0.86, 0.34, 0.72, 0.95, 0.48, 0.2, 0.66, 0.9, 0.38,
  0.6, 0.18, 0.78, 0.52, 0.32, 0.88,
];

interface MarqueePreviewStripProps {
  style: MarqueeStyleSettings;
  colors: VisualMetricColors;
  className?: string;
  height?: number;
  animated?: boolean;
}

export function MarqueePreviewStrip({
  style,
  colors,
  className = "visual-style-preview-marquee",
  height = 16,
  animated = true,
}: MarqueePreviewStripProps) {
  const points = useMemo(
    () =>
      PREVIEW_LEVELS.map((level, index) => ({
        level,
        active: index % 7 !== 1,
        opacity: 0.62 + level * 0.34,
        color:
          index % 6 === 0
            ? colors.peak
            : index % 4 === 0
              ? colors.down
              : index % 3 === 0
                ? colors.latency
                : colors.up,
      })),
    [colors.down, colors.latency, colors.peak, colors.up],
  );
  const redrawKey = useMemo(
    () =>
      `${style.preset}:${style.shape}:${style.density}:${style.radius}:${style.glow}:${style.motion}:${Object.values(
        colors,
      ).join("|")}`,
    [colors, style.density, style.glow, style.motion, style.preset, style.radius, style.shape],
  );
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, stripHeight: number, now: number) =>
      drawMarqueeStrip(ctx, width, stripHeight, {
        points,
        style,
        variant: "trend",
        now,
        colors: {
          base: colors.up,
          accent: colors.peak,
          inactive: colors.idle,
        },
      }),
    [colors.idle, colors.peak, colors.up, points, style],
  );

  return (
    <CanvasStrip
      className={className}
      height={height}
      ariaHidden
      redrawKey={redrawKey}
      animated={animated && shouldAnimateMarqueeStyle(style)}
      frameIntervalMs={getMarqueeFrameInterval(style)}
      draw={draw}
    />
  );
}
