import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import {
  DEFAULT_HOMEPAGE_NODE_SORT,
  normalizeHomepageNodeSortSettings,
  serializeHomepageNodeSortSettings,
  type HomepageNodeSortSettings,
} from "@/utils/nodeSort";

export type NodeSortSource = "local" | "global" | "default";

const STORAGE_KEY = "komari-theme-YS:node-sort";

const listeners = new Set<() => void>();
let initialized = false;
let snapshot = DEFAULT_HOMEPAGE_NODE_SORT;
let snapshotSource: NodeSortSource = "default";
let hasLocalSettings = false;
let globalFallbackSettings: HomepageNodeSortSettings | null = null;

function readStoredSettings() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeHomepageNodeSortSettings(JSON.parse(raw));
  } catch {
    return null;
  }
}

function persistSettings(value: HomepageNodeSortSettings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Keep the in-memory state if localStorage is unavailable.
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function equalSettings(
  left: HomepageNodeSortSettings,
  right: HomepageNodeSortSettings,
) {
  return (
    serializeHomepageNodeSortSettings(left) ===
    serializeHomepageNodeSortSettings(right)
  );
}

function getFallbackSettings() {
  return globalFallbackSettings ?? DEFAULT_HOMEPAGE_NODE_SORT;
}

function getFallbackSource(): NodeSortSource {
  return globalFallbackSettings ? "global" : "default";
}

function setSnapshot(
  value:
    | HomepageNodeSortSettings
    | ((current: HomepageNodeSortSettings) => HomepageNodeSortSettings),
  persist = true,
  source: NodeSortSource = persist ? "local" : snapshotSource,
) {
  const next = normalizeHomepageNodeSortSettings(
    typeof value === "function" ? value(snapshot) : value,
  );
  if (persist) {
    hasLocalSettings = true;
  }
  const settingsUnchanged = equalSettings(next, snapshot);
  if (settingsUnchanged && snapshotSource === source) return;
  snapshot = settingsUnchanged ? { ...next } : next;
  snapshotSource = source;
  if (persist && typeof window !== "undefined") {
    persistSettings(next);
  }
  emit();
}

function applyFallbackSettings(settings: unknown) {
  globalFallbackSettings = settings
    ? normalizeHomepageNodeSortSettings(settings)
    : null;
  if (hasLocalSettings) return;
  setSnapshot(getFallbackSettings(), false, getFallbackSource());
}

function clearLocalSettings(fallback: unknown = globalFallbackSettings) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Keep the in-memory state if localStorage is unavailable.
    }
  }
  hasLocalSettings = false;
  applyFallbackSettings(fallback);
}

function initIfNeeded() {
  if (initialized) return;
  initialized = true;
  const stored = readStoredSettings();
  hasLocalSettings = Boolean(stored);
  snapshot = stored ?? getFallbackSettings();
  snapshotSource = stored ? "local" : getFallbackSource();

  if (typeof window === "undefined") return;
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    const storedSettings = readStoredSettings();
    hasLocalSettings = Boolean(storedSettings);
    setSnapshot(
      storedSettings ?? getFallbackSettings(),
      false,
      storedSettings ? "local" : getFallbackSource(),
    );
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

export function useNodeSort() {
  initIfNeeded();
  const { data: config } = usePublicConfig();
  const globalSettings = config?.theme_settings?.homepageNodeSort;
  const settings = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const serializedGlobalSettings = useMemo(
    () => serializeHomepageNodeSortSettings(normalizeHomepageNodeSortSettings(globalSettings)),
    [globalSettings],
  );

  useEffect(() => {
    applyFallbackSettings(globalSettings);
  }, [globalSettings, serializedGlobalSettings]);

  const updateSettings = useCallback((patch: Partial<HomepageNodeSortSettings>) => {
    setSnapshot((current) =>
      normalizeHomepageNodeSortSettings({ ...current, ...patch }),
    );
  }, []);

  const clearLocalNodeSort = useCallback(() => {
    clearLocalSettings(config?.theme_settings?.homepageNodeSort);
  }, [config?.theme_settings?.homepageNodeSort]);

  const nodeSortSource = hasLocalSettings
    ? "local"
    : globalFallbackSettings
      ? "global"
      : "default";

  const effectiveSource =
    snapshotSource === nodeSortSource ? snapshotSource : nodeSortSource;
  const nodeSortSourceLabel =
    effectiveSource === "local"
      ? "本机排序"
      : effectiveSource === "global"
        ? "全站默认"
        : "主题默认";

  return {
    nodeSort: settings,
    nodeSortSource: effectiveSource,
    nodeSortSourceLabel,
    hasLocalNodeSort: nodeSortSource === "local",
    updateNodeSort: updateSettings,
    clearLocalNodeSort,
  };
}
