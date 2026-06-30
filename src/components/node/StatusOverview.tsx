import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useVisibleNodes } from "@/hooks/useNode";
import {
  DEFAULT_TOP_INFO_ORDER,
  DEFAULT_TOP_INFO_SETTINGS,
  type TopInfoColumnCount,
  type TopInfoItemId,
  type TopInfoSettings,
} from "@/hooks/useVisualStyle";
import { formatBytes, formatTrafficRateLabel } from "@/utils/format";

function formatClock(date: Date) {
  return date.toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function formatPercent(value: number) {
  const safe = clampPercent(value);
  if (safe <= 0) return "0";
  return safe >= 10 ? safe.toFixed(0) : safe.toFixed(1);
}

function formatCores(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 100) return Math.round(value).toString();
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

interface StatusOverviewProps {
  topInfo?: TopInfoSettings;
  topInfoOrder?: TopInfoItemId[];
  topInfoColumns?: TopInfoColumnCount;
}

export function StatusOverview({
  topInfo = DEFAULT_TOP_INFO_SETTINGS,
  topInfoOrder = DEFAULT_TOP_INFO_ORDER,
  topInfoColumns = 0,
}: StatusOverviewProps) {
  const nodes = useVisibleNodes();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const stats = useMemo(() => {
    const online = nodes.filter((node) => node.online === true);
    const litRegions = new Set(
      online
        .map((node) => node.region?.trim())
        .filter((region): region is string => Boolean(region)),
    );
    const trafficUp = nodes.reduce((sum, node) => sum + Math.max(0, node.trafficUp || 0), 0);
    const trafficDown = nodes.reduce(
      (sum, node) => sum + Math.max(0, node.trafficDown || 0),
      0,
    );
    const rateUp = nodes.reduce((sum, node) => sum + Math.max(0, node.netUp || 0), 0);
    const rateDown = nodes.reduce((sum, node) => sum + Math.max(0, node.netDown || 0), 0);
    const cpuCores = nodes.reduce((sum, node) => sum + Math.max(0, node.cpu_cores || 0), 0);
    const cpuSamples = nodes
      .map((node) => Math.max(0, node.cpuPct || 0))
      .filter((value) => Number.isFinite(value));
    const cpuWeightedUsed = nodes.reduce((sum, node) => {
      const cores = Math.max(0, node.cpu_cores || 0);
      if (cores <= 0) return sum;
      return sum + (clampPercent(node.cpuPct || 0) / 100) * cores;
    }, 0);
    const cpuAverage =
      cpuCores > 0
        ? (cpuWeightedUsed / cpuCores) * 100
        : cpuSamples.length > 0
          ? cpuSamples.reduce((sum, value) => sum + clampPercent(value), 0) /
            cpuSamples.length
          : 0;
    const memoryTotal = nodes.reduce((sum, node) => sum + Math.max(0, node.ramTotal || 0), 0);
    const memoryUsed = nodes.reduce((sum, node) => sum + Math.max(0, node.ramUsed || 0), 0);
    const memoryPct = memoryTotal > 0 ? (memoryUsed / memoryTotal) * 100 : 0;
    const diskTotal = nodes.reduce((sum, node) => sum + Math.max(0, node.diskTotal || 0), 0);
    const diskUsed = nodes.reduce((sum, node) => sum + Math.max(0, node.diskUsed || 0), 0);
    const diskPct = diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0;

    return {
      total: nodes.length,
      online: online.length,
      regions: litRegions.size,
      trafficUp,
      trafficDown,
      rateUp,
      rateDown,
      cpuCores,
      cpuAverage: clampPercent(cpuAverage),
      memoryTotal,
      memoryUsed,
      memoryPct: clampPercent(memoryPct),
      diskTotal,
      diskUsed,
      diskPct: clampPercent(diskPct),
    };
  }, [nodes]);

  const items = useMemo<
    Array<{
      id: TopInfoItemId;
      label: string;
      value: string | ReactNode;
      detail?: string;
      progress?: number;
      tone?: "cpu" | "memory" | "disk";
    }>
  >(
    () => [
      {
        id: "time",
        label: "当前时间",
        value: formatClock(now),
        detail: "实时刷新",
      },
      {
        id: "total",
        label: "节点总数",
        value: String(stats.total),
        detail: "当前可见节点",
      },
      {
        id: "online",
        label: "当前在线",
        value: `${stats.online} / ${stats.total}`,
        detail:
          stats.total > 0
            ? `在线率 ${formatPercent((stats.online / stats.total) * 100)}%`
            : "暂无节点",
        progress: stats.total > 0 ? (stats.online / stats.total) * 100 : 0,
      },
      {
        id: "regions",
        label: "点亮地区",
        value: String(stats.regions),
        detail: "在线节点覆盖",
      },
      {
        id: "traffic",
        label: "总上下行流量",
        value: (
          <span className="status-overview-flow">
            <span>
              <ArrowUp size={14} />
              {formatBytes(stats.trafficUp)}
            </span>
            <span>
              <ArrowDown size={14} />
              {formatBytes(stats.trafficDown)}
            </span>
          </span>
        ),
        detail: "累计流量",
      },
      {
        id: "rate",
        label: "总流量速率",
        value: (
          <span className="status-overview-flow">
            <span>
              <ArrowUp size={14} />
              {formatTrafficRateLabel(stats.rateUp)}
            </span>
            <span>
              <ArrowDown size={14} />
              {formatTrafficRateLabel(stats.rateDown)}
            </span>
          </span>
        ),
        detail: "实时合计",
      },
      {
        id: "cpu",
        label: "总 CPU",
        value: `${formatCores(stats.cpuCores)} 核`,
        detail: `平均占用 ${formatPercent(stats.cpuAverage)}%`,
        progress: stats.cpuAverage,
        tone: "cpu",
      },
      {
        id: "memory",
        label: "总内存",
        value: formatBytes(stats.memoryTotal),
        detail: `已用 ${formatBytes(stats.memoryUsed)} / ${formatPercent(stats.memoryPct)}%`,
        progress: stats.memoryPct,
        tone: "memory",
      },
      {
        id: "disk",
        label: "总硬盘",
        value: formatBytes(stats.diskTotal),
        detail: `已用 ${formatBytes(stats.diskUsed)} / ${formatPercent(stats.diskPct)}%`,
        progress: stats.diskPct,
        tone: "disk",
      },
    ],
    [now, stats],
  );

  const visibleItems = useMemo(() => {
    const itemById = new Map(items.map((item) => [item.id, item]));
    const seen = new Set<TopInfoItemId>();
    const ordered = topInfoOrder
      .map((id) => itemById.get(id))
      .filter((item): item is (typeof items)[number] => Boolean(item))
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });

    for (const item of items) {
      if (seen.has(item.id)) continue;
      ordered.push(item);
    }

    return ordered.filter((item) => topInfo[item.id]);
  }, [items, topInfo, topInfoOrder]);
  const orderKey = visibleItems.map((item) => item.id).join("|");

  if (visibleItems.length === 0) return null;

  return (
    <section
      key={orderKey}
      className="status-overview"
      data-columns={topInfoColumns > 0 ? String(topInfoColumns) : "auto"}
      aria-label="节点状态总览"
    >
      {visibleItems.map((item, index) => (
        <OverviewItem
          key={item.id}
          label={item.label}
          value={item.value}
          detail={item.detail}
          progress={item.progress}
          tone={item.tone}
          order={index}
        />
      ))}
    </section>
  );
}

function OverviewItem({
  label,
  value,
  detail,
  progress,
  tone,
  order,
}: {
  label: string;
  value: string | ReactNode;
  detail?: string;
  progress?: number;
  tone?: "cpu" | "memory" | "disk";
  order: number;
}) {
  const hasProgress = typeof progress === "number";
  const safeProgress = hasProgress ? clampPercent(progress) : 0;

  return (
    <div
      className="status-overview-item"
      data-tone={tone}
      style={{ order } satisfies CSSProperties}
    >
      <div className="status-overview-head">
        <div className="status-overview-label">{label}</div>
        {hasProgress && (
          <div className="status-overview-percent">{formatPercent(safeProgress)}%</div>
        )}
      </div>
      <div className="status-overview-value">{value}</div>
      {detail && <div className="status-overview-detail">{detail}</div>}
      {hasProgress && (
        <div className="status-overview-progress" aria-hidden>
          <span style={{ width: `${safeProgress}%` }} />
        </div>
      )}
    </div>
  );
}
