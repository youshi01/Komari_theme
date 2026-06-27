import { useEffect, useMemo, useState } from "react";
import { useCanSeeHiddenNodes, useVisibleNodes } from "@/hooks/useNode";
import { useHomepagePingOverview } from "@/hooks/usePingMini";
import { useNodeSort } from "@/hooks/useNodeSort";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { serializeVisualStyleSettings, useVisualStyle } from "@/hooks/useVisualStyle";
import { getSnapshot } from "@/services/wsStore";
import { normalizeHomepageNodeOrder } from "@/utils/nodeOrder";
import {
  isRealtimeNodeSortMode,
  serializeHomepageNodeSortSettings,
  sortHomepageNodes,
} from "@/utils/nodeSort";
import { NodeCard } from "./NodeCard";
import { StatusOverview } from "./StatusOverview";

export function NodeGrid() {
  const nodes = useVisibleNodes();
  const includeHiddenNodes = useCanSeeHiddenNodes();
  const { data: config } = usePublicConfig();
  const { nodeSort } = useNodeSort();
  const { visualStyle } = useVisualStyle();
  const customOrder = useMemo(
    () => normalizeHomepageNodeOrder(config?.theme_settings?.homepageNodeOrder),
    [config?.theme_settings?.homepageNodeOrder],
  );
  const nodeSortKey = useMemo(
    () => serializeHomepageNodeSortSettings(nodeSort),
    [nodeSort],
  );
  const visibleNodeKey = useMemo(
    () => nodes.map((node) => node.uuid).join("|"),
    [nodes],
  );
  const staticUuids = useMemo(
    () => sortHomepageNodes(nodes, customOrder, nodeSort),
    [customOrder, nodeSortKey, nodes],
  );
  const [realtimeUuids, setRealtimeUuids] = useState<string[]>([]);
  const useRealtimeSort = isRealtimeNodeSortMode(nodeSort.mode);

  useEffect(() => {
    if (!useRealtimeSort) {
      setRealtimeUuids([]);
      return;
    }

    const updateRealtimeOrder = () => {
      const snapshot = getSnapshot();
      const liveNodes = snapshot.order
        .map((uuid) => snapshot.byUuid[uuid])
        .filter(
          (node): node is NonNullable<typeof node> =>
            Boolean(node) && (includeHiddenNodes || !node.hidden),
        );
      setRealtimeUuids(sortHomepageNodes(liveNodes, customOrder, nodeSort));
    };

    updateRealtimeOrder();
    const timer = window.setInterval(
      updateRealtimeOrder,
      nodeSort.realtimeIntervalSeconds * 1000,
    );
    return () => window.clearInterval(timer);
  }, [customOrder, includeHiddenNodes, nodeSortKey, useRealtimeSort, visibleNodeKey]);

  const uuids = useMemo(
    () => {
      if (!useRealtimeSort || realtimeUuids.length === 0) return staticUuids;

      const available = new Set(nodes.map((node) => node.uuid));
      const seen = new Set<string>();
      const reconciled: string[] = [];

      for (const uuid of realtimeUuids) {
        if (!available.has(uuid) || seen.has(uuid)) continue;
        seen.add(uuid);
        reconciled.push(uuid);
      }

      for (const uuid of staticUuids) {
        if (seen.has(uuid)) continue;
        seen.add(uuid);
        reconciled.push(uuid);
      }

      return reconciled;
    },
    [nodes, realtimeUuids, staticUuids, useRealtimeSort],
  );
  const visualRedrawKey = useMemo(
    () => serializeVisualStyleSettings(visualStyle),
    [visualStyle],
  );
  const isStripLayout = visualStyle.cardLayout === "strip";
  useHomepagePingOverview();

  if (uuids.length === 0) {
    return (
      <div className="flex h-[40vh] flex-col items-center justify-center gap-2 text-[var(--text-tertiary)]">
        <span className="text-[15px]">尚未连接到任何节点</span>
        <span className="text-[12px]">等待后端推送或前往管理后台添加</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 xl:gap-5">
      <StatusOverview />
      <div
        className={
          isStripLayout
            ? "node-card-list is-strip-layout"
            : "node-card-list is-square-layout"
        }
        style={
          isStripLayout
            ? undefined
            : { gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))" }
        }
      >
        {uuids.map((uuid) => (
          <div key={uuid}>
            <NodeCard
              uuid={uuid}
              cardLayout={visualStyle.cardLayout}
              visualRedrawKey={visualRedrawKey}
              dashboardStyle={visualStyle.dashboardStyle}
              showTrafficQuota={visualStyle.showTrafficQuota}
              dashboardSettings={visualStyle.dashboardSettings}
              radarLatencyMaxMs={visualStyle.radarLatencyMaxMs}
              marqueeStyle={visualStyle.marqueeStyle}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
