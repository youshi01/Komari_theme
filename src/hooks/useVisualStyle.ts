import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { usePublicConfig } from "@/hooks/usePublicConfig";

export type CardStylePresetId = "panel" | "glass" | "neon" | "soft" | "minimal";
export type MarqueePalettePresetId =
  | "health"
  | "tech"
  | "neon"
  | "pastel"
  | "status"
  | "custom";
export type VisualStyleSource = "local" | "global" | "default";

export interface VisualMetricColors {
  cpu: string;
  memory: string;
  disk: string;
  load: string;
  latency: string;
  loss: string;
  up: string;
  down: string;
  peak: string;
  idle: string;
}

export interface VisualStyleSettings {
  cardStyle: CardStylePresetId;
  marqueePalette: MarqueePalettePresetId;
  colors: VisualMetricColors;
}

export interface CardStylePreset {
  id: CardStylePresetId;
  label: string;
  description: string;
}

export interface MarqueePalettePreset {
  id: Exclude<MarqueePalettePresetId, "custom">;
  label: string;
  description: string;
  colors: VisualMetricColors;
}

export const CARD_STYLE_PRESETS: CardStylePreset[] = [
  {
    id: "panel",
    label: "数据面板",
    description: "清晰稳重，适合长期看数据",
  },
  {
    id: "glass",
    label: "清透玻璃",
    description: "高透明、强背景透出",
  },
  {
    id: "neon",
    label: "霓虹暗面",
    description: "暗色发光，状态更醒目",
  },
  {
    id: "soft",
    label: "柔和彩块",
    description: "渐变色块更活泼",
  },
  {
    id: "minimal",
    label: "极简白板",
    description: "少装饰、轻边框、好读数",
  },
];

export const MARQUEE_PALETTE_PRESETS: MarqueePalettePreset[] = [
  {
    id: "health",
    label: "健康监控",
    description: "绿蓝为主，黄红点醒异常",
    colors: {
      cpu: "#3b82f6",
      memory: "#8b5cf6",
      disk: "#e97b35",
      load: "#22c55e",
      latency: "#14b8a6",
      loss: "#ef4444",
      up: "#34c98f",
      down: "#3b82f6",
      peak: "#f6b73c",
      idle: "#a7b0bd",
    },
  },
  {
    id: "tech",
    label: "冷色科技",
    description: "青蓝紫，干净克制",
    colors: {
      cpu: "#38bdf8",
      memory: "#818cf8",
      disk: "#22d3ee",
      load: "#a78bfa",
      latency: "#2dd4bf",
      loss: "#f472b6",
      up: "#22d3ee",
      down: "#60a5fa",
      peak: "#8b5cf6",
      idle: "#7f94aa",
    },
  },
  {
    id: "neon",
    label: "霓虹警戒",
    description: "紫青粉橙，对比最强",
    colors: {
      cpu: "#a855f7",
      memory: "#06b6d4",
      disk: "#f97316",
      load: "#22d3ee",
      latency: "#f0abfc",
      loss: "#fb7185",
      up: "#a855f7",
      down: "#06b6d4",
      peak: "#fb7185",
      idle: "#64748b",
    },
  },
  {
    id: "pastel",
    label: "柔和渐变",
    description: "薄荷、天青、淡粉、浅紫",
    colors: {
      cpu: "#86c5ff",
      memory: "#b8b4de",
      disk: "#f4b78f",
      load: "#75d6a0",
      latency: "#8edfd0",
      loss: "#f6a8c8",
      up: "#75d6a0",
      down: "#86c5ff",
      peak: "#f6a8c8",
      idle: "#b8b4de",
    },
  },
  {
    id: "status",
    label: "状态优先",
    description: "在线绿更高，异常色更明确",
    colors: {
      cpu: "#0ea5e9",
      memory: "#8b5cf6",
      disk: "#f59e0b",
      load: "#22c55e",
      latency: "#10b981",
      loss: "#ef4444",
      up: "#22c55e",
      down: "#0ea5e9",
      peak: "#ef4444",
      idle: "#94a3b8",
    },
  },
];

export const VISUAL_COLOR_CONTROLS: Array<{
  key: keyof VisualMetricColors;
  label: string;
}> = [
  { key: "cpu", label: "CPU" },
  { key: "memory", label: "内存" },
  { key: "disk", label: "磁盘" },
  { key: "load", label: "负载" },
  { key: "latency", label: "延迟" },
  { key: "loss", label: "丢包" },
  { key: "up", label: "上行" },
  { key: "down", label: "下行" },
  { key: "peak", label: "峰值" },
  { key: "idle", label: "空闲" },
];

const STORAGE_KEY = "komari-theme-YS:visual-style";
export const DEFAULT_VISUAL_STYLE_SETTINGS: VisualStyleSettings = {
  cardStyle: "panel",
  marqueePalette: "health",
  colors: MARQUEE_PALETTE_PRESETS[0].colors,
};

const listeners = new Set<() => void>();
let initialized = false;
let snapshot = DEFAULT_VISUAL_STYLE_SETTINGS;
let snapshotSource: VisualStyleSource = "default";
let hasLocalSettings = false;
let globalFallbackSettings: VisualStyleSettings | null = null;

function isCardStyle(value: unknown): value is CardStylePresetId {
  return (
    value === "panel" ||
    value === "glass" ||
    value === "neon" ||
    value === "soft" ||
    value === "minimal"
  );
}

function isMarqueePalette(value: unknown): value is MarqueePalettePresetId {
  return (
    value === "health" ||
    value === "tech" ||
    value === "neon" ||
    value === "pastel" ||
    value === "status" ||
    value === "custom"
  );
}

function getMarqueePalette(id: MarqueePalettePresetId) {
  return (
    MARQUEE_PALETTE_PRESETS.find((preset) => preset.id === id) ??
    MARQUEE_PALETTE_PRESETS[0]
  );
}

function normalizeColor(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : fallback;
}

function isSettingsObject(value: unknown) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function normalizeVisualStyleSettings(value: unknown): VisualStyleSettings {
  if (!isSettingsObject(value)) return DEFAULT_VISUAL_STYLE_SETTINGS;
  const record = value as Partial<VisualStyleSettings>;
  const marqueePalette = isMarqueePalette(record.marqueePalette)
    ? record.marqueePalette
    : DEFAULT_VISUAL_STYLE_SETTINGS.marqueePalette;
  const fallbackColors = getMarqueePalette(marqueePalette).colors;
  const colors = isSettingsObject(record.colors)
    ? (record.colors as Partial<VisualMetricColors>)
    : {};

  return {
    cardStyle: isCardStyle(record.cardStyle)
      ? record.cardStyle
      : DEFAULT_VISUAL_STYLE_SETTINGS.cardStyle,
    marqueePalette,
    colors: {
      cpu: normalizeColor(colors.cpu, fallbackColors.cpu),
      memory: normalizeColor(colors.memory, fallbackColors.memory),
      disk: normalizeColor(colors.disk, fallbackColors.disk),
      load: normalizeColor(colors.load, fallbackColors.load),
      latency: normalizeColor(colors.latency, fallbackColors.latency),
      loss: normalizeColor(colors.loss, fallbackColors.loss),
      up: normalizeColor(colors.up, fallbackColors.up),
      down: normalizeColor(colors.down, fallbackColors.down),
      peak: normalizeColor(colors.peak, fallbackColors.peak),
      idle: normalizeColor(colors.idle, fallbackColors.idle),
    },
  };
}

export function serializeVisualStyleSettings(settings: VisualStyleSettings) {
  return JSON.stringify(normalizeVisualStyleSettings(settings));
}

function readStoredSettings() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeVisualStyleSettings(JSON.parse(raw));
  } catch {
    return null;
  }
}

function persistSettings(value: VisualStyleSettings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Keep the in-memory state if localStorage is unavailable.
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function equalSettings(a: VisualStyleSettings, b: VisualStyleSettings) {
  return serializeVisualStyleSettings(a) === serializeVisualStyleSettings(b);
}

function getFallbackSettings() {
  return globalFallbackSettings ?? DEFAULT_VISUAL_STYLE_SETTINGS;
}

function getFallbackSource(): VisualStyleSource {
  return globalFallbackSettings ? "global" : "default";
}

function setSnapshot(
  value:
    | VisualStyleSettings
    | ((current: VisualStyleSettings) => VisualStyleSettings),
  persist = true,
  source: VisualStyleSource = persist ? "local" : snapshotSource,
) {
  const next = normalizeVisualStyleSettings(
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
  globalFallbackSettings = isSettingsObject(settings)
    ? normalizeVisualStyleSettings(settings)
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
    const stored = readStoredSettings();
    hasLocalSettings = Boolean(stored);
    setSnapshot(stored ?? getFallbackSettings(), false, stored ? "local" : getFallbackSource());
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

function applyDocumentStyle(settings: VisualStyleSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const normalized = normalizeVisualStyleSettings(settings);

  root.dataset.cardStyle = normalized.cardStyle;
  root.dataset.marqueePalette = normalized.marqueePalette;
  root.style.setProperty("--ys-metric-cpu", normalized.colors.cpu);
  root.style.setProperty("--ys-metric-memory", normalized.colors.memory);
  root.style.setProperty("--ys-metric-disk", normalized.colors.disk);
  root.style.setProperty("--ys-metric-load", normalized.colors.load);
  root.style.setProperty("--ys-metric-latency", normalized.colors.latency);
  root.style.setProperty("--ys-metric-loss", normalized.colors.loss);
  root.style.setProperty("--ys-marquee-up", normalized.colors.up);
  root.style.setProperty("--ys-marquee-down", normalized.colors.down);
  root.style.setProperty("--ys-marquee-peak", normalized.colors.peak);
  root.style.setProperty("--ys-marquee-idle", normalized.colors.idle);
}

export function useVisualStyle() {
  initIfNeeded();
  const { data: config } = usePublicConfig();
  const globalSettings = config?.theme_settings?.visualStyle;
  const settings = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const serializedGlobalSettings = useMemo(
    () => serializeVisualStyleSettings(normalizeVisualStyleSettings(globalSettings)),
    [globalSettings],
  );

  useEffect(() => {
    applyFallbackSettings(globalSettings);
  }, [globalSettings, serializedGlobalSettings]);

  useEffect(() => {
    applyDocumentStyle(settings);
  }, [settings]);

  const updateSettings = useCallback((patch: Partial<VisualStyleSettings>) => {
    setSnapshot((current) => normalizeVisualStyleSettings({ ...current, ...patch }));
  }, []);

  const clearLocalVisualStyle = useCallback(() => {
    clearLocalSettings(config?.theme_settings?.visualStyle);
  }, [config?.theme_settings?.visualStyle]);

  const visualStyleSource = hasLocalSettings
    ? "local"
    : globalFallbackSettings
      ? "global"
      : "default";

  const effectiveSource =
    snapshotSource === visualStyleSource ? snapshotSource : visualStyleSource;
  const effectiveSourceLabel =
    effectiveSource === "local"
      ? "本机样式"
      : effectiveSource === "global"
        ? "全站默认"
        : "主题默认";

  return {
    visualStyle: settings,
    visualStyleSource: effectiveSource,
    visualStyleSourceLabel: effectiveSourceLabel,
    hasLocalVisualStyle: visualStyleSource === "local",
    updateVisualStyle: updateSettings,
    clearLocalVisualStyle,
  };
}
