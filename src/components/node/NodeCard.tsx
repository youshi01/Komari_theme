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
import type { CardStylePresetId, MarqueeStyleSettings } from "@/hooks/useVisualStyle";

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

export const NodeCard = memo(function NodeCard({
  uuid,
  visualRedrawKey,
  cardStyle,
  radarLatencyMaxMs,
  marqueeStyle,
}: {
  uuid: string;
  visualRedrawKey: string;
  cardStyle: CardStylePresetId;
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
  const useRadarLayout = cardStyle === "radar";
  const offlineFor = isOffline ? formatOfflineDuration(node.updatedAt) : null;

  return (
    <article
      className={clsx(
        "server-card",
        isOffline && "is-offline",
        useRadarLayout && "is-radar-card",
      )}
      data-appearance={resolvedAppearance}
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

        {useRadarLayout ? (
          <RadarMetricPanel
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

  return (
    <div className="radar-metric-grid" aria-label="3号雷达信息展板">
      <RadarGauge
        icon={<Cpu size={13} strokeWidth={2} />}
        label="CPU"
        valueText={cpuPct.toFixed(0)}
        unit="%"
        fraction={cpuPct / 100}
        color="var(--ys-metric-cpu, var(--progress-cpu))"
        detailText={`${cpuCores || 0} 核`}
      />
      <RadarGauge
        icon={<MemoryStick size={13} strokeWidth={2} />}
        label="内存"
        valueText={ramPct.toFixed(0)}
        unit="%"
        fraction={ramPct / 100}
        color="var(--ys-metric-memory, var(--progress-memory))"
        detailText={`${formatBytes(ramUsed)} / ${formatBytes(ramTotal)}`}
      />
      <RadarGauge
        icon={<HardDrive size={13} strokeWidth={2} />}
        label="磁盘"
        valueText={diskPct.toFixed(0)}
        unit="%"
        fraction={diskPct / 100}
        color="var(--ys-metric-disk, var(--progress-disk))"
        detailText={`${formatBytes(diskUsed)} / ${formatBytes(diskTotal)}`}
      />
      <RadarGauge
        icon={<Gauge size={13} strokeWidth={2} />}
        label="负载"
        valueText={loadValue.toFixed(2)}
        fraction={loadFraction}
        color="var(--ys-metric-load, var(--progress-cpu))"
      />
      <RadarGauge
        icon={<ArrowUp size={13} strokeWidth={2.4} />}
        label="上行"
        valueText={upRate.value}
        unit={upRate.unit}
        fraction={upRate.bitsPerSec / upLimit.bitsPerSec}
        color="var(--ys-marquee-up, var(--progress-cpu))"
        limitLabel={`上限 ${upLimit.label}`}
      />
      <RadarGauge
        icon={<ArrowDown size={13} strokeWidth={2.4} />}
        label="下行"
        valueText={downRate.value}
        unit={downRate.unit}
        fraction={downRate.bitsPerSec / downLimit.bitsPerSec}
        color="var(--ys-marquee-down, var(--status-success))"
        limitLabel={`上限 ${downLimit.label}`}
      />
      <RadarGauge
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

  return (
    <div
      className={clsx("radar-gauge", empty && "is-empty")}
      style={
        {
          "--radar-color": color,
          "--radar-percent": percent,
        } as CSSProperties
      }
      title={title}
    >
      <div className="radar-gauge-head">
        <span className="radar-gauge-icon">{icon}</span>
        <span>{label}</span>
      </div>
      <svg className="radar-gauge-svg" viewBox="0 0 120 72" aria-hidden>
        <path
          className="radar-gauge-track"
          d="M 14 58 A 46 46 0 0 1 106 58"
          pathLength={100}
        />
        <path
          className="radar-gauge-fill"
          d="M 14 58 A 46 46 0 0 1 106 58"
          pathLength={100}
          style={{ strokeDasharray: `${percent} 100` }}
        />
        <path
          className="radar-gauge-glow"
          d="M 14 58 A 46 46 0 0 1 106 58"
          pathLength={100}
          style={{ strokeDasharray: `${percent} 100` }}
        />
      </svg>
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
