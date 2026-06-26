import type { CSSProperties } from "react";
import type { PingOverviewBucket } from "@/types/komari";
import type { TrafficRateDisplay } from "@/utils/format";
import type {
  DashboardSettings,
  DashboardStylePresetId,
  GaugeStylePresetId,
  LiquidDashboardSettings,
} from "@/hooks/useVisualStyle";

export type GaugeDashboardStyleId = Exclude<DashboardStylePresetId, "bars" | "liquid">;

export function buildSubtitle(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

export function formatBucketWindow(bucket: PingOverviewBucket | null) {
  if (!bucket || bucket.startAt == null || bucket.endAt == null) {
    return null;
  }
  const start = new Date(bucket.startAt);
  const end = new Date(bucket.endAt);
  return `${start.getHours().toString().padStart(2, "0")}:${start
    .getMinutes()
    .toString()
    .padStart(2, "0")} - ${end.getHours().toString().padStart(2, "0")}:${end
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

export function formatLatencyBucketSummary(bucket: PingOverviewBucket | null) {
  if (!bucket) return "—";
  if (bucket.value != null) {
    return `${bucket.value.toFixed(1)} ms`;
  }
  return bucket.total > 0 ? "失败" : "无样本";
}

export function formatLossBucketSummary(bucket: PingOverviewBucket | null) {
  if (!bucket) return "—";
  if ((bucket.total ?? 0) <= 0 || bucket.loss == null) {
    return "无样本";
  }
  return `${bucket.loss.toFixed(1)}% ${bucket.lost}/${bucket.total}`;
}

export function clampFraction(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function getTrafficRadarLimit(rate: TrafficRateDisplay) {
  if (rate.unit === "Tbps") {
    return { bitsPerSec: 10_000_000_000_000, label: "10 Tbps" };
  }
  if (rate.unit === "Gbps") {
    return { bitsPerSec: 1_000_000_000_000, label: "1 Tbps" };
  }
  if (rate.unit === "Mbps") {
    return { bitsPerSec: 1_000_000_000, label: "1 Gbps" };
  }
  return { bitsPerSec: 1_000_000, label: "1 Mbps" };
}

export function scalePercent(value: number, min: number, max: number, inputMax = 100) {
  const clamped = Math.max(0, Math.min(inputMax, value));
  return min + (max - min) * (clamped / inputMax);
}

export function scaleBoostedPercent(value: number, min: number, maxAt100: number, maxAt200: number) {
  const clamped = Math.max(0, Math.min(200, value));
  if (clamped <= 100) {
    return min + (maxAt100 - min) * (clamped / 100);
  }
  return maxAt100 + (maxAt200 - maxAt100) * ((clamped - 100) / 100);
}

export function dashboardMotionStyle(value: number, transitionMin: number, transitionMax: number) {
  return {
    "--radar-motion-ms": `${Math.round(
      scaleBoostedPercent(value, transitionMin, transitionMax, transitionMax + 220),
    )}ms`,
    "--radar-motion-pulse-opacity": scaleBoostedPercent(value, 0, 0.12, 0.32).toFixed(3),
    "--radar-pulse-ms": `${Math.round(
      scaleBoostedPercent(value, 2600, 1700, 980),
    )}ms`,
  };
}

export function dashboardGaugePreset(
  variant: GaugeDashboardStyleId,
  settings: DashboardSettings,
): GaugeStylePresetId {
  return settings[variant].gaugeStyle;
}

export function getSegmentTrackStyle(gaugeStyle: GaugeStylePresetId) {
  if (gaugeStyle === "fragment") {
    return { strokeDasharray: "4 2 10 4 3 3 13 5 7 4" } as CSSProperties;
  }
  if (gaugeStyle === "pulse") {
    return { strokeDasharray: "1 3.2" } as CSSProperties;
  }
  if (gaugeStyle === "circuit") {
    return { strokeDasharray: "5 7" } as CSSProperties;
  }
  if (gaugeStyle === "scan") {
    return { strokeDasharray: "1 5.4" } as CSSProperties;
  }
  if (gaugeStyle !== "segmented") return undefined;
  return { strokeDasharray: "2.4 5.1" } as CSSProperties;
}

export function getSegmentTickStyle(gaugeStyle: GaugeStylePresetId) {
  if (gaugeStyle === "pulse") {
    return { strokeDasharray: "0.8 3.35" } as CSSProperties;
  }
  if (gaugeStyle === "scan") {
    return { strokeDasharray: "1 6.2" } as CSSProperties;
  }
  if (gaugeStyle !== "segmented") return undefined;
  return { strokeDasharray: "1 7.35" } as CSSProperties;
}

export function getProgressStyle(percent: number, gaugeStyle: GaugeStylePresetId) {
  if (gaugeStyle === "fragment") {
    return { strokeDasharray: `${Math.max(0, percent - 1)} 1 0 100` } as CSSProperties;
  }
  if (gaugeStyle === "scan") {
    return { strokeDasharray: `${Math.max(0, percent - 4)} 1 3 100` } as CSSProperties;
  }
  return { strokeDasharray: `${percent} 100` } as CSSProperties;
}

export function getGlowStyle(percent: number, gaugeStyle: GaugeStylePresetId) {
  if (gaugeStyle === "scan") {
    return { strokeDasharray: `${Math.max(0, percent - 12)} 3 9 100` } as CSSProperties;
  }
  return { strokeDasharray: `${percent} 100` } as CSSProperties;
}

export function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getRadarScanDelay(seed: string, index: number) {
  const seedOffset = hashString(seed) % 1600;
  return `-${seedOffset + index * 280}ms`;
}

export function ringPoint(percent: number, radius = 38) {
  const angle = (percent * 3.6 * Math.PI) / 180;
  return {
    x: 50 + radius * Math.cos(angle),
    y: 50 + radius * Math.sin(angle),
  };
}

export function arcPoint(percent: number, radius = 46) {
  const angle = ((180 - percent * 1.8) * Math.PI) / 180;
  return {
    x: 60 + radius * Math.cos(angle),
    y: 58 - radius * Math.sin(angle),
  };
}

export function gaugeHeadPoint(
  variant: GaugeDashboardStyleId,
  percent: number,
  radius?: number,
) {
  return variant === "ring" ? ringPoint(percent, radius) : arcPoint(percent, radius);
}

export function renderRingCircle(className: string, radius: number, style?: CSSProperties) {
  return (
    <circle
      className={className}
      cx="50"
      cy="50"
      r={radius}
      pathLength={100}
      style={style}
    />
  );
}

export function renderArcPath(className: string, style?: CSSProperties) {
  return (
    <path
      className={className}
      d="M 14 58 A 46 46 0 0 1 106 58"
      pathLength={100}
      style={style}
    />
  );
}

export function renderGaugePath(
  variant: GaugeDashboardStyleId,
  className: string,
  style?: CSSProperties,
  radius = 38,
) {
  return variant === "ring"
    ? renderRingCircle(className, radius, style)
    : renderArcPath(className, style);
}

export function renderGaugeBackArt(
  variant: GaugeDashboardStyleId,
  gaugeStyle: GaugeStylePresetId,
  percent: number,
) {
  if (gaugeStyle === "fragment") {
    return (
      <>
        {renderGaugePath(variant, "radar-gauge-art-fragments", {
          strokeDasharray: "6 3 13 5 4 3 16 5 8 4",
          strokeDashoffset: `${100 - percent}`,
        })}
        {renderGaugePath(variant, "radar-gauge-art-fragments is-inner", {
          strokeDasharray: "3 8 9 5 5 7",
          strokeDashoffset: `${percent / 2}`,
        }, 29)}
      </>
    );
  }

  if (gaugeStyle === "pulse") {
    return (
      <>
        {renderGaugePath(variant, "radar-gauge-art-teeth", {
          strokeDasharray: "0.9 3.4",
        }, 44)}
        {renderGaugePath(variant, "radar-gauge-art-teeth is-inner", {
          strokeDasharray: "0.8 6.2",
          strokeDashoffset: `${percent / 4}`,
        }, 28)}
      </>
    );
  }

  if (gaugeStyle === "liquid") {
    return (
      <>
        {renderGaugePath(variant, "radar-gauge-art-liquid-bed", undefined, 38)}
        {renderGaugePath(variant, "radar-gauge-art-liquid-vein", {
          strokeDasharray: `${Math.max(6, percent - 14)} 100`,
        }, 30)}
      </>
    );
  }

  if (gaugeStyle === "dual") {
    return (
      <>
        {renderGaugePath(variant, "radar-gauge-art-dual is-outer", {
          strokeDasharray: `${Math.min(100, percent + 12)} 100`,
          strokeDashoffset: "-7",
        }, 45)}
        {renderGaugePath(variant, "radar-gauge-art-dual is-inner", {
          strokeDasharray: `${Math.max(0, percent - 9)} 100`,
          strokeDashoffset: "9",
        }, 29)}
      </>
    );
  }

  if (gaugeStyle === "aurora") {
    return (
      <>
        {renderGaugePath(variant, "radar-gauge-art-aurora-ribbon", {
          strokeDasharray: "27 5 18 7 18 100",
          strokeDashoffset: `${100 - percent}`,
        }, 35)}
        {renderGaugePath(variant, "radar-gauge-art-aurora-accent", {
          strokeDasharray: `${Math.max(0, percent - 8)} 100`,
        }, 43)}
      </>
    );
  }

  if (gaugeStyle === "scan") {
    return (
      <>
        {renderGaugePath(variant, "radar-gauge-art-scan-dots", {
          strokeDasharray: "1 5.8",
        }, 42)}
        {renderGaugePath(variant, "radar-gauge-art-scan-trail", {
          strokeDasharray: "10 3 7 4 18 100",
        })}
      </>
    );
  }

  return null;
}

export function renderCircuitArt(
  variant: GaugeDashboardStyleId,
) {
  if (variant === "ring") {
    return (
      <g className="radar-gauge-circuit">
        <line x1="50" y1="12" x2="50" y2="3" />
        <line x1="83" y1="31" x2="93" y2="25" />
        <line x1="87" y1="58" x2="98" y2="61" />
        <line x1="22" y1="75" x2="13" y2="83" />
        <line x1="12" y1="49" x2="2" y2="49" />
        <circle cx="50" cy="3" r="2.8" />
        <circle cx="93" cy="25" r="2.6" />
        <circle cx="98" cy="61" r="3" />
        <circle cx="13" cy="83" r="2.6" />
        <circle cx="2" cy="49" r="2.8" />
      </g>
    );
  }

  return (
    <g className="radar-gauge-circuit">
      <line x1="16" y1="58" x2="6" y2="58" />
      <line x1="35" y1="28" x2="29" y2="18" />
      <line x1="60" y1="12" x2="60" y2="2" />
      <line x1="85" y1="28" x2="91" y2="18" />
      <line x1="104" y1="58" x2="114" y2="58" />
      <circle cx="6" cy="58" r="2.8" />
      <circle cx="29" cy="18" r="2.6" />
      <circle cx="60" cy="2" r="2.8" />
      <circle cx="91" cy="18" r="2.6" />
      <circle cx="114" cy="58" r="2.8" />
    </g>
  );
}

export function renderWaveArt(
  variant: GaugeDashboardStyleId,
) {
  if (variant === "ring") {
    return (
      <g className="radar-gauge-wave">
        <line x1="50" y1="3" x2="50" y2="-7" />
        <line x1="72" y1="9" x2="77" y2="-1" />
        <line x1="89" y1="26" x2="99" y2="20" />
        <line x1="97" y1="50" x2="109" y2="50" />
        <line x1="89" y1="74" x2="99" y2="80" />
        <line x1="28" y1="9" x2="23" y2="-1" />
        <line x1="11" y1="26" x2="1" y2="20" />
        <line x1="3" y1="50" x2="-9" y2="50" />
        <line x1="11" y1="74" x2="1" y2="80" />
      </g>
    );
  }

  return (
    <g className="radar-gauge-wave">
      <line x1="14" y1="58" x2="2" y2="58" />
      <line x1="25" y1="35" x2="14" y2="28" />
      <line x1="43" y1="18" x2="37" y2="6" />
      <line x1="60" y1="12" x2="60" y2="-2" />
      <line x1="77" y1="18" x2="83" y2="6" />
      <line x1="95" y1="35" x2="106" y2="28" />
      <line x1="106" y1="58" x2="118" y2="58" />
    </g>
  );
}

export function renderGaugeFrontArt(
  variant: GaugeDashboardStyleId,
  gaugeStyle: GaugeStylePresetId,
  percent: number,
) {
  const head = gaugeHeadPoint(variant, percent);

  if (gaugeStyle === "liquid") {
    const bubbleA = gaugeHeadPoint(variant, Math.max(0, percent - 18), 32);
    const bubbleB = gaugeHeadPoint(variant, Math.max(0, percent - 36), 25);
    return (
      <g className="radar-gauge-liquid-head">
        <circle cx={bubbleB.x} cy={bubbleB.y} r="2.4" />
        <circle cx={bubbleA.x} cy={bubbleA.y} r="3.4" />
        <circle cx={head.x} cy={head.y} r="5.6" />
      </g>
    );
  }

  if (gaugeStyle === "circuit") {
    return renderCircuitArt(variant);
  }

  if (gaugeStyle === "wave") {
    return renderWaveArt(variant);
  }

  if (gaugeStyle === "scan") {
    const trailA = gaugeHeadPoint(variant, Math.max(0, percent - 8));
    const trailB = gaugeHeadPoint(variant, Math.max(0, percent - 18));
    return (
      <g className="radar-gauge-scan-head">
        <circle cx={trailB.x} cy={trailB.y} r="1.8" />
        <circle cx={trailA.x} cy={trailA.y} r="2.8" />
        <circle cx={head.x} cy={head.y} r="5" />
      </g>
    );
  }

  return null;
}

export function scalePercentLegacy(value: number, min: number, max: number) {
  return scalePercent(value, min, max);
}

export function dashboardGaugeStyle(
  variant: GaugeDashboardStyleId,
  settings: DashboardSettings,
) {
  if (variant === "ring") {
    const ring = settings.ring;
    return {
      "--radar-stroke-width": `${scalePercentLegacy(ring.thickness, 5.5, 12).toFixed(1)}px`,
      "--radar-glow-width": `${scaleBoostedPercent(ring.glow, 9, 19, 30).toFixed(1)}px`,
      "--radar-glow-opacity": scaleBoostedPercent(ring.glow, 0.04, 0.24, 0.42).toFixed(3),
      ...dashboardMotionStyle(ring.motion, 240, 860),
      "--radar-value-size": `${scalePercentLegacy(ring.centerScale, 13, 18).toFixed(1)}px`,
      "--radar-grid-gap": "10px",
      "--radar-padding-y": "8px",
      "--radar-padding-x": "7px",
    } as CSSProperties;
  }

  if (variant === "dial") {
    const dial = settings.dial;
    return {
      "--radar-stroke-width": `${scalePercentLegacy(dial.thickness, 5.5, 12).toFixed(1)}px`,
      "--radar-glow-width": `${scaleBoostedPercent(dial.glow, 9, 18, 29).toFixed(1)}px`,
      "--radar-glow-opacity": scaleBoostedPercent(dial.glow, 0.04, 0.22, 0.4).toFixed(3),
      ...dashboardMotionStyle(dial.motion, 220, 920),
      "--radar-needle-width": `${scalePercentLegacy(dial.needle, 1.8, 5.6).toFixed(1)}px`,
      "--radar-tick-opacity": scalePercentLegacy(dial.ticks, 0.08, 0.74).toFixed(3),
      "--radar-tick-width": `${scalePercentLegacy(dial.ticks, 1, 2.8).toFixed(1)}px`,
      "--radar-value-size": "15px",
      "--radar-grid-gap": "10px",
      "--radar-padding-y": "8px",
      "--radar-padding-x": "7px",
    } as CSSProperties;
  }

  const arc = settings.arc;
  return {
    "--radar-stroke-width": `${scalePercentLegacy(arc.thickness, 5.5, 13).toFixed(1)}px`,
    "--radar-glow-width": `${scaleBoostedPercent(arc.glow, 9, 20, 32).toFixed(1)}px`,
    "--radar-glow-opacity": scaleBoostedPercent(arc.glow, 0.04, 0.25, 0.44).toFixed(3),
    ...dashboardMotionStyle(arc.motion, 220, 840),
    "--radar-grid-gap": `${scalePercentLegacy(arc.compactness, 14, 8).toFixed(1)}px`,
    "--radar-padding-y": `${scalePercentLegacy(arc.compactness, 10, 6.5).toFixed(1)}px`,
    "--radar-padding-x": `${scalePercentLegacy(arc.compactness, 9, 6).toFixed(1)}px`,
    "--radar-value-size": "15px",
  } as CSSProperties;
}

export function liquidDashboardStyle(settings: LiquidDashboardSettings) {
  return {
    "--liquid-wave-scale": scalePercentLegacy(settings.wave, 0.45, 1.55).toFixed(3),
    "--liquid-glass-opacity": scalePercentLegacy(settings.glass, 0.24, 0.88).toFixed(3),
    "--liquid-glow-extra": scaleBoostedPercent(settings.glow, 0, 0.16, 0.38).toFixed(3),
    "--liquid-bottom-mix": `${Math.round(scaleBoostedPercent(settings.glow, 7, 12, 19))}%`,
    "--liquid-shadow-mix": `${Math.round(scaleBoostedPercent(settings.glow, 52, 68, 88))}%`,
    "--liquid-svg-glow-mix": `${Math.round(scaleBoostedPercent(settings.glow, 18, 34, 58))}%`,
    "--liquid-fill-opacity": scaleBoostedPercent(settings.glow, 0.62, 0.78, 0.96).toFixed(3),
    "--liquid-wave-opacity": scaleBoostedPercent(settings.glow, 0.72, 0.86, 0.98).toFixed(3),
    "--liquid-shine-opacity": scalePercentLegacy(settings.glass, 0.08, 0.28).toFixed(3),
    "--liquid-segment-opacity": scalePercentLegacy(settings.glass, 0.18, 0.56).toFixed(3),
    "--liquid-texture-opacity": scalePercentLegacy(settings.texture, 0, 0.48).toFixed(3),
    "--liquid-hud-opacity": scalePercentLegacy(settings.texture, 0.18, 0.78).toFixed(3),
    "--liquid-panel-opacity": scalePercentLegacy(settings.glass, 0.18, 0.52).toFixed(3),
  } as CSSProperties;
}

export function getLiquidMotionMs(percent: number, settings: LiquidDashboardSettings) {
  const base = scalePercent(percent, 7000, 4200);
  const multiplier = scaleBoostedPercent(settings.motion, 1.15, 0.86, 0.72);
  return Math.max(3000, Math.round(base * multiplier));
}
