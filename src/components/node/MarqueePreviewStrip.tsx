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
}

export function MarqueePreviewStrip({
  style,
  colors,
  className = "visual-style-preview-marquee",
  height = 16,
}: MarqueePreviewStripProps) {
  const points = PREVIEW_LEVELS.map((level, index) => ({
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
  }));
  const redrawKey = `${style.preset}:${style.shape}:${style.density}:${style.radius}:${style.glow}:${style.motion}:${Object.values(
    colors,
  ).join("|")}`;

  return (
    <CanvasStrip
      className={className}
      height={height}
      ariaHidden
      redrawKey={redrawKey}
      animated={shouldAnimateMarqueeStyle(style)}
      frameIntervalMs={getMarqueeFrameInterval(style)}
      draw={(ctx, width, stripHeight, now) =>
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
        })
      }
    />
  );
}
