import { useCallback, useSyncExternalStore } from "react";

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
const DEFAULT_SETTINGS: GradientBackgroundSettings = {
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
let snapshot = DEFAULT_SETTINGS;

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

function normalizeSettings(value: unknown): GradientBackgroundSettings {
  if (!value || typeof value !== "object") return DEFAULT_SETTINGS;

  const record = value as Partial<GradientBackgroundSettings>;
  const colors =
    record.colors && typeof record.colors === "object"
      ? record.colors
      : DEFAULT_SETTINGS.colors;

  return {
    enabled: typeof record.enabled === "boolean" ? record.enabled : DEFAULT_SETTINGS.enabled,
    preset: isPresetId(record.preset) ? record.preset : DEFAULT_SETTINGS.preset,
    colors: {
      primary: normalizeColor(colors.primary, DEFAULT_SETTINGS.colors.primary),
      secondary: normalizeColor(colors.secondary, DEFAULT_SETTINGS.colors.secondary),
      accent: normalizeColor(colors.accent, DEFAULT_SETTINGS.colors.accent),
    },
    angle: clamp(record.angle, 0, 360, DEFAULT_SETTINGS.angle),
    softness: clamp(record.softness, 0, 80, DEFAULT_SETTINGS.softness),
    opacity: clamp(record.opacity, 10, 200, DEFAULT_SETTINGS.opacity),
    grid: typeof record.grid === "boolean" ? record.grid : DEFAULT_SETTINGS.grid,
    tintSurfaces:
      typeof record.tintSurfaces === "boolean"
        ? record.tintSurfaces
        : DEFAULT_SETTINGS.tintSurfaces,
    surfaceOpacity: clamp(record.surfaceOpacity, 35, 200, DEFAULT_SETTINGS.surfaceOpacity),
  };
}

function readStoredSettings() {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
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

function setSnapshot(
  value:
    | GradientBackgroundSettings
    | ((current: GradientBackgroundSettings) => GradientBackgroundSettings),
  persist = true,
) {
  const next = normalizeSettings(typeof value === "function" ? value(snapshot) : value);
  if (JSON.stringify(next) === JSON.stringify(snapshot)) return;
  snapshot = next;
  if (persist && typeof window !== "undefined") {
    persistSettings(next);
  }
  emit();
}

function initIfNeeded() {
  if (initialized) return;
  initialized = true;
  snapshot = readStoredSettings();

  if (typeof window === "undefined") return;
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    setSnapshot(readStoredSettings(), false);
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
): GradientBackgroundSettings {
  return {
    enabled: true,
    preset: preset.id,
    colors: preset.colors,
    angle: preset.angle,
    softness: preset.softness,
    opacity: preset.opacity,
    grid: preset.grid,
    tintSurfaces: snapshot.tintSurfaces,
    surfaceOpacity: snapshot.surfaceOpacity,
  };
}

export function useGradientBackground() {
  initIfNeeded();
  const settings = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const updateSettings = useCallback(
    (
      patch:
        | Partial<GradientBackgroundSettings>
        | ((current: GradientBackgroundSettings) => GradientBackgroundSettings),
    ) => {
      setSnapshot((current) =>
        typeof patch === "function"
          ? patch(current)
          : normalizeSettings({ ...current, ...patch }),
      );
    },
    [],
  );

  const resetSettings = useCallback(() => {
    setSnapshot(DEFAULT_SETTINGS);
  }, []);

  return {
    gradientBackground: settings,
    updateGradientBackground: updateSettings,
    resetGradientBackground: resetSettings,
  };
}
