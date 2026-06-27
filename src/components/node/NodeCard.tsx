import {
  memo,
  useCallback,
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
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
import type { TrafficTrendSample } from "@/types/komari";
import type { TrafficRateDisplay } from "@/utils/format";
import type {
  CardLayoutId,
  DashboardSettings,
  DashboardStylePresetId,
  GaugeStylePresetId,
  LiquidDashboardSettings,
  LiquidShapeId,
  MarqueeStyleSettings,
} from "@/hooks/useVisualStyle";

import {
  buildSubtitle,
  clampFraction,
  dashboardGaugePreset,
  dashboardGaugeStyle,
  formatBucketWindow,
  formatLatencyBucketSummary,
  formatLossBucketSummary,
  getGlowStyle,
  getLiquidMotionMs,
  getProgressStyle,
  getRadarScanDelay,
  getSegmentTickStyle,
  getSegmentTrackStyle,
  getTrafficRadarLimit,
  liquidDashboardStyle,
  renderGaugeBackArt,
  renderGaugeFrontArt,
  scalePercentLegacy,
  type GaugeDashboardStyleId,
} from "./dashboardHelpers";

export const NodeCard = memo(function NodeCard({
  uuid,
  cardLayout,
  visualRedrawKey,
  dashboardStyle,
  dashboardSettings,
  radarLatencyMaxMs,
  marqueeStyle,
}: {
  uuid: string;
  cardLayout: CardLayoutId;
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
        className={clsx("server-card animate-pulse", cardLayout === "strip" && "is-strip-card")}
        style={{ minHeight: cardLayout === "strip" ? 102 : 438 }}
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
  const trafficQuota = getTrafficQuotaSummary({
    up: node.trafficUp,
    down: node.trafficDown,
    limit: node.traffic_limit,
    type: node.traffic_limit_type,
  });
  const lossHoverColor = hoveredLossBucket ? lossTone : null;
  const hasHomepagePingBinding = ping.isAssigned;
  const isOnline = node.online === true;
  const isOffline = node.online === false;
  const statusColor =
    node.online == null
      ? "var(--text-tertiary)"
      : isOnline
        ? "var(--status-online)"
        : "var(--status-offline)";
  const statusTitle = node.online == null ? "状态同步中" : isOnline ? "在线" : "离线";
  const gaugeDashboardStyle: GaugeDashboardStyleId | null =
    dashboardStyle === "arc" || dashboardStyle === "ring" || dashboardStyle === "dial"
      ? dashboardStyle
      : null;
  const isDashboardCard = dashboardStyle !== "bars";
  const offlineFor = isOffline ? formatOfflineDuration(node.updatedAt) : null;

  if (cardLayout === "strip") {
    const latencyText =
      ping.lastValue != null
        ? `${Math.round(ping.lastValue)}ms`
        : hasHomepagePingBinding
          ? "无样本"
          : "未配置";
    const lossText =
      ping.loss != null
        ? `${ping.loss.toFixed(1)}%`
        : hasHomepagePingBinding
          ? "无样本"
          : "未配置";

    return (
      <article
        className={clsx("server-card is-strip-card", isOffline && "is-offline")}
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

        <div className="server-card-content strip-card-content">
          <div className="strip-card-identity">
            <div className="strip-card-title-row">
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
                  background: statusColor,
                  boxShadow: `0 0 0 3px color-mix(in srgb, ${statusColor} 20%, transparent)`,
                }}
                title={statusTitle}
              />
              <Link
                to={`/instance/${node.uuid}`}
                className="server-card-detail-link"
                title="查看详情"
              >
                <ExternalLink size={14} strokeWidth={2} />
              </Link>
            </div>
            {subtitle && (
              <p className="server-card-subtitle" title={subtitle}>
                {subtitle}
              </p>
            )}
            {footerTags.length > 0 && (
              <div className="dstatus-tags-row strip-card-tags">
                {footerTags.slice(0, 3).map((tag, i) => (
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
                {footerTags.length > 3 && (
                  <span className="dstatus-tag-more">+{footerTags.length - 3}</span>
                )}
              </div>
            )}
          </div>

          <div className="strip-card-metrics" aria-label="核心指标">
            <StripMetric
              icon={<Cpu size={12} strokeWidth={2} />}
              label="CPU"
              value={node.cpuPct.toFixed(0)}
              unit="%"
              detail={`${node.cpu_cores || 0} 核`}
              fraction={node.cpuPct / 100}
              color="var(--ys-metric-cpu, var(--progress-cpu))"
            />
            <StripMetric
              icon={<MemoryStick size={12} strokeWidth={2} />}
              label="内存"
              value={node.ramPct.toFixed(0)}
              unit="%"
              detail={`${formatBytes(node.ramUsed)} / ${formatBytes(node.ramTotal)}`}
              fraction={node.ramPct / 100}
              color="var(--ys-metric-memory, var(--progress-memory))"
            />
            <StripMetric
              icon={<HardDrive size={12} strokeWidth={2} />}
              label="硬盘"
              value={node.diskPct.toFixed(0)}
              unit="%"
              detail={`${formatBytes(node.diskUsed)} / ${formatBytes(node.diskTotal)}`}
              fraction={node.diskPct / 100}
              color="var(--ys-metric-disk, var(--progress-disk))"
            />
            <StripMetric
              icon={<Gauge size={12} strokeWidth={2} />}
              label="负载"
              value={node.load1.toFixed(2)}
              detail={`${node.load1.toFixed(2)} / ${loadBaseline}`}
              fraction={loadFraction}
              color="var(--ys-metric-load, var(--progress-cpu))"
            />
          </div>

          <div className="strip-card-telemetry" aria-label="网络与状态">
            <StripStat
              icon={<ArrowUp size={12} strokeWidth={2.4} />}
              label="上行"
              value={`${upRate.value} ${upRate.unit}`}
              color="var(--ys-marquee-up, var(--progress-cpu))"
            />
            <StripStat
              icon={<ArrowDown size={12} strokeWidth={2.4} />}
              label="下行"
              value={`${downRate.value} ${downRate.unit}`}
              color="var(--ys-marquee-down, var(--status-success))"
            />
            <StripStat
              icon={<Clock3 size={12} strokeWidth={2} />}
              label="延迟"
              value={latencyText}
              color={latencyTone}
            />
            <StripStat
              icon={<Unplug size={12} strokeWidth={2} />}
              label="丢包"
              value={lossText}
              color={lossTone}
            />
            <StripStat
              icon={<Calendar size={12} strokeWidth={2} />}
              label="到期"
              value={`${expire.value}${expire.unit ?? ""}`}
              color={getExpireTextColor(node.expired_at)}
            />
            <StripStat
              icon={<RefreshCw size={12} strokeWidth={2} />}
              label="在线"
              value={`${uptime.value}${uptime.unit ?? ""}`}
              color="var(--progress-cpu)"
            />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article
      className={clsx(
        "server-card",
        isOffline && "is-offline",
        isDashboardCard && "is-dashboard-card",
        isDashboardCard && `is-${dashboardStyle}-dashboard`,
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
                  background: statusColor,
                  boxShadow: `0 0 0 3px color-mix(in srgb, ${statusColor} 20%, transparent)`,
                }}
                title={statusTitle}
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

        {dashboardStyle === "liquid" ? (
          <LiquidMetricPanel
            settings={dashboardSettings.liquid}
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
        ) : gaugeDashboardStyle ? (
          <RadarMetricPanel
            variant={gaugeDashboardStyle}
            settings={dashboardSettings}
            scanSeed={node.uuid}
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
              {trafficQuota && <TrafficQuotaBar summary={trafficQuota} />}
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

function LiquidMetricPanel({
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
  settings: LiquidDashboardSettings;
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
  const waveScale = scalePercentLegacy(settings.wave, 0.45, 1.55);

  return (
    <div
      className="liquid-metric-grid"
      aria-label="液位容器信息展板"
      data-liquid-shape={settings.shape}
      style={liquidDashboardStyle(settings)}
    >
      <LiquidGauge
        shape={settings.shape}
        waveScale={waveScale}
        motionMs={getLiquidMotionMs(cpuPct, settings)}
        icon={<Cpu size={13} strokeWidth={2} />}
        label="CPU"
        valueText={cpuPct.toFixed(0)}
        unit="%"
        fraction={cpuPct / 100}
        color="var(--ys-metric-cpu, var(--progress-cpu))"
        detailText={`${cpuCores || 0} 核`}
      />
      <LiquidGauge
        shape={settings.shape}
        waveScale={waveScale}
        motionMs={getLiquidMotionMs(ramPct, settings)}
        icon={<MemoryStick size={13} strokeWidth={2} />}
        label="内存"
        valueText={ramPct.toFixed(0)}
        unit="%"
        fraction={ramPct / 100}
        color="var(--ys-metric-memory, var(--progress-memory))"
        detailText={`${formatBytes(ramUsed)} / ${formatBytes(ramTotal)}`}
      />
      <LiquidGauge
        shape={settings.shape}
        waveScale={waveScale}
        motionMs={getLiquidMotionMs(diskPct, settings)}
        icon={<HardDrive size={13} strokeWidth={2} />}
        label="硬盘"
        valueText={diskPct.toFixed(0)}
        unit="%"
        fraction={diskPct / 100}
        color="var(--ys-metric-disk, var(--progress-disk))"
        detailText={`${formatBytes(diskUsed)} / ${formatBytes(diskTotal)}`}
      />
      <LiquidGauge
        shape={settings.shape}
        waveScale={waveScale}
        motionMs={getLiquidMotionMs(loadFraction * 100, settings)}
        icon={<Gauge size={13} strokeWidth={2} />}
        label="负载"
        valueText={loadValue.toFixed(2)}
        fraction={loadFraction}
        color="var(--ys-metric-load, var(--progress-cpu))"
        detailText={loadValue.toFixed(2)}
      />
      <LiquidGauge
        shape={settings.shape}
        waveScale={waveScale}
        motionMs={getLiquidMotionMs((upRate.bitsPerSec / upLimit.bitsPerSec) * 100, settings)}
        icon={<ArrowUp size={13} strokeWidth={2.4} />}
        label="上行"
        valueText={upRate.value}
        unit={upRate.unit}
        fraction={upRate.bitsPerSec / upLimit.bitsPerSec}
        color="var(--ys-marquee-up, var(--progress-cpu))"
        limitLabel={`上限 ${upLimit.label}`}
      />
      <LiquidGauge
        shape={settings.shape}
        waveScale={waveScale}
        motionMs={getLiquidMotionMs((downRate.bitsPerSec / downLimit.bitsPerSec) * 100, settings)}
        icon={<ArrowDown size={13} strokeWidth={2.4} />}
        label="下行"
        valueText={downRate.value}
        unit={downRate.unit}
        fraction={downRate.bitsPerSec / downLimit.bitsPerSec}
        color="var(--ys-marquee-down, var(--status-success))"
        limitLabel={`上限 ${downLimit.label}`}
      />
      <LiquidGauge
        shape={settings.shape}
        waveScale={waveScale}
        motionMs={getLiquidMotionMs(latency != null ? (latency / safeLatencyMax) * 100 : 0, settings)}
        icon={<Clock3 size={13} strokeWidth={2} />}
        label="延迟"
        valueText={latency != null ? String(Math.round(latency)) : hasHomepagePingBinding ? "—" : "未配"}
        unit={latency != null ? "ms" : undefined}
        fraction={latency != null ? latency / safeLatencyMax : 0}
        color="var(--ys-metric-latency, var(--status-online))"
        limitLabel={`${safeLatencyMax}ms`}
        empty={latency == null}
      />
      <LiquidGauge
        shape={settings.shape}
        waveScale={waveScale}
        motionMs={getLiquidMotionMs(loss != null ? loss : 0, settings)}
        icon={<Unplug size={13} strokeWidth={2} />}
        label="丢包"
        valueText={loss != null ? loss.toFixed(1) : hasHomepagePingBinding ? "—" : "未配"}
        unit={loss != null ? "%" : undefined}
        fraction={loss != null ? loss / 100 : 0}
        color="var(--ys-metric-loss, var(--status-offline))"
        limitLabel="100%"
        empty={loss == null}
        warning={Boolean(loss && loss > 0)}
      />
    </div>
  );
}

function renderLiquidShape(shape: LiquidShapeId, className: string) {
  if (shape === "capsule" || shape === "segmented") {
    return <rect className={className} x="7" y="28" width="86" height="44" rx="22" />;
  }
  if (shape === "column") {
    return (
      <path
        className={className}
        d="M38 8 H62 C65 8 67 10 67 13 V20 C67 22 65 24 63 25 V30 C69 36 72 44 72 71 C72 84 63 92 50 92 C37 92 28 84 28 71 C28 44 31 36 37 30 V25 C35 24 33 22 33 20 V13 C33 10 35 8 38 8 Z"
      />
    );
  }
  if (shape === "lens") {
    return (
      <path
        className={className}
        d="M8 50 C18 28 36 20 50 20 C64 20 82 28 92 50 C82 72 64 80 50 80 C36 80 18 72 8 50 Z"
      />
    );
  }
  if (shape === "crystal") {
    return (
      <polygon
        className={className}
        points="50,7 83,26 78,72 50,94 22,72 17,26"
      />
    );
  }
  if (shape === "drop") {
    return (
      <path
        className={className}
        d="M50 8 C66 28 80 43 80 61 A30 30 0 1 1 20 61 C20 43 34 28 50 8 Z"
      />
    );
  }
  if (shape === "ring") {
    return (
      <path
        className={className}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M50 7 A43 43 0 1 0 50 93 A43 43 0 1 0 50 7 Z M50 28 A22 22 0 1 1 50 72 A22 22 0 1 1 50 28 Z"
      />
    );
  }
  return <circle className={className} cx="50" cy="50" r="40" />;
}

function getLiquidSurface(shape: LiquidShapeId) {
  if (shape === "capsule" || shape === "segmented") return { rx: 35, ry: 4.2 };
  if (shape === "column") return { rx: 18, ry: 3.8 };
  if (shape === "lens") return { rx: 36, ry: 5 };
  if (shape === "crystal") return { rx: 28, ry: 4.4 };
  if (shape === "drop") return { rx: 24, ry: 4.2 };
  if (shape === "ring") return { rx: 30, ry: 3.6 };
  return { rx: 31, ry: 5 };
}

function renderLiquidContainerFrame(shape: LiquidShapeId) {
  if (shape === "sphere") {
    return (
      <g className="liquid-gauge-frame is-sphere">
        <ellipse className="liquid-frame-shadow" cx="50" cy="91" rx="29" ry="5" />
        <circle className="liquid-frame-rim" cx="50" cy="50" r="43" />
        <ellipse className="liquid-frame-latitude" cx="50" cy="50" rx="39" ry="12" />
        <ellipse className="liquid-frame-latitude is-upper" cx="50" cy="38" rx="31" ry="8" />
        <path className="liquid-frame-stand" d="M35 88 H65 L70 96 H30 Z" />
        <circle className="liquid-frame-bolt is-one" cx="23" cy="50" r="1.8" />
        <circle className="liquid-frame-bolt is-two" cx="77" cy="50" r="1.8" />
      </g>
    );
  }

  if (shape === "column") {
    return (
      <g className="liquid-gauge-frame is-column">
        <ellipse className="liquid-frame-shadow" cx="50" cy="92" rx="24" ry="5" />
        <rect className="liquid-frame-cap" x="35" y="5" width="30" height="9" rx="4" />
        <rect className="liquid-frame-neck" x="38" y="13" width="24" height="13" rx="5" />
        <path className="liquid-frame-rim" d="M38 8 H62 C65 8 67 10 67 13 V20 C67 22 65 24 63 25 V30 C69 36 72 44 72 71 C72 84 63 92 50 92 C37 92 28 84 28 71 C28 44 31 36 37 30 V25 C35 24 33 22 33 20 V13 C33 10 35 8 38 8 Z" />
        <path className="liquid-frame-base" d="M31 83 C39 91 61 91 69 83" />
        {[32, 44, 56, 68, 80].map((y) => (
          <line key={y} className="liquid-frame-mark" x1="25" y1={y} x2="33" y2={y} />
        ))}
      </g>
    );
  }

  if (shape === "capsule" || shape === "segmented") {
    return (
      <g className="liquid-gauge-frame is-capsule">
        <rect className="liquid-frame-rim" x="5" y="26" width="90" height="48" rx="24" />
        <rect className="liquid-frame-inner" x="12" y="33" width="76" height="34" rx="17" />
        <path className="liquid-frame-rail" d="M16 22 H84 M16 78 H84" />
        <path className="liquid-frame-collar is-left" d="M13 32 V68" />
        <path className="liquid-frame-collar is-right" d="M87 32 V68" />
        {[20, 80].map((x) => (
          <circle key={x} className="liquid-frame-bolt" cx={x} cy="26" r="1.8" />
        ))}
      </g>
    );
  }

  if (shape === "lens") {
    return (
      <g className="liquid-gauge-frame is-lens">
        <path className="liquid-frame-rim" d="M7 50 C18 26 36 18 50 18 C64 18 82 26 93 50 C82 74 64 82 50 82 C36 82 18 74 7 50 Z" />
        <path className="liquid-frame-refraction" d="M19 50 C30 39 39 35 50 35 C61 35 70 39 81 50" />
        <path className="liquid-frame-refraction is-lower" d="M19 50 C30 61 39 65 50 65 C61 65 70 61 81 50" />
        <circle className="liquid-frame-bolt is-one" cx="13" cy="50" r="2" />
        <circle className="liquid-frame-bolt is-two" cx="87" cy="50" r="2" />
      </g>
    );
  }

  if (shape === "crystal") {
    return (
      <g className="liquid-gauge-frame is-crystal">
        <polygon className="liquid-frame-rim" points="50,5 86,25 80,74 50,96 20,74 14,25" />
        <path className="liquid-frame-facet" d="M50 5 L50 96 M14 25 L80 74 M86 25 L20 74 M30 15 L70 85 M70 15 L30 85" />
        <polygon className="liquid-frame-inner" points="50,16 74,31 70,66 50,83 30,66 26,31" />
      </g>
    );
  }

  if (shape === "drop") {
    return (
      <g className="liquid-gauge-frame is-drop">
        <ellipse className="liquid-frame-shadow" cx="50" cy="90" rx="25" ry="5" />
        <path className="liquid-frame-rim" d="M50 6 C68 28 82 43 82 62 A32 32 0 1 1 18 62 C18 43 32 28 50 6 Z" />
        <ellipse className="liquid-frame-orbit" cx="50" cy="62" rx="40" ry="10" />
        <path className="liquid-frame-stand" d="M39 89 H61 L66 96 H34 Z" />
      </g>
    );
  }

  return (
    <g className="liquid-gauge-frame is-ring">
      <circle className="liquid-frame-rim" cx="50" cy="50" r="45" />
      <circle className="liquid-frame-inner" cx="50" cy="50" r="24" />
      <circle className="liquid-frame-latitude" cx="50" cy="50" r="34" />
      <path className="liquid-frame-collar" d="M50 4 V17 M50 83 V96 M4 50 H17 M83 50 H96" />
    </g>
  );
}

function renderLiquidShine(shape: LiquidShapeId) {
  if (shape === "capsule" || shape === "segmented") {
    return <path className="liquid-gauge-shine" d="M21 38 C35 31 64 31 79 38" />;
  }
  if (shape === "column") {
    return <path className="liquid-gauge-shine" d="M40 21 C46 17 55 17 61 21 M39 34 C43 31 47 31 51 34" />;
  }
  if (shape === "lens") {
    return <path className="liquid-gauge-shine" d="M22 43 C35 30 64 28 79 43" />;
  }
  if (shape === "crystal") {
    return <path className="liquid-gauge-shine" d="M35 27 L50 16 L64 27 L49 31 Z M30 44 L43 36" />;
  }
  if (shape === "drop") {
    return <path className="liquid-gauge-shine" d="M38 35 C44 27 52 23 58 22 M32 54 C35 45 41 40 48 38" />;
  }
  if (shape === "ring") {
    return <path className="liquid-gauge-shine" d="M26 38 A28 28 0 0 1 47 21" />;
  }
  return <path className="liquid-gauge-shine" d="M28 39 C34 25 52 18 68 25" />;
}

function renderLiquidTechArt(shape: LiquidShapeId, percent: number) {
  if (shape === "sphere") {
    return (
      <g className="liquid-gauge-tech is-sphere">
        <circle className="liquid-tech-halo is-outer" cx="50" cy="50" r="43" pathLength={100} />
        <circle className="liquid-tech-halo is-inner" cx="50" cy="50" r="30" pathLength={100} />
        <ellipse className="liquid-tech-orbit is-a" cx="50" cy="50" rx="46" ry="15" />
        <ellipse className="liquid-tech-orbit is-b" cx="50" cy="50" rx="18" ry="43" />
        <ellipse className="liquid-tech-orbit is-c" cx="50" cy="50" rx="36" ry="10" transform="rotate(-28 50 50)" />
        <path className="liquid-tech-sweep" d="M50 50 L50 12 A38 38 0 0 1 86 50 Z" />
        <path className="liquid-tech-reticle" d="M21 50 H34 M66 50 H79 M50 21 V34 M50 66 V79" />
        <path className="liquid-tech-signal" d="M25 58 C36 48 43 63 54 53 S72 43 80 52" />
        <circle className="liquid-tech-node is-one" cx="84" cy="50" r="2.5" />
        <circle className="liquid-tech-node is-two" cx="24" cy="34" r="1.8" />
        <circle className="liquid-tech-node is-three" cx="64" cy="22" r="1.6" />
      </g>
    );
  }

  if (shape === "capsule") {
    return (
      <g className="liquid-gauge-tech is-capsule">
        <path className="liquid-tech-panel" d="M24 31 H76 A19 19 0 0 1 76 69 H24 A19 19 0 0 1 24 31 Z" />
        <line className="liquid-tech-rail" x1="16" y1="29" x2="84" y2="29" />
        <line className="liquid-tech-rail is-bottom" x1="16" y1="71" x2="84" y2="71" />
        <line className="liquid-tech-lane" x1="20" y1="50" x2="80" y2="50" />
        <circle className="liquid-tech-packet is-one" cx="24" cy="29" r="2.4" />
        <circle className="liquid-tech-packet is-two" cx="64" cy="71" r="2" />
        <circle className="liquid-tech-packet is-three" cx="38" cy="50" r="1.7" />
        <path className="liquid-tech-signal" d="M19 50 H31 L38 42 L48 58 L57 47 L66 50 H81" />
        <path className="liquid-tech-brace" d="M13 43 L20 36 M13 57 L20 64 M87 43 L80 36 M87 57 L80 64" />
      </g>
    );
  }

  if (shape === "column") {
    return (
      <g className="liquid-gauge-tech is-column">
        <rect className="liquid-tech-panel" x="34" y="15" width="32" height="70" rx="10" />
        {[20, 32, 44, 56, 68, 80].map((y) => (
          <line key={y} className="liquid-tech-tick" x1="22" y1={y} x2="29" y2={y} />
        ))}
        {[24, 40, 56, 72].map((y) => (
          <line key={y} className="liquid-tech-tick is-right" x1="71" y1={y} x2="78" y2={y} />
        ))}
        <line className="liquid-tech-spine" x1="50" y1="17" x2="50" y2="84" />
        <path className="liquid-tech-ladder" d="M38 25 H62 M38 37 H62 M38 49 H62 M38 61 H62 M38 73 H62" />
        <circle className="liquid-tech-packet is-one" cx="50" cy="76" r="2.4" />
        <circle className="liquid-tech-packet is-two" cx="62" cy="38" r="1.7" />
        <path className="liquid-tech-signal" d="M35 17 H65 M35 84 H65" />
      </g>
    );
  }

  if (shape === "lens") {
    return (
      <g className="liquid-gauge-tech is-lens">
        <ellipse className="liquid-tech-panel" cx="50" cy="50" rx="39" ry="25" />
        <path className="liquid-tech-grid" d="M14 50 H86 M24 35 H76 M24 65 H76 M50 23 V77 M36 29 C42 43 42 57 36 71 M64 29 C58 43 58 57 64 71" />
        <circle className="liquid-tech-reticle" cx="50" cy="50" r="17" />
        <circle className="liquid-tech-reticle is-outer" cx="50" cy="50" r="25" />
        <path className="liquid-tech-sweep" d="M50 50 L50 23 A27 27 0 0 1 76 50 Z" />
        <path className="liquid-tech-signal" d="M19 43 C31 35 42 37 50 50 S69 65 82 56" />
        <circle className="liquid-tech-node is-one" cx="28" cy="35" r="1.8" />
        <circle className="liquid-tech-node is-two" cx="72" cy="65" r="1.8" />
      </g>
    );
  }

  if (shape === "segmented") {
    const activeSegments = Math.max(1, Math.ceil((percent / 100) * 6));
    return (
      <g className="liquid-gauge-tech is-segmented">
        <path className="liquid-tech-panel" d="M18 31 H82 A19 19 0 0 1 82 69 H18 A19 19 0 0 1 18 31 Z" />
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <rect
            key={index}
            className={clsx("liquid-tech-cell", index < activeSegments && "is-active")}
            x={16 + index * 11}
            y="33"
            width="7"
            height="34"
            rx="3"
            style={{ opacity: index < activeSegments ? 0.76 : 0.18 }}
          />
        ))}
        <line className="liquid-tech-rail" x1="15" y1="29" x2="85" y2="29" />
        <line className="liquid-tech-rail is-bottom" x1="15" y1="71" x2="85" y2="71" />
        <line className="liquid-tech-lane" x1="17" y1="50" x2="83" y2="50" />
        <circle className="liquid-tech-packet is-one" cx="18" cy="50" r="2" />
        <circle className="liquid-tech-packet is-two" cx="72" cy="50" r="1.6" />
      </g>
    );
  }

  if (shape === "crystal") {
    return (
      <g className="liquid-gauge-tech is-crystal">
        <polygon className="liquid-tech-panel" points="50,12 77,28 77,68 50,88 23,68 23,28" />
        <path className="liquid-tech-facet" d="M50 8 L50 92 M18 26 L82 70 M82 26 L18 70 M31 19 L69 81 M69 19 L31 81" />
        <path className="liquid-tech-grid" d="M32 28 H68 M25 49 H75 M32 70 H68" />
        <polygon className="liquid-tech-core" points="50,24 67,36 64,62 50,75 36,62 33,36" />
        <polygon className="liquid-tech-prism" points="50,34 60,42 58,57 50,65 42,57 40,42" />
        <path className="liquid-tech-sweep" d="M50 50 L50 16 L75 30 Z" />
        <circle className="liquid-tech-node is-one" cx="50" cy="8" r="2" />
        <circle className="liquid-tech-node is-two" cx="82" cy="70" r="1.8" />
        <circle className="liquid-tech-node is-three" cx="18" cy="26" r="1.6" />
      </g>
    );
  }

  if (shape === "drop") {
    return (
      <g className="liquid-gauge-tech is-drop">
        <ellipse className="liquid-tech-orbit is-a" cx="50" cy="58" rx="38" ry="10" />
        <ellipse className="liquid-tech-orbit is-b" cx="50" cy="56" rx="19" ry="37" />
        <path className="liquid-tech-spark" d="M50 16 L55 35 L72 41 L57 52 L59 72 L50 59 L41 72 L43 52 L28 41 L45 35 Z" />
        <circle className="liquid-tech-packet is-one" cx="80" cy="58" r="2.2" />
      </g>
    );
  }

  return (
    <g className="liquid-gauge-tech is-ring">
      <circle className="liquid-tech-orbit is-a" cx="50" cy="50" r="43" pathLength={100} />
      <circle className="liquid-tech-orbit is-b" cx="50" cy="50" r="29" pathLength={100} />
      <path className="liquid-tech-signal" d="M50 12 L56 23 L50 34 L44 23 Z M78 50 L67 56 L56 50 L67 44 Z M50 88 L44 77 L50 66 L56 77 Z M22 50 L33 44 L44 50 L33 56 Z" />
      <circle className="liquid-tech-node is-one" cx="50" cy="7" r="2.3" />
      <circle className="liquid-tech-node is-two" cx="90" cy="50" r="1.8" />
    </g>
  );
}

function LiquidGauge({
  shape,
  waveScale,
  motionMs,
  icon,
  label,
  valueText,
  unit,
  fraction,
  color,
  limitLabel = "100%",
  detailText,
  empty = false,
  warning = false,
}: {
  shape: LiquidShapeId;
  waveScale: number;
  motionMs: number;
  icon: ReactNode;
  label: string;
  valueText: string;
  unit?: string;
  fraction: number;
  color: string;
  limitLabel?: string;
  detailText?: string;
  empty?: boolean;
  warning?: boolean;
}) {
  const rawPercent = Math.round(clampFraction(fraction) * 100);
  const visualPercent = empty ? 5 : Math.max(5, rawPercent);
  const fillY = 88 - visualPercent * 0.76;
  const waveBase = empty ? 1.8 : Math.min(7, 2.5 + rawPercent / 18);
  const numericWaveAmp = waveBase * waveScale;
  const realValue = detailText ?? `${valueText}${unit ? ` ${unit}` : ""}`;
  const title = `${label} ${realValue} · ${rawPercent}% · ${limitLabel}`;
  const clipId = useId().replace(/:/g, "");
  const liquidGradientId = `${clipId}-liquid`;
  const waveGradientId = `${clipId}-wave`;
  const pressure = empty
    ? "empty"
    : warning || rawPercent >= 90
      ? "critical"
      : rawPercent >= 70
        ? "high"
        : rawPercent <= 12
          ? "low"
          : "normal";
  const wavePath = [
    `M -42 ${fillY.toFixed(2)}`,
    `C -22 ${(fillY - numericWaveAmp).toFixed(2)} -2 ${(fillY + numericWaveAmp).toFixed(2)} 18 ${fillY.toFixed(2)}`,
    `S 58 ${(fillY - numericWaveAmp).toFixed(2)} 78 ${fillY.toFixed(2)}`,
    `S 118 ${(fillY + numericWaveAmp).toFixed(2)} 138 ${fillY.toFixed(2)}`,
    "L 138 104 L -42 104 Z",
  ].join(" ");
  const surface = getLiquidSurface(shape);

  return (
    <div
      className={clsx("liquid-gauge", empty && "is-empty")}
      data-pressure={pressure}
      data-shape={shape}
      style={
        {
          "--liquid-color": color,
          "--liquid-fill-y": fillY.toFixed(2),
          "--liquid-wave-ms": `${motionMs}ms`,
          "--liquid-sweep-ms": `${Math.round(motionMs * 1.9)}ms`,
          "--liquid-pulse-ms": `${Math.round(motionMs * 1.25)}ms`,
          "--liquid-orbit-ms": `${Math.round(motionMs * 1.6)}ms`,
          "--liquid-rail-ms": `${Math.round(motionMs * 0.9)}ms`,
          "--liquid-spine-ms": `${Math.round(motionMs * 0.82)}ms`,
          "--liquid-reticle-ms": `${Math.round(motionMs * 1.18)}ms`,
          "--liquid-cell-ms": `${Math.round(motionMs * 1.14)}ms`,
          "--liquid-drop-orbit-ms": `${Math.round(motionMs * 1.42)}ms`,
          "--liquid-ring-node-ms": `${Math.round(motionMs * 1.4)}ms`,
          "--liquid-drift-ms": `${Math.round(motionMs * 1.72)}ms`,
          "--liquid-scan-ms": `${Math.round(motionMs * 1.06)}ms`,
        } as CSSProperties
      }
      title={title}
    >
      <div className="liquid-gauge-head">
        <span className="liquid-gauge-icon">{icon}</span>
        <span>{label}</span>
      </div>
      <svg className="liquid-gauge-svg" viewBox="0 0 100 100" aria-hidden>
        <defs>
          <linearGradient id={liquidGradientId} x1="20%" y1="0%" x2="82%" y2="100%">
            <stop offset="0%" stopColor="white" stopOpacity="0.35" />
            <stop offset="32%" stopColor="var(--liquid-color)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--liquid-color)" stopOpacity="0.52" />
          </linearGradient>
          <linearGradient id={waveGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--liquid-color)" stopOpacity="0.78" />
            <stop offset="48%" stopColor="white" stopOpacity="0.52" />
            <stop offset="100%" stopColor="var(--liquid-color)" stopOpacity="0.88" />
          </linearGradient>
          <clipPath id={clipId}>
            {renderLiquidShape(shape, "liquid-gauge-clip")}
          </clipPath>
        </defs>
        {renderLiquidContainerFrame(shape)}
        {renderLiquidShape(shape, "liquid-gauge-vessel")}
        <g clipPath={`url(#${clipId})`}>
          <rect
            className="liquid-gauge-fill"
            x="-12"
            y={fillY}
            width="124"
            height={Math.max(0, 110 - fillY)}
            fill={`url(#${liquidGradientId})`}
          />
          <path className="liquid-gauge-wave" d={wavePath} fill={`url(#${waveGradientId})`} />
          <ellipse
            className="liquid-gauge-surface"
            cx="50"
            cy={fillY}
            rx={surface.rx}
            ry={surface.ry}
          />
          <circle className="liquid-gauge-bubble is-one" cx="68" cy={Math.max(18, fillY + 16)} r="2.5" />
        </g>
        {shape === "segmented" && (
          <g className="liquid-gauge-segments">
            {[24, 36, 48, 60, 72].map((x) => (
              <line key={x} x1={x} y1="28" x2={x} y2="72" />
            ))}
          </g>
        )}
        {renderLiquidTechArt(shape, rawPercent)}
        {shape === "ring" && <circle className="liquid-gauge-ring-core" cx="50" cy="50" r="22" />}
        {renderLiquidShape(shape, "liquid-gauge-glass")}
        {renderLiquidShine(shape)}
      </svg>
      <div className="liquid-gauge-value tabular">
        <span>{rawPercent}</span>
        <span className="liquid-gauge-unit">%</span>
      </div>
      <div className="liquid-gauge-foot">
        <span>{realValue}</span>
      </div>
    </div>
  );
}

function RadarMetricPanel({
  variant,
  settings,
  scanSeed,
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
  variant: GaugeDashboardStyleId;
  settings: DashboardSettings;
  scanSeed: string;
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
        scanDelay={getRadarScanDelay(scanSeed, 0)}
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
        scanDelay={getRadarScanDelay(scanSeed, 1)}
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
        scanDelay={getRadarScanDelay(scanSeed, 2)}
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
        scanDelay={getRadarScanDelay(scanSeed, 3)}
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
        scanDelay={getRadarScanDelay(scanSeed, 4)}
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
        scanDelay={getRadarScanDelay(scanSeed, 5)}
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
        scanDelay={getRadarScanDelay(scanSeed, 6)}
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
        scanDelay={getRadarScanDelay(scanSeed, 7)}
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
  scanDelay,
}: {
  variant: GaugeDashboardStyleId;
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
  scanDelay?: string;
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
          "--radar-scan-delay": scanDelay,
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

type TrafficQuotaSummary = {
  label: string;
  mode: string;
  usedText: string;
  limitText: string;
  percent: number;
  tone: "ok" | "warn" | "critical";
  title: string;
};

function getTrafficQuotaSummary({
  up,
  down,
  limit,
  type,
}: {
  up: number;
  down: number;
  limit: number;
  type: string;
}): TrafficQuotaSummary | null {
  const safeLimit = Number.isFinite(limit) ? Math.max(0, limit) : 0;
  if (safeLimit <= 0) return null;

  const safeUp = Number.isFinite(up) ? Math.max(0, up) : 0;
  const safeDown = Number.isFinite(down) ? Math.max(0, down) : 0;
  const normalizedType = type.trim().toLowerCase();
  let used = safeUp + safeDown;
  let label = "合计额度";
  let mode = "按出站 + 入站统计";

  if (normalizedType === "up") {
    used = safeUp;
    label = "出站额度";
    mode = "按出站统计";
  } else if (normalizedType === "down") {
    used = safeDown;
    label = "入站额度";
    mode = "按入站统计";
  } else if (normalizedType === "max") {
    used = Math.max(safeUp, safeDown);
    label = "较高方向额度";
    mode = "按较高方向统计";
  } else if (normalizedType === "min") {
    used = Math.min(safeUp, safeDown);
    label = "较低方向额度";
    mode = "按较低方向统计";
  }

  const fraction = clampFraction(used / safeLimit);
  const percent = Math.round(fraction * 100);
  const tone = percent >= 90 ? "critical" : percent >= 75 ? "warn" : "ok";
  const usedText = formatBytes(used);
  const limitText = formatBytes(safeLimit);

  return {
    label,
    mode,
    usedText,
    limitText,
    percent,
    tone,
    title: `${label} · ${mode} · ${usedText} / ${limitText}`,
  };
}

function TrafficQuotaBar({ summary }: { summary: TrafficQuotaSummary }) {
  return (
    <div
      className="traffic-quota"
      data-tone={summary.tone}
      style={{ "--traffic-quota-percent": `${summary.percent}%` } as CSSProperties}
      title={summary.title}
    >
      <div className="traffic-quota-head">
        <span className="traffic-quota-label">
          <Globe size={13} strokeWidth={2} />
          <span>{summary.label}</span>
        </span>
        <span className="traffic-quota-mode">已用 / 总量 · {summary.mode}</span>
      </div>
      <div className="traffic-quota-value tabular">
        <span>{summary.usedText}</span>
        <span className="traffic-quota-separator">/</span>
        <span>{summary.limitText}</span>
        <strong>{summary.percent}%</strong>
      </div>
      <div className="traffic-quota-track" aria-hidden>
        <span className="traffic-quota-fill" />
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
  const points = useMemo(
    () =>
      samples.map((sample) => {
        const active = sample.value > 0;
        return {
          active,
          level: active ? Math.max(0.08, Math.min(1, sample.level)) : 0.16,
          opacity: active ? Math.min(1, sample.opacity + 0.05) : 0.46,
        };
      }),
    [samples],
  );
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number, now: number) =>
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
      }),
    [color, marqueeStyle, points],
  );

  return (
    <CanvasStrip
      className="traffic-dot-strip"
      height={10}
      ariaHidden
      redrawKey={redrawKey}
      animated={shouldAnimateMarqueeStyle(marqueeStyle)}
      frameIntervalMs={getMarqueeFrameInterval(marqueeStyle)}
      draw={draw}
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

function StripMetric({
  icon,
  label,
  value,
  unit,
  detail,
  fraction,
  color,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  unit?: string;
  detail: string;
  fraction: number;
  color: string;
}) {
  const percent = `${Math.round(clampFraction(fraction) * 100)}%`;

  return (
    <div
      className="strip-card-metric"
      style={
        {
          "--strip-metric-color": color,
          "--strip-metric-value": percent,
        } as CSSProperties
      }
    >
      <div className="strip-card-metric-head">
        <span className="strip-card-metric-label">
          {icon}
          <span>{label}</span>
        </span>
        <span className="strip-card-metric-value tabular">
          {value}
          {unit && <span className="strip-card-metric-unit">{unit}</span>}
        </span>
      </div>
      <div className="strip-card-metric-bar" aria-hidden />
      <span className="strip-card-metric-detail" title={detail}>
        {detail}
      </span>
    </div>
  );
}

function StripStat({
  icon,
  label,
  value,
  color,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="strip-card-stat">
      <span className="strip-card-stat-label">
        {icon}
        <span>{label}</span>
      </span>
      <span className="strip-card-stat-value tabular" style={{ color }}>
        {value}
      </span>
    </div>
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
