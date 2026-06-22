import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  ensureStarted,
  getNodeSnapshot,
  getNodeTrafficTrendSnapshot,
  getVisibleNodeUuidsSnapshot,
  subscribe,
  subscribeToNode,
  getSnapshot,
} from "@/services/wsStore";
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
  return useSyncExternalStore(
    subscribe,
    getVisibleNodeUuidsSnapshot,
    getVisibleNodeUuidsSnapshot,
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
