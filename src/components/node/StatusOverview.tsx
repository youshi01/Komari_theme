import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useVisibleNodes } from "@/hooks/useNode";
import { formatBytes, formatTrafficRateLabel } from "@/utils/format";

function formatClock(date: Date) {
  return date.toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function StatusOverview() {
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
    const trafficDown = nodes.reduce((sum, node) => sum + Math.max(0, node.trafficDown || 0), 0);
    const rateUp = nodes.reduce((sum, node) => sum + Math.max(0, node.netUp || 0), 0);
    const rateDown = nodes.reduce((sum, node) => sum + Math.max(0, node.netDown || 0), 0);

    return {
      total: nodes.length,
      online: online.length,
      regions: litRegions.size,
      trafficUp,
      trafficDown,
      rateUp,
      rateDown,
    };
  }, [nodes]);

  return (
    <section className="status-overview" aria-label="节点状态总览">
      <OverviewItem label="当前时间" value={formatClock(now)} />
      <OverviewItem label="节点总数" value={String(stats.total)} />
      <OverviewItem label="当前在线" value={`${stats.online} / ${stats.total}`} />
      <OverviewItem label="点亮地区" value={String(stats.regions)} />
      <OverviewItem
        label="流量概览"
        value={
          <span className="status-overview-flow">
            <span><ArrowUp size={14} />{formatBytes(stats.trafficUp)}</span>
            <span><ArrowDown size={14} />{formatBytes(stats.trafficDown)}</span>
          </span>
        }
      />
      <OverviewItem
        label="总流量速率"
        value={
          <span className="status-overview-flow">
            <span><ArrowUp size={14} />{formatTrafficRateLabel(stats.rateUp)}</span>
            <span><ArrowDown size={14} />{formatTrafficRateLabel(stats.rateDown)}</span>
          </span>
        }
      />
    </section>
  );
}

function OverviewItem({
  label,
  value,
}: {
  label: string;
  value: string | ReactNode;
}) {
  return (
    <div className="status-overview-item">
      <div className="status-overview-label">{label}</div>
      <div className="status-overview-value">{value}</div>
    </div>
  );
}
