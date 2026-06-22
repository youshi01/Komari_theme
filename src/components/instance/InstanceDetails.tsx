import { useEffect, useRef } from "react";
import { useNode } from "@/hooks/useNode";
import { formatBytes, formatUptimeDays } from "@/utils/format";
import { InstancePanel } from "./InstancePanel";

export function InstanceDetails({
  uuid,
  onNodeReady,
}: {
  uuid: string;
  onNodeReady?: () => (() => void) | void;
}) {
  const node = useNode(uuid);
  const hasAlignedOnReadyRef = useRef(false);

  useEffect(() => {
    hasAlignedOnReadyRef.current = false;
  }, [uuid]);

  useEffect(() => {
    if (!node || hasAlignedOnReadyRef.current) return;
    hasAlignedOnReadyRef.current = true;
    return onNodeReady?.();
  }, [node, onNodeReady]);

  if (!node) return null;

  const isOnline = node.online;
  const uptime = formatUptimeDays(node.uptime);
  const trafficUsed = node.trafficUp + node.trafficDown;
  const trafficFraction =
    node.traffic_limit > 0
      ? Math.max(0, Math.min(1, trafficUsed / node.traffic_limit))
      : 0;
  const lastUpdated =
    node.updatedAt > 0
      ? new Intl.DateTimeFormat("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(node.updatedAt)
      : "—";

  return (
    <InstancePanel
      title="实例信息"
      description={
        isOnline ? undefined : "节点当前离线，以下展示最近一次上报的缓存数据。"
      }
    >
      <div className="instance-info-groups">
        <div className="instance-info-group">
          <div className="instance-info-group-title">系统</div>
          <InfoRow label="状态" value={isOnline ? "在线" : "离线"} />
          <InfoRow
            label="CPU"
            value={`${node.cpu_name || "—"}${node.cpu_cores > 0 ? ` (x${node.cpu_cores})` : ""}`}
          />
          <InfoRow label="架构" value={node.arch || "—"} />
          <InfoRow label="虚拟化" value={node.virtualization || "—"} />
          <InfoRow label="显卡" value={node.gpu_name || "—"} />
          <InfoRow label="操作系统" value={node.os || "—"} />
        </div>

        <div className="instance-info-group">
          <div className="instance-info-group-title">资源</div>
          <InfoRow label="内存" value={`${formatBytes(node.ramUsed)} / ${formatBytes(node.ramTotal)}`} />
          <InfoRow
            label="Swap"
            value={
              node.swapTotal > 0
                ? `${formatBytes(node.swapUsed)} / ${formatBytes(node.swapTotal)}`
                : "无"
            }
          />
          <InfoRow label="磁盘" value={`${formatBytes(node.diskUsed)} / ${formatBytes(node.diskTotal)}`} />
          <InfoRow
            label="负载"
            value={`${node.load1.toFixed(2)} | ${node.load5.toFixed(2)} | ${node.load15.toFixed(2)}`}
          />
          <InfoRow
            label="运行时长"
            value={uptime.unit ? `${uptime.value} ${uptime.unit}` : uptime.value}
          />
        </div>

        <div className="instance-info-group">
          <div className="instance-info-group-title">网络</div>
          <InfoRow
            label={isOnline ? "实时网络" : "缓存网络"}
            value={`↑ ${formatBytes(node.netUp)}/s · ↓ ${formatBytes(node.netDown)}/s`}
          />
          <InfoRow label={isOnline ? "最近更新" : "最后上报"} value={lastUpdated} />
          <div className="instance-info-item is-stack">
            <span className="instance-info-label">总流量</span>
            <div className="instance-info-traffic">
              <span className="instance-info-value">{`↑ ${formatBytes(node.trafficUp)} · ↓ ${formatBytes(node.trafficDown)}`}</span>
              {node.traffic_limit > 0 && (
                <>
                  <div className="instance-progress-track" aria-hidden>
                    <span
                      className="instance-progress-fill"
                      style={{ width: `${trafficFraction * 100}%` }}
                    />
                  </div>
                  <span className="instance-info-note">
                    {`${formatBytes(trafficUsed)} / ${formatBytes(node.traffic_limit)}`}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </InstancePanel>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="instance-info-item">
      <span className="instance-info-label">{label}</span>
      <div className="instance-info-value">{value}</div>
    </div>
  );
}
