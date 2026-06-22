import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { usePublicConfig } from "@/hooks/usePublicConfig";

export type GradientBackgroundPresetId =
  | "mint"
  | "sky"
  | "rose"
  | "aurora"
  | "graphite"
  | "custom";

export interface GradientBackgroundSettings {
  enabled: boolean;
  preset: GradientBackgroundPresetId;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  angle: number;
  softness: number;
  opacity: number;
  grid: boolean;
  tintSurfaces: boolean;
  surfaceOpacity: number;
}

export interface GradientBackgroundPreset {
  id: Exclude<GradientBackgroundPresetId, "custom">;
  label: string;
  colors: GradientBackgroundSettings["colors"];
  angle: number;
  softness: number;
  opacity: number;
  grid: boolean;
}

export type GradientBackgroundSource = "local" | "global" | "default";

export const GRADIENT_BACKGROUND_PRESETS: GradientBackgroundPreset[] = [
  {
    id: "mint",
    label: "薄荷",
    colors: {
      primary: "#eaf7ef",
      secondary: "#b7ecd0",
      accent: "#d9f5e5",
    },
    angle: 128,
    softness: 34,
    opacity: 92,
    grid: true,
  },
  {
    id: "sky",
    label: "天青",
    colors: {
      primary: "#edf7ff",
      secondary: "#b9ddff",
      accent: "#d8f0ff",
    },
    angle: 142,
    softness: 30,
    opacity: 90,
    grid: true,
  },
  {
    id: "rose",
    label: "晨粉",
    colors: {
      primary: "#fff2f7",
      secondary: "#ffd2e3",
      accent: "#e9dcff",
    },
    angle: 118,
    softness: 32,
    opacity: 88,
    grid: true,
  },
  {
    id: "aurora",
    label: "极光",
    colors: {
      primary: "#10151f",
      secondary: "#31545c",
      accent: "#7e4f9a",
    },
    angle: 135,
    softness: 42,
    opacity: 86,
    grid: false,
  },
  {
    id: "graphite",
    label: "灰白",
    colors: {
      primary: "#f7f8f9",
      secondary: "#dfe7ea",
      accent: "#eef2f3",
    },
    angle: 132,
    softness: 26,
    opacity: 86,
    grid: true,
  },
];

const STORAGE_KEY = "komari-theme-YS:gradient-background";
const DEFAULT_PRESET = GRADIENT_BACKGROUND_PRESETS[0];
export const DEFAULT_GRADIENT_BACKGROUND_SETTINGS: GradientBackgroundSettings = {
  enabled: true,
  preset: DEFAULT_PRESET.id,
  colors: DEFAULT_PRESET.colors,
  angle: DEFAULT_PRESET.angle,
  softness: DEFAULT_PRESET.softness,
  opacity: DEFAULT_PRESET.opacity,
  grid: DEFAULT_PRESET.grid,
  tintSurfaces: true,
  surfaceOpacity: 92,
};

const listeners = new Set<() => void>();
let initialized = false;
let snapshot = DEFAULT_GRADIENT_BACKGROUND_SETTINGS;
let snapshotSource: GradientBackgroundSource = "default";
let hasLocalSettings = false;
let globalFallbackSettings: GradientBackgroundSettings | null = null;

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function normalizeColor(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : fallback;
}

function isPresetId(value: unknown): value is GradientBackgroundPresetId {
  return (
    value === "mint" ||
    value === "sky" ||
    value === "rose" ||
    value === "aurora" ||
    value === "graphite" ||
    value === "custom"
  );
}

export function normalizeGradientBackgroundSettings(value: unknown): GradientBackgroundSettings {
  if (!value || typeof value !== "object") return DEFAULT_GRADIENT_BACKGROUND_SETTINGS;

  const record = value as Partial<GradientBackgroundSettings>;
  const colors =
    record.colors && typeof record.colors === "object"
      ? record.colors
      : DEFAULT_GRADIENT_BACKGROUND_SETTINGS.colors;

  return {
    enabled:
      typeof record.enabled === "boolean"
        ? record.enabled
        : DEFAULT_GRADIENT_BACKGROUND_SETTINGS.enabled,
    preset: isPresetId(record.preset)
      ? record.preset
      : DEFAULT_GRADIENT_BACKGROUND_SETTINGS.preset,
    colors: {
      primary: normalizeColor(colors.primary, DEFAULT_GRADIENT_BACKGROUND_SETTINGS.colors.primary),
      secondary: normalizeColor(
        colors.secondary,
        DEFAULT_GRADIENT_BACKGROUND_SETTINGS.colors.secondary,
      ),
      accent: normalizeColor(colors.accent, DEFAULT_GRADIENT_BACKGROUND_SETTINGS.colors.accent),
    },
    angle: clamp(record.angle, 0, 360, DEFAULT_GRADIENT_BACKGROUND_SETTINGS.angle),
    softness: clamp(record.softness, 0, 80, DEFAULT_GRADIENT_BACKGROUND_SETTINGS.softness),
    opacity: clamp(record.opacity, 10, 200, DEFAULT_GRADIENT_BACKGROUND_SETTINGS.opacity),
    grid:
      typeof record.grid === "boolean"
        ? record.grid
        : DEFAULT_GRADIENT_BACKGROUND_SETTINGS.grid,
    tintSurfaces:
      typeof record.tintSurfaces === "boolean"
        ? record.tintSurfaces
        : DEFAULT_GRADIENT_BACKGROUND_SETTINGS.tintSurfaces,
    surfaceOpacity: clamp(
      record.surfaceOpacity,
      35,
      200,
      DEFAULT_GRADIENT_BACKGROUND_SETTINGS.surfaceOpacity,
    ),
  };
}

function readStoredSettings() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeGradientBackgroundSettings(JSON.parse(raw));
  } catch {
    return null;
  }
}

function persistSettings(value: GradientBackgroundSettings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Keep the in-memory state if localStorage is unavailable.
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function equalSettings(a: GradientBackgroundSettings, b: GradientBackgroundSettings) {
  return (
    a.enabled === b.enabled &&
    a.preset === b.preset &&
    a.colors.primary === b.colors.primary &&
    a.colors.secondary === b.colors.secondary &&
    a.colors.accent === b.colors.accent &&
    a.angle === b.angle &&
    a.softness === b.softness &&
    a.opacity === b.opacity &&
    a.grid === b.grid &&
    a.tintSurfaces === b.tintSurfaces &&
    a.surfaceOpacity === b.surfaceOpacity
  );
}

function setSnapshot(
  value:
    | GradientBackgroundSettings
    | ((current: GradientBackgroundSettings) => GradientBackgroundSettings),
  persist = true,
  source: GradientBackgroundSource = persist ? "local" : snapshotSource,
) {
  const next = normalizeGradientBackgroundSettings(
    typeof value === "function" ? value(snapshot) : value,
  );
  if (persist) {
    hasLocalSettings = true;
  }
  const settingsUnchanged = equalSettings(next, snapshot);
  if (settingsUnchanged && snapshotSource === source) return;
  snapshot = settingsUnchanged ? { ...next, colors: { ...next.colors } } : next;
  snapshotSource = source;
  if (persist && typeof window !== "undefined") {
    persistSettings(next);
  }
  emit();
}

function getFallbackSettings() {
  return globalFallbackSettings ?? DEFAULT_GRADIENT_BACKGROUND_SETTINGS;
}

function getFallbackSource(): GradientBackgroundSource {
  return globalFallbackSettings ? "global" : "default";
}

function applyFallbackSettings(settings: unknown) {
  globalFallbackSettings =
    settings && typeof settings === "object"
      ? normalizeGradientBackgroundSettings(settings)
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

export function presetToGradientSettings(
  preset: GradientBackgroundPreset,
  base: GradientBackgroundSettings = snapshot,
): GradientBackgroundSettings {
  const normalizedBase = normalizeGradientBackgroundSettings(base);
  return {
    enabled: true,
    preset: preset.id,
    colors: preset.colors,
    angle: preset.angle,
    softness: preset.softness,
    opacity: preset.opacity,
    grid: preset.grid,
    tintSurfaces: normalizedBase.tintSurfaces,
    surfaceOpacity: normalizedBase.surfaceOpacity,
  };
}

export function serializeGradientBackgroundSettings(settings: GradientBackgroundSettings) {
  return JSON.stringify(normalizeGradientBackgroundSettings(settings));
}

export function useGradientBackground() {
  initIfNeeded();
  const { data: config } = usePublicConfig();
  const globalSettings = config?.theme_settings?.gradientBackground;
  const settings = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const serializedGlobalSettings = useMemo(
    () => serializeGradientBackgroundSettings(normalizeGradientBackgroundSettings(globalSettings)),
    [globalSettings],
  );

  useEffect(() => {
    applyFallbackSettings(globalSettings);
  }, [globalSettings, serializedGlobalSettings]);

  const updateSettings = useCallback(
    (
      patch:
        | Partial<GradientBackgroundSettings>
        | ((current: GradientBackgroundSettings) => GradientBackgroundSettings),
    ) => {
      setSnapshot((current) =>
        typeof patch === "function"
          ? patch(current)
          : normalizeGradientBackgroundSettings({ ...current, ...patch }),
      );
    },
    [],
  );

  const resetSettings = useCallback(() => {
    setSnapshot(DEFAULT_GRADIENT_BACKGROUND_SETTINGS);
  }, []);

  const clearLocalGradientBackground = useCallback(() => {
    clearLocalSettings(config?.theme_settings?.gradientBackground);
  }, [config?.theme_settings?.gradientBackground]);

  const gradientBackgroundSource = hasLocalSettings
    ? "local"
    : globalFallbackSettings
      ? "global"
      : "default";

  const hasLocalGradientBackground = gradientBackgroundSource === "local";

  const effectiveSource = snapshotSource === gradientBackgroundSource
    ? snapshotSource
    : gradientBackgroundSource;

  const effectiveSourceLabel =
    effectiveSource === "local"
      ? "本机外观"
      : effectiveSource === "global"
        ? "全站默认"
        : "主题默认";

  return {
    gradientBackground: settings,
    gradientBackgroundSource: effectiveSource,
    gradientBackgroundSourceLabel: effectiveSourceLabel,
    hasLocalGradientBackground,
    updateGradientBackground: updateSettings,
    resetGradientBackground: resetSettings,
    clearLocalGradientBackground,
  };
}
