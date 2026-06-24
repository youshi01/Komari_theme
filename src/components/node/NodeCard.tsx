import { memo, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Cpu,
  Gauge,
  MemoryStick,
  HardDrive,
  Globe,
  ArrowDown,
  ArrowUp,
  Clock3,
  Unplug,
  Calendar,
  RefreshCw,
  ExternalLink,
  Power,
} from "lucide-react";
import { useNode, useNodeTrafficTrend } from "@/hooks/useNode";
import { usePingMini, usePingMiniBuckets } from "@/hooks/usePingMini";
import { usePreferences } from "@/hooks/usePreferences";
import {
  formatBytes,
  formatExpireDays,
  formatOfflineDuration,
  formatTrafficRate,
  formatUptimeDays,
  parseTags,
} from "@/utils/format";
import { getExpireTextColor } from "@/utils/expireStatus";
import { Flag } from "@/components/ui/Flag";
import { MetricBar } from "./MetricBar";
import { MiniBars } from "./MiniBars";
import { QualityBars } from "./QualityBars";
import { CanvasStrip } from "./CanvasStrip";
import {
  drawMarqueeStrip,
  getMarqueeFrameInterval,
  shouldAnimateMarqueeStyle,
} from "./marqueeStyle";
import { clsx } from "clsx";
import type { PingOverviewBucket, TrafficTrendSample } from "@/types/komari";
import type { TrafficRateDisplay } from "@/utils/format";
import type {
  DashboardSettings,
  DashboardStylePresetId,
  GaugeStylePresetId,
  MarqueeStyleSettings,
} from "@/hooks/useVisualStyle";

function buildSubtitle(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

function formatBucketWindow(bucket: PingOverviewBucket | null) {
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

function formatLatencyBucketSummary(bucket: PingOverviewBucket | null) {
  if (!bucket) return "—";
  if (bucket.value != null) {
    return `${bucket.value.toFixed(1)} ms`;
  }
  return bucket.total > 0 ? "失败" : "无样本";
}

function formatLossBucketSummary(bucket: PingOverviewBucket | null) {
  if (!bucket) return "—";
  if ((bucket.total ?? 0) <= 0 || bucket.loss == null) {
    return "无样本";
  }
  return `${bucket.loss.toFixed(1)}% ${bucket.lost}/${bucket.total}`;
}

function clampFraction(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function getTrafficRadarLimit(rate: TrafficRateDisplay) {
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

function scalePercent(value: number, min: number, max: number, inputMax = 100) {
  const clamped = Math.max(0, Math.min(inputMax, value));
  return min + (max - min) * (clamped / inputMax);
}

function scaleBoostedPercent(value: number, min: number, maxAt100: number, maxAt200: number) {
  const clamped = Math.max(0, Math.min(200, value));
  if (clamped <= 100) {
    return min + (maxAt100 - min) * (clamped / 100);
  }
  return maxAt100 + (maxAt200 - maxAt100) * ((clamped - 100) / 100);
}

function dashboardMotionStyle(value: number, transitionMin: number, transitionMax: number) {
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

function dashboardGaugePreset(
  variant: Exclude<DashboardStylePresetId, "bars">,
  settings: DashboardSettings,
): GaugeStylePresetId {
  return settings[variant].gaugeStyle;
}

function getSegmentTrackStyle(gaugeStyle: GaugeStylePresetId) {
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

function getSegmentTickStyle(gaugeStyle: GaugeStylePresetId) {
  if (gaugeStyle === "pulse") {
    return { strokeDasharray: "0.8 3.35" } as CSSProperties;
  }
  if (gaugeStyle === "scan") {
    return { strokeDasharray: "1 6.2" } as CSSProperties;
  }
  if (gaugeStyle !== "segmented") return undefined;
  return { strokeDasharray: "1 7.35" } as CSSProperties;
}

function getProgressStyle(percent: number, gaugeStyle: GaugeStylePresetId) {
  if (gaugeStyle === "fragment") {
    return { strokeDasharray: `${Math.max(0, percent - 1)} 1 0 100` } as CSSProperties;
  }
  if (gaugeStyle === "scan") {
    return { strokeDasharray: `${Math.max(0, percent - 4)} 1 3 100` } as CSSProperties;
  }
  return { strokeDasharray: `${percent} 100` } as CSSProperties;
}

function getGlowStyle(percent: number, gaugeStyle: GaugeStylePresetId) {
  if (gaugeStyle === "scan") {
    return { strokeDasharray: `${Math.max(0, percent - 12)} 3 9 100` } as CSSProperties;
  }
  return { strokeDasharray: `${percent} 100` } as CSSProperties;
}

function ringPoint(percent: number, radius = 38) {
  const angle = (percent * 3.6 * Math.PI) / 180;
  return {
    x: 50 + radius * Math.cos(angle),
    y: 50 + radius * Math.sin(angle),
  };
}

function arcPoint(percent: number, radius = 46) {
  const angle = ((180 - percent * 1.8) * Math.PI) / 180;
  return {
    x: 60 + radius * Math.cos(angle),
    y: 58 - radius * Math.sin(angle),
  };
}

function gaugeHeadPoint(
  variant: Exclude<DashboardStylePresetId, "bars">,
  percent: number,
  radius?: number,
) {
  return variant === "ring" ? ringPoint(percent, radius) : arcPoint(percent, radius);
}

function renderRingCircle(className: string, radius: number, style?: CSSProperties) {
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

function renderArcPath(className: string, style?: CSSProperties) {
  return (
    <path
      className={className}
      d="M 14 58 A 46 46 0 0 1 106 58"
      pathLength={100}
      style={style}
    />
  );
}

function renderGaugePath(
  variant: Exclude<DashboardStylePresetId, "bars">,
  className: string,
  style?: CSSProperties,
  radius = 38,
) {
  return variant === "ring"
    ? renderRingCircle(className, radius, style)
    : renderArcPath(className, style);
}

function renderGaugeBackArt(
  variant: Exclude<DashboardStylePresetId, "bars">,
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
          strokeDasharray: `10 3 7 4 ${Math.max(0, percent - 24)} 100`,
          strokeDashoffset: `${100 - percent}`,
        })}
      </>
    );
  }

  return null;
}

function renderCircuitArt(
  variant: Exclude<DashboardStylePresetId, "bars">,
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

function renderWaveArt(
  variant: Exclude<DashboardStylePresetId, "bars">,
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

function renderGaugeFrontArt(
  variant: Exclude<DashboardStylePresetId, "bars">,
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

function scalePercentLegacy(value: number, min: number, max: number) {
  return scalePercent(value, min, max);
}

function dashboardGaugeStyle(
  variant: Exclude<DashboardStylePresetId, "bars">,
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

export const NodeCard = memo(function NodeCard({
  uuid,
  visualRedrawKey,
  dashboardStyle,
  dashboardSettings,
  radarLatencyMaxMs,
  marqueeStyle,
}: {
  uuid: string;
  visualRedrawKey: string;
  dashboardStyle: DashboardStylePresetId;
  dashboardSettings: DashboardSettings;
  radarLatencyMaxMs: number;
  marqueeStyle: MarqueeStyleSettings;
}) {
  const { resolvedAppearance } = usePreferences();
  const node = useNode(uuid);
  const trafficTrend = useNodeTrafficTrend(uuid);
  const ping = usePingMini(uuid);
  const pingBuckets = usePingMiniBuckets(ping);
  const [hoveredLatencyIndex, setHoveredLatencyIndex] = useState<number | null>(null);
  const [hoveredLossIndex, setHoveredLossIndex] = useState<number | null>(null);
  const hoveredLatencyBucket =
    hoveredLatencyIndex != null ? (pingBuckets[hoveredLatencyIndex] ?? null) : null;
  const hoveredLossBucket =
    hoveredLossIndex != null ? (pingBuckets[hoveredLossIndex] ?? null) : null;
  const latencyHoverTime = formatBucketWindow(hoveredLatencyBucket);
  const lossHoverTime = formatBucketWindow(hoveredLossBucket);

  if (!node) {
    return (
      <div
        className="server-card animate-pulse"
        style={{ minHeight: 438 }}
        aria-busy
      />
    );
  }

  const tags = parseTags(node.tags);
  const footerTags =
    tags.length > 0
      ? tags
      : node.group
        ? [{ label: node.group, color: "gray" }]
        : [];
  const expire = formatExpireDays(node.expired_at);
  const uptime = formatUptimeDays(node.uptime);
  const subtitle =
    buildSubtitle([node.group, node.public_remark]) ||
    buildSubtitle([node.os, node.arch, node.virtualization]);
  const metricRedrawKey = `${resolvedAppearance}:${visualRedrawKey}`;
  const latencyTone = ping.lastValue != null
    ? "var(--ys-metric-latency, var(--status-online))"
    : "var(--text-tertiary)";
  const lossTone = ping.loss != null
    ? "var(--ys-metric-loss, var(--status-offline))"
    : "var(--text-tertiary)";
  const latencyHoverColor = hoveredLatencyBucket?.value != null
    ? latencyTone
    : "var(--text-tertiary)";
  const loadBaseline = node.cpu_cores > 0 ? node.cpu_cores : 4;
  const loadFraction = Math.max(0, Math.min(1, node.load1 / loadBaseline));
  const upRate = formatTrafficRate(node.netUp);
  const downRate = formatTrafficRate(node.netDown);
  const lossHoverColor = hoveredLossBucket ? lossTone : null;
  const hasHomepagePingBinding = ping.isAssigned;
  const isOnline = node.online === true;
  const isOffline = node.online === false;
  const gaugeDashboardStyle = dashboardStyle === "bars" ? null : dashboardStyle;
  const offlineFor = isOffline ? formatOfflineDuration(node.updatedAt) : null;

  return (
    <article
      className={clsx(
        "server-card",
        isOffline && "is-offline",
        gaugeDashboardStyle && "is-dashboard-card",
        gaugeDashboardStyle && `is-${gaugeDashboardStyle}-dashboard`,
      )}
      data-appearance={resolvedAppearance}
      data-dashboard-style={dashboardStyle}
    >
      {isOffline && (
        <div className="offline-mask">
          <span className="offline-badge" title={offlineFor?.full}>
            <Power size={14} strokeWidth={2.2} />
            <span className="offline-badge-copy">
              <span>离线</span>
              <span className="offline-badge-time">
                {offlineFor?.value}
                {offlineFor?.unit ? ` ${offlineFor.unit}` : ""}
              </span>
            </span>
          </span>
        </div>
      )}

      <div className="server-card-content">
        <header className="server-card-header">
          <div className="server-card-title-block">
            <div className="server-card-title-row">
              <Flag region={node.region} size={15} />
              <Link
                to={`/instance/${node.uuid}`}
                className="server-card-title-link"
                title={node.name}
              >
                {node.name}
              </Link>
              <span
                className={clsx("server-card-online-dot", isOffline && "is-offline")}
                style={{
                  background:
                    node.online == null
                      ? "var(--text-tertiary)"
                      : isOnline
                        ? "var(--status-online)"
                        : "var(--status-offline)",
                  boxShadow: `0 0 0 3px color-mix(in srgb, ${
                    node.online == null
                      ? "var(--text-tertiary)"
                      : isOnline
                        ? "var(--status-online)"
                        : "var(--status-offline)"
                  } 20%, transparent)`,
                }}
                title={node.online == null ? "状态同步中" : isOnline ? "在线" : "离线"}
              />
            </div>
            {subtitle && (
              <p className="server-card-subtitle" title={subtitle}>
                {subtitle}
              </p>
            )}
          </div>
          <Link
            to={`/instance/${node.uuid}`}
            className="server-card-detail-link"
            title="查看详情"
          >
            <ExternalLink size={15} strokeWidth={2} />
          </Link>
        </header>

        {gaugeDashboardStyle ? (
          <RadarMetricPanel
            variant={gaugeDashboardStyle}
            settings={dashboardSettings}
            cpuPct={node.cpuPct}
            cpuCores={node.cpu_cores}
            ramPct={node.ramPct}
            ramUsed={node.ramUsed}
            ramTotal={node.ramTotal}
            diskPct={node.diskPct}
            diskUsed={node.diskUsed}
            diskTotal={node.diskTotal}
            loadValue={node.load1}
            loadFraction={loadFraction}
            upRate={upRate}
            downRate={downRate}
            latency={ping.lastValue}
            latencyMaxMs={radarLatencyMaxMs}
            loss={ping.loss}
            hasHomepagePingBinding={hasHomepagePingBinding}
          />
        ) : (
          <div className="server-card-stack">
            <div className="card-metric-section server-metric-grid">
              <MetricBar
                icon={<Cpu size={13} strokeWidth={2} />}
                label="CPU"
                valueText={node.cpuPct.toFixed(2)}
                unit="%"
                detailText={`${node.cpu_cores || 0} 核`}
                fraction={node.cpuPct / 100}
                redrawKey={metricRedrawKey}
                paint={{ kind: "solid", color: "var(--ys-metric-cpu, var(--progress-cpu))" }}
                marqueeStyle={marqueeStyle}
              />
              <MetricBar
                icon={<MemoryStick size={13} strokeWidth={2} />}
                label="内存"
                valueText={node.ramPct.toFixed(2)}
                unit="%"
                detailText={`${formatBytes(node.ramUsed)} / ${formatBytes(node.ramTotal)}`}
                fraction={node.ramPct / 100}
                redrawKey={metricRedrawKey}
                paint={{ kind: "solid", color: "var(--ys-metric-memory, var(--progress-memory))" }}
                marqueeStyle={marqueeStyle}
              />
              <MetricBar
                icon={<HardDrive size={13} strokeWidth={2} />}
                label="磁盘"
                valueText={node.diskPct.toFixed(1)}
                unit="%"
                detailText={`${formatBytes(node.diskUsed)} / ${formatBytes(node.diskTotal)}`}
                fraction={node.diskPct / 100}
                redrawKey={metricRedrawKey}
                paint={{ kind: "solid", color: "var(--ys-metric-disk, var(--progress-disk))" }}
                marqueeStyle={marqueeStyle}
              />
              <MetricBar
                icon={<Gauge size={13} strokeWidth={2} />}
                label="负载"
                valueText={node.load1.toFixed(2)}
                fraction={loadFraction}
                redrawKey={metricRedrawKey}
                paint={{
                  kind: "gradient",
                  from: "var(--ys-metric-load, var(--progress-cpu))",
                  to: "var(--ys-metric-memory, var(--progress-memory))",
                }}
                marqueeStyle={marqueeStyle}
              />
            </div>

            <div className="card-metric-section server-traffic-section">
              <TrafficStat
                direction="上行"
                totalLabel="出站"
                rate={upRate}
                total={formatBytes(node.trafficUp)}
                samples={trafficTrend.up}
                live={isOnline}
                redrawKey={metricRedrawKey}
                color="var(--ys-marquee-up, var(--progress-cpu))"
                marqueeStyle={marqueeStyle}
                icon={<ArrowUp size={15} strokeWidth={2.4} />}
              />
              <TrafficStat
                direction="下行"
                totalLabel="入站"
                rate={downRate}
                total={formatBytes(node.trafficDown)}
                samples={trafficTrend.down}
                live={isOnline}
                redrawKey={metricRedrawKey}
                color="var(--ys-marquee-down, var(--status-success))"
                marqueeStyle={marqueeStyle}
                icon={<ArrowDown size={15} strokeWidth={2.4} />}
              />
            </div>

            <div className="card-metric-section card-metric-divided server-health-grid">
              <div className="server-health-block">
                <div className="server-health-head">
                  <div className="server-health-label">
                    <Clock3 size={13} strokeWidth={2} />
                    <span>延迟</span>
                  </div>
                  <span className="server-health-value tabular" style={{ color: latencyTone }}>
                    {ping.lastValue != null ? (
                      <>
                        {Math.round(ping.lastValue)}
                        <span className="server-health-unit">ms</span>
                      </>
                    ) : (
                      <span
                        className="server-health-empty"
                        title={hasHomepagePingBinding ? "暂无有效样本" : "未配置首页 Ping"}
                      >
                        {hasHomepagePingBinding ? "无样本" : "未配置"}
                      </span>
                    )}
                  </span>
                </div>
                <div className="server-health-chart-wrap">
                  {hasHomepagePingBinding ? (
                    <MiniBars
                      values={ping.values}
                      max={ping.max}
                      lastValue={ping.lastValue ?? undefined}
                      buckets={pingBuckets}
                      color="var(--ys-metric-latency, var(--status-online))"
                      marqueeStyle={marqueeStyle}
                      redrawKey={metricRedrawKey}
                      onHoverIndex={setHoveredLatencyIndex}
                    />
                  ) : (
                    <div className="server-health-placeholder">未配置首页 Ping</div>
                  )}
                  {latencyHoverTime && hoveredLatencyBucket && (
                    <div className="server-health-tooltip">
                      <div className="instance-chart-tooltip-time">{latencyHoverTime}</div>
                      <div className="instance-chart-tooltip-row">
                        <span className="instance-chart-tooltip-dot" style={{ background: latencyHoverColor }} />
                        <span>延迟</span>
                        <strong>{formatLatencyBucketSummary(hoveredLatencyBucket)}</strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="server-health-block">
                <div className="server-health-head">
                  <div className="server-health-label">
                    <Unplug size={13} strokeWidth={2} />
                    <span>丢包率</span>
                  </div>
                  <span className="server-health-value tabular" style={{ color: lossTone }}>
                    {ping.loss != null ? (
                      <>
                        {ping.loss.toFixed(1)}
                        <span className="server-health-unit">%</span>
                      </>
                    ) : (
                      <span
                        className="server-health-empty"
                        title={hasHomepagePingBinding ? "暂无有效样本" : "未配置首页 Ping"}
                      >
                        {hasHomepagePingBinding ? "无样本" : "未配置"}
                      </span>
                    )}
                  </span>
                </div>
                <div className="server-health-chart-wrap">
                  {hasHomepagePingBinding ? (
                    <QualityBars
                      value={ping.loss}
                      buckets={pingBuckets}
                      color="var(--ys-metric-loss, var(--status-offline))"
                      marqueeStyle={marqueeStyle}
                      redrawKey={metricRedrawKey}
                      onHoverIndex={setHoveredLossIndex}
                    />
                  ) : (
                    <div className="server-health-placeholder">未配置首页 Ping</div>
                  )}
                  {lossHoverTime && hoveredLossBucket && (
                    <div className="server-health-tooltip">
                      <div className="instance-chart-tooltip-time">{lossHoverTime}</div>
                      <div className="instance-chart-tooltip-row">
                        <span className="instance-chart-tooltip-dot" style={{ background: lossHoverColor ?? lossTone }} />
                        <span>丢包率</span>
                        <strong>{formatLossBucketSummary(hoveredLossBucket)}</strong>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="server-card-footer">
          <div className="server-card-meta-grid">
            <FooterStat
              icon={<Calendar size={13} strokeWidth={2} />}
              label="到期"
              value={expire.value}
              unit={expire.unit}
              color={getExpireTextColor(node.expired_at)}
            />
            <FooterStat
              icon={<RefreshCw size={13} strokeWidth={2} />}
              label="在线"
              value={uptime.value}
              unit={uptime.unit}
              color="var(--progress-cpu)"
            />
          </div>
          {footerTags.length > 0 && (
            <div className="dstatus-tags-row">
              {footerTags.slice(0, 6).map((tag, i) => (
                <span
                  key={`${tag.label}-${i}`}
                  data-tag={tag.color}
                  className="dstatus-tag-chip"
                  style={{
                    background: "var(--tag-bg)",
                    color: "var(--tag-fg)",
                  }}
                  title={tag.label}
                >
                  {tag.label}
                </span>
              ))}
              {footerTags.length > 6 && (
                <span className="dstatus-tag-more">+{footerTags.length - 6}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  );
});

function RadarMetricPanel({
  variant,
  settings,
  cpuPct,
  cpuCores,
  ramPct,
  ramUsed,
  ramTotal,
  diskPct,
  diskUsed,
  diskTotal,
  loadValue,
  loadFraction,
  upRate,
  downRate,
  latency,
  latencyMaxMs,
  loss,
  hasHomepagePingBinding,
}: {
  variant: Exclude<DashboardStylePresetId, "bars">;
  settings: DashboardSettings;
  cpuPct: number;
  cpuCores: number;
  ramPct: number;
  ramUsed: number;
  ramTotal: number;
  diskPct: number;
  diskUsed: number;
  diskTotal: number;
  loadValue: number;
  loadFraction: number;
  upRate: TrafficRateDisplay;
  downRate: TrafficRateDisplay;
  latency: number | null;
  latencyMaxMs: number;
  loss: number | null;
  hasHomepagePingBinding: boolean;
}) {
  const upLimit = getTrafficRadarLimit(upRate);
  const downLimit = getTrafficRadarLimit(downRate);
  const safeLatencyMax = Math.max(100, latencyMaxMs);
  const gaugeStyle = dashboardGaugePreset(variant, settings);

  return (
    <div
      className="radar-metric-grid"
      aria-label="仪表信息展板"
      data-dashboard-variant={variant}
      data-gauge-style={gaugeStyle}
      style={dashboardGaugeStyle(variant, settings)}
    >
      <RadarGauge
        variant={variant}
        gaugeStyle={gaugeStyle}
        icon={<Cpu size={13} strokeWidth={2} />}
        label="CPU"
        valueText={cpuPct.toFixed(0)}
        unit="%"
        fraction={cpuPct / 100}
        color="var(--ys-metric-cpu, var(--progress-cpu))"
        detailText={`${cpuCores || 0} 核`}
      />
      <RadarGauge
        variant={variant}
        gaugeStyle={gaugeStyle}
        icon={<MemoryStick size={13} strokeWidth={2} />}
        label="内存"
        valueText={ramPct.toFixed(0)}
        unit="%"
        fraction={ramPct / 100}
        color="var(--ys-metric-memory, var(--progress-memory))"
        detailText={`${formatBytes(ramUsed)} / ${formatBytes(ramTotal)}`}
      />
      <RadarGauge
        variant={variant}
        gaugeStyle={gaugeStyle}
        icon={<HardDrive size={13} strokeWidth={2} />}
        label="磁盘"
        valueText={diskPct.toFixed(0)}
        unit="%"
        fraction={diskPct / 100}
        color="var(--ys-metric-disk, var(--progress-disk))"
        detailText={`${formatBytes(diskUsed)} / ${formatBytes(diskTotal)}`}
      />
      <RadarGauge
        variant={variant}
        gaugeStyle={gaugeStyle}
        icon={<Gauge size={13} strokeWidth={2} />}
        label="负载"
        valueText={loadValue.toFixed(2)}
        fraction={loadFraction}
        color="var(--ys-metric-load, var(--progress-cpu))"
      />
      <RadarGauge
        variant={variant}
        gaugeStyle={gaugeStyle}
        icon={<ArrowUp size={13} strokeWidth={2.4} />}
        label="上行"
        valueText={upRate.value}
        unit={upRate.unit}
        fraction={upRate.bitsPerSec / upLimit.bitsPerSec}
        color="var(--ys-marquee-up, var(--progress-cpu))"
        limitLabel={`上限 ${upLimit.label}`}
      />
      <RadarGauge
        variant={variant}
        gaugeStyle={gaugeStyle}
        icon={<ArrowDown size={13} strokeWidth={2.4} />}
        label="下行"
        valueText={downRate.value}
        unit={downRate.unit}
        fraction={downRate.bitsPerSec / downLimit.bitsPerSec}
        color="var(--ys-marquee-down, var(--status-success))"
        limitLabel={`上限 ${downLimit.label}`}
      />
      <RadarGauge
        variant={variant}
        gaugeStyle={gaugeStyle}
        icon={<Clock3 size={13} strokeWidth={2} />}
        label="延迟"
        valueText={latency != null ? String(Math.round(latency)) : hasHomepagePingBinding ? "—" : "未配"}
        unit={latency != null ? "ms" : undefined}
        fraction={latency != null ? latency / safeLatencyMax : 0}
        color="var(--ys-metric-latency, var(--status-online))"
        limitLabel={`${safeLatencyMax}ms`}
        empty={latency == null}
      />
      <RadarGauge
        variant={variant}
        gaugeStyle={gaugeStyle}
        icon={<Unplug size={13} strokeWidth={2} />}
        label="丢包"
        valueText={loss != null ? loss.toFixed(1) : hasHomepagePingBinding ? "—" : "未配"}
        unit={loss != null ? "%" : undefined}
        fraction={loss != null ? loss / 100 : 0}
        color="var(--ys-metric-loss, var(--status-offline))"
        limitLabel="100%"
        empty={loss == null}
      />
    </div>
  );
}

function RadarGauge({
  variant,
  gaugeStyle,
  icon,
  label,
  valueText,
  unit,
  fraction,
  color,
  limitLabel = "100%",
  detailText,
  empty = false,
}: {
  variant: Exclude<DashboardStylePresetId, "bars">;
  gaugeStyle: GaugeStylePresetId;
  icon: ReactNode;
  label: string;
  valueText: string;
  unit?: string;
  fraction: number;
  color: string;
  limitLabel?: string;
  detailText?: string;
  empty?: boolean;
}) {
  const percent = Math.round(clampFraction(fraction) * 100);
  const realValue = detailText ?? `${valueText}${unit ? ` ${unit}` : ""}`;
  const title = `${label} ${realValue} · ${percent}% · ${limitLabel}`;
  const needleAngle = -90 + percent * 1.8;
  const progressStyle = getProgressStyle(percent, gaugeStyle);
  const glowStyle = getGlowStyle(percent, gaugeStyle);
  const segmentTrackStyle = getSegmentTrackStyle(gaugeStyle);
  const segmentTickStyle = getSegmentTickStyle(gaugeStyle);

  return (
    <div
      className={clsx("radar-gauge", empty && "is-empty")}
      data-variant={variant}
      data-gauge-style={gaugeStyle}
      style={
        {
          "--radar-color": color,
          "--radar-percent": percent,
          "--radar-needle-angle": `${needleAngle}deg`,
        } as CSSProperties
      }
      title={title}
    >
      <div className="radar-gauge-head">
        <span className="radar-gauge-icon">{icon}</span>
        <span>{label}</span>
      </div>
      {variant === "ring" ? (
        <svg className="radar-gauge-svg is-ring" viewBox="0 0 100 100" aria-hidden>
          <circle
            className="radar-gauge-track"
            cx="50"
            cy="50"
            r="38"
            pathLength={100}
            style={segmentTrackStyle}
          />
          {segmentTickStyle && (
            <circle
              className="radar-gauge-segment-ticks"
              cx="50"
              cy="50"
              r="38"
              pathLength={100}
              style={segmentTickStyle}
            />
          )}
          {renderGaugeBackArt(variant, gaugeStyle, percent)}
          <circle
            className="radar-gauge-fill"
            cx="50"
            cy="50"
            r="38"
            pathLength={100}
            style={progressStyle}
          />
          <circle
            className="radar-gauge-glow"
            cx="50"
            cy="50"
            r="38"
            pathLength={100}
            style={glowStyle}
          />
          {renderGaugeFrontArt(variant, gaugeStyle, percent)}
        </svg>
      ) : (
        <svg className="radar-gauge-svg" viewBox="0 0 120 72" aria-hidden>
          <path
            className="radar-gauge-track"
            d="M 14 58 A 46 46 0 0 1 106 58"
            pathLength={100}
            style={segmentTrackStyle}
          />
          {segmentTickStyle && (
            <path
              className="radar-gauge-segment-ticks"
              d="M 14 58 A 46 46 0 0 1 106 58"
              pathLength={100}
              style={segmentTickStyle}
            />
          )}
          {renderGaugeBackArt(variant, gaugeStyle, percent)}
          <path
            className="radar-gauge-fill"
            d="M 14 58 A 46 46 0 0 1 106 58"
            pathLength={100}
            style={progressStyle}
          />
          <path
            className="radar-gauge-glow"
            d="M 14 58 A 46 46 0 0 1 106 58"
            pathLength={100}
            style={glowStyle}
          />
          {renderGaugeFrontArt(variant, gaugeStyle, percent)}
          {variant === "dial" && (
            <>
              <g className="radar-gauge-ticks">
                <line x1="22" y1="58" x2="30" y2="52" />
                <line x1="36" y1="34" x2="42" y2="41" />
                <line x1="60" y1="18" x2="60" y2="28" />
                <line x1="84" y1="34" x2="78" y2="41" />
                <line x1="98" y1="58" x2="90" y2="52" />
              </g>
              <line
                className="radar-gauge-needle"
                x1="60"
                y1="58"
                x2="60"
                y2="22"
              />
              <circle className="radar-gauge-pivot" cx="60" cy="58" r="4.3" />
            </>
          )}
        </svg>
      )}
      <div className="radar-gauge-value tabular">
        <span>{percent}</span>
        <span className="radar-gauge-unit">%</span>
      </div>
      <div className="radar-gauge-foot">
        <span>{realValue}</span>
      </div>
    </div>
  );
}

function TrafficStat({
  direction,
  totalLabel,
  rate,
  total,
  samples,
  live,
  redrawKey,
  color,
  marqueeStyle,
  icon,
}: {
  direction: "下行" | "上行";
  totalLabel: "入站" | "出站";
  rate: TrafficRateDisplay;
  total: string;
  samples: TrafficTrendSample[];
  live: boolean;
  redrawKey: string;
  color: string;
  marqueeStyle: MarqueeStyleSettings;
  icon: ReactNode;
}) {
  return (
    <div className="traffic-stat">
      <div className="traffic-stat-head">
        <div className="traffic-stat-label" style={{ color }}>
          {icon}
          <span>{direction}</span>
        </div>
        <span className="traffic-stat-value tabular" style={{ color }}>
          {rate.value}
          <span className="traffic-stat-unit">{rate.unit}</span>
        </span>
      </div>
      <div className="traffic-stat-trend" aria-hidden>
        <TrafficDotStrip
          samples={samples}
          color={color}
          marqueeStyle={marqueeStyle}
          redrawKey={redrawKey}
        />
        <span className="traffic-stat-live" data-live={live ? "true" : "false"}>
          <span
            className="traffic-stat-live-dot"
            style={{
              background: color,
            }}
          />
          <span>{live ? (rate.bitsPerSec > 0 ? "实时" : "空闲") : "离线"}</span>
        </span>
      </div>
      <div className="traffic-stat-foot">
        <div className="traffic-stat-total-label">
          <GlobeArrow direction={totalLabel} color={color} />
          <span>{totalLabel}</span>
        </div>
        <span className="tabular">{total}</span>
      </div>
    </div>
  );
}

function TrafficDotStrip({
  samples,
  color,
  marqueeStyle,
  redrawKey,
}: {
  samples: TrafficTrendSample[];
  color: string;
  marqueeStyle: MarqueeStyleSettings;
  redrawKey: string;
}) {
  const points = samples.map((sample) => {
    const active = sample.value > 0;
    return {
      active,
      level: active ? Math.max(0.08, Math.min(1, sample.level)) : 0.16,
      opacity: active ? Math.min(1, sample.opacity + 0.05) : 0.46,
    };
  });

  return (
    <CanvasStrip
      className="traffic-dot-strip"
      height={10}
      ariaHidden
      redrawKey={redrawKey}
      animated={shouldAnimateMarqueeStyle(marqueeStyle)}
      frameIntervalMs={getMarqueeFrameInterval(marqueeStyle)}
      draw={(ctx, width, height, now) =>
        drawMarqueeStrip(ctx, width, height, {
          points,
          style: marqueeStyle,
          variant: "trend",
          now,
          colors: {
            base: color,
            accent: "var(--ys-marquee-peak, white)",
            inactive: "var(--ys-marquee-idle, var(--progress-bg))",
          },
        })
      }
    />
  );
}

function GlobeArrow({
  direction,
  color,
}: {
  direction: "入站" | "出站";
  color: string;
}) {
  const isInbound = direction === "入站";
  return (
    <span
      className="relative inline-flex items-center justify-center"
      style={{
        width: 18,
        height: 18,
        color,
      }}
      aria-hidden
    >
      <Globe size={15} strokeWidth={1.9} />
      {isInbound ? (
        <ArrowDown
          size={9}
          strokeWidth={2.4}
          className="absolute -right-[2px] bottom-[-1px]"
        />
      ) : (
        <ArrowUp
          size={9}
          strokeWidth={2.4}
          className="absolute -right-[2px] bottom-[-1px]"
        />
      )}
    </span>
  );
}

function FooterStat({
  icon,
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit?: string;
  color: string;
  icon: ReactNode;
}) {
  return (
    <div className="server-card-meta">
      <div className="server-card-meta-label">
        {icon}
        <span>{label}</span>
      </div>
      <span className="server-card-meta-value tabular" style={{ color }}>
        {value}
        {unit && <span className="server-card-meta-unit">{unit}</span>}
      </span>
    </div>
  );
}
