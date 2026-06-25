import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  ensureStarted,
  getNodeSnapshot,
  getNodeTrafficTrendSnapshot,
  subscribe,
  subscribeToNode,
  getSnapshot,
} from "@/services/wsStore";
import { useAuth } from "@/hooks/useAuth";
import type { NodeDisplay, TrafficTrendSample } from "@/types/komari";

const EMPTY_TRAFFIC_TREND_SNAPSHOT: { up: TrafficTrendSample[]; down: TrafficTrendSample[] } = {
  up: [],
  down: [],
};

function useEnsured(enabled = true) {
  useEffect(() => {
    if (enabled) ensureStarted();
  }, [enabled]);
}

function canShowNode(node: NodeDisplay | undefined, includeHiddenNodes: boolean) {
  if (!node) return false;
  return includeHiddenNodes || !node.hidden;
}

export function useCanSeeHiddenNodes() {
  const { data: me } = useAuth();
  return me?.logged_in === true;
}

export function useNode(uuid: string, enabled = true): NodeDisplay | undefined {
  useEnsured(enabled);
  return useSyncExternalStore(
    enabled ? (cb) => subscribeToNode(uuid, cb) : () => () => undefined,
    enabled ? () => getNodeSnapshot(uuid) : () => undefined,
    enabled ? () => getNodeSnapshot(uuid) : () => undefined,
  );
}

export function useNodeTrafficTrend(
  uuid: string,
  enabled = true,
): { up: TrafficTrendSample[]; down: TrafficTrendSample[] } {
  useEnsured(enabled);
  return useSyncExternalStore(
    enabled ? (cb) => subscribeToNode(uuid, cb) : () => () => undefined,
    enabled ? () => getNodeTrafficTrendSnapshot(uuid) : () => EMPTY_TRAFFIC_TREND_SNAPSHOT,
    enabled ? () => getNodeTrafficTrendSnapshot(uuid) : () => EMPTY_TRAFFIC_TREND_SNAPSHOT,
  );
}

export function useVisibleNodeUuids(): string[] {
  useEnsured();
  const includeHiddenNodes = useCanSeeHiddenNodes();
  const snap = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  );
  return useMemo(
    () =>
      snap.order.filter((uuid) => {
        const node = snap.byUuid[uuid];
        return canShowNode(node, includeHiddenNodes);
      }),
    [includeHiddenNodes, snap],
  );
}

export function useVisibleNodes(): NodeDisplay[] {
  useEnsured();
  const includeHiddenNodes = useCanSeeHiddenNodes();
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useMemo(
    () =>
      snap.order
        .map((uuid) => snap.byUuid[uuid])
        .filter((node): node is NodeDisplay => canShowNode(node, includeHiddenNodes)),
    [includeHiddenNodes, snap],
  );
}

export function useNodeStoreStatus() {
  useEnsured();
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useMemo(
    () => ({
      lastSuccessAt: snap.lastSuccessAt,
      failureStreak: snap.failureStreak,
    }),
    [snap.failureStreak, snap.lastSuccessAt],
  );
}
