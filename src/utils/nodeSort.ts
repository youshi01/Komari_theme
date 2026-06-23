import type { NodeDisplay } from "@/types/komari";
import { applyHomepageNodeOrder } from "@/utils/nodeOrder";

export type HomepageNodeSortMode =
  | "custom"
  | "expiry-asc"
  | "expiry-desc"
  | "name-asc"
  | "name-desc"
  | "uptime-desc"
  | "uptime-asc"
  | "cpu-desc"
  | "cpu-asc";

export interface HomepageNodeSortSettings {
  mode: HomepageNodeSortMode;
  realtimeIntervalSeconds: number;
}

export interface HomepageNodeSortOption {
  value: HomepageNodeSortMode;
  label: string;
  description: string;
  realtime?: boolean;
}

export const NODE_SORT_INTERVAL_OPTIONS = [5, 10, 15, 30, 60] as const;

export const DEFAULT_HOMEPAGE_NODE_SORT: HomepageNodeSortSettings = {
  mode: "custom",
  realtimeIntervalSeconds: 5,
};

export const HOMEPAGE_NODE_SORT_OPTIONS: HomepageNodeSortOption[] = [
  {
    value: "custom",
    label: "自定义排序",
    description: "使用后台权重和手动拖拽顺序",
  },
  {
    value: "expiry-asc",
    label: "到期最短",
    description: "即将到期优先，空值和长期排最后",
  },
  {
    value: "expiry-desc",
    label: "到期最长",
    description: "有效期最远优先，空值和长期排最后",
  },
  {
    value: "name-asc",
    label: "名称 A-Z",
    description: "按服务器名称正序",
  },
  {
    value: "name-desc",
    label: "名称 Z-A",
    description: "按服务器名称倒序",
  },
  {
    value: "uptime-desc",
    label: "在线最长",
    description: "按在线时长从长到短排序，离线排最后",
  },
  {
    value: "uptime-asc",
    label: "在线最短",
    description: "按在线时长从短到长排序，离线排最后",
  },
  {
    value: "cpu-desc",
    label: "CPU 高到低",
    description: "按快照中的 CPU 占用排序",
    realtime: true,
  },
  {
    value: "cpu-asc",
    label: "CPU 低到高",
    description: "按快照中的 CPU 占用排序",
    realtime: true,
  },
];

function isSettingsObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function isHomepageNodeSortMode(value: unknown): value is HomepageNodeSortMode {
  return (
    value === "custom" ||
    value === "expiry-asc" ||
    value === "expiry-desc" ||
    value === "name-asc" ||
    value === "name-desc" ||
    value === "uptime-desc" ||
    value === "uptime-asc" ||
    value === "cpu-desc" ||
    value === "cpu-asc"
  );
}

export function isRealtimeNodeSortMode(mode: HomepageNodeSortMode) {
  return mode === "cpu-desc" || mode === "cpu-asc";
}

function normalizeRealtimeIntervalSeconds(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_HOMEPAGE_NODE_SORT.realtimeIntervalSeconds;
  return Math.max(2, Math.min(300, Math.round(parsed)));
}

export function normalizeHomepageNodeSortSettings(
  value: unknown,
): HomepageNodeSortSettings {
  if (!isSettingsObject(value)) return DEFAULT_HOMEPAGE_NODE_SORT;
  return {
    mode: isHomepageNodeSortMode(value.mode)
      ? value.mode
      : DEFAULT_HOMEPAGE_NODE_SORT.mode,
    realtimeIntervalSeconds: normalizeRealtimeIntervalSeconds(
      value.realtimeIntervalSeconds,
    ),
  };
}

export function serializeHomepageNodeSortSettings(
  settings: HomepageNodeSortSettings,
) {
  return JSON.stringify(normalizeHomepageNodeSortSettings(settings));
}

function toExpiryTimestamp(value: unknown): number | null {
  if (value == null) return null;

  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value > 1_000_000_000_000 ? value : value * 1000;
  }

  const raw = String(value).trim();
  if (!raw || raw === "0" || raw === "-" || raw === "长期" || raw.toLowerCase() === "never") {
    return null;
  }

  const numeric = Number(raw);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  }

  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function compareText(left: string, right: string, direction: "asc" | "desc") {
  const result = left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });
  return direction === "asc" ? result : -result;
}

function compareNullableNumber(
  left: number | null,
  right: number | null,
  direction: "asc" | "desc",
) {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return direction === "asc" ? left - right : right - left;
}

function compareFiniteNumber(
  left: number,
  right: number,
  direction: "asc" | "desc",
) {
  return direction === "asc" ? left - right : right - left;
}

function toSortableUptime(node: NodeDisplay): number | null {
  if (node.online === false) return null;
  return Number.isFinite(node.uptime) && node.uptime > 0 ? node.uptime : null;
}

export function sortHomepageNodes(
  nodes: readonly NodeDisplay[],
  orderValue: unknown,
  settingsValue: unknown,
): string[] {
  const settings = normalizeHomepageNodeSortSettings(settingsValue);
  const byUuid = new Map(nodes.map((node) => [node.uuid, node]));
  const baseUuids = applyHomepageNodeOrder(
    nodes.map((node) => node.uuid),
    orderValue,
  );

  if (settings.mode === "custom") return baseUuids;

  const ranked = baseUuids
    .map((uuid, index) => ({ node: byUuid.get(uuid), index }))
    .filter((entry): entry is { node: NodeDisplay; index: number } => Boolean(entry.node));

  ranked.sort((left, right) => {
    let result = 0;

    if (settings.mode === "expiry-asc" || settings.mode === "expiry-desc") {
      result = compareNullableNumber(
        toExpiryTimestamp(left.node.expired_at),
        toExpiryTimestamp(right.node.expired_at),
        settings.mode === "expiry-asc" ? "asc" : "desc",
      );
    }

    if (settings.mode === "name-asc" || settings.mode === "name-desc") {
      result = compareText(
        left.node.name || left.node.uuid,
        right.node.name || right.node.uuid,
        settings.mode === "name-asc" ? "asc" : "desc",
      );
    }

    if (settings.mode === "cpu-desc" || settings.mode === "cpu-asc") {
      result = compareFiniteNumber(
        left.node.cpuPct,
        right.node.cpuPct,
        settings.mode === "cpu-asc" ? "asc" : "desc",
      );
    }

    if (settings.mode === "uptime-desc" || settings.mode === "uptime-asc") {
      result = compareNullableNumber(
        toSortableUptime(left.node),
        toSortableUptime(right.node),
        settings.mode === "uptime-asc" ? "asc" : "desc",
      );
    }

    return result || left.index - right.index;
  });

  return ranked.map(({ node }) => node.uuid);
}
