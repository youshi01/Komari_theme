import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { usePublicConfig } from "@/hooks/usePublicConfig";

export type CardStylePresetId =
  | "panel"
  | "glass"
  | "neon"
  | "soft"
  | "minimal";
export type DashboardStylePresetId =
  | "bars"
  | "arc"
  | "ring"
  | "dial";
export type TunableDashboardStyleId = Exclude<DashboardStylePresetId, "bars">;
export type GaugeStylePresetId =
  | "clean"
  | "neon"
  | "segmented"
  | "soft"
  | "minimal"
  | "fragment"
  | "pulse"
  | "liquid"
  | "circuit"
  | "wave"
  | "dual"
  | "aurora"
  | "scan";
export type MarqueePalettePresetId =
  | "health"
  | "tech"
  | "neon"
  | "pastel"
  | "status"
  | "custom";
export type MarqueeShapeId =
  | "classic"
  | "aurora"
  | "circuit"
  | "neon"
  | "equalizer";
export type MarqueeStylePresetId = MarqueeShapeId | "custom";
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

export interface MarqueeStyleSettings {
  preset: MarqueeStylePresetId;
  shape: MarqueeShapeId;
  density: number;
  radius: number;
  glow: number;
  motion: number;
}

export interface ArcDashboardSettings {
  gaugeStyle: GaugeStylePresetId;
  thickness: number;
  glow: number;
  motion: number;
  compactness: number;
}

export interface RingDashboardSettings {
  gaugeStyle: GaugeStylePresetId;
  thickness: number;
  centerScale: number;
  glow: number;
  motion: number;
}

export interface DialDashboardSettings {
  gaugeStyle: GaugeStylePresetId;
  thickness: number;
  needle: number;
  ticks: number;
  glow: number;
  motion: number;
}

export interface DashboardSettings {
  arc: ArcDashboardSettings;
  ring: RingDashboardSettings;
  dial: DialDashboardSettings;
}

export interface VisualStyleSettings {
  cardStyle: CardStylePresetId;
  dashboardStyle: DashboardStylePresetId;
  dashboardSettings: DashboardSettings;
  radarLatencyMaxMs: number;
  marqueePalette: MarqueePalettePresetId;
  marqueeStyle: MarqueeStyleSettings;
  colors: VisualMetricColors;
}

export interface CardStylePreset {
  id: CardStylePresetId;
  label: string;
  description: string;
}

export interface DashboardStylePreset {
  id: DashboardStylePresetId;
  label: string;
  description: string;
}

export interface GaugeStylePreset {
  id: GaugeStylePresetId;
  label: string;
  description: string;
}

export interface MarqueePalettePreset {
  id: Exclude<MarqueePalettePresetId, "custom">;
  label: string;
  description: string;
  colors: VisualMetricColors;
}

export interface MarqueeStylePreset {
  id: Exclude<MarqueeStylePresetId, "custom">;
  label: string;
  description: string;
  settings: MarqueeStyleSettings;
}

export interface DashboardTuningControl {
  key: string;
  label: string;
  max?: number;
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

export const DASHBOARD_STYLE_PRESETS: DashboardStylePreset[] = [
  {
    id: "bars",
    label: "数据条",
    description: "保留原来的条形数据布局，信息密度最高",
  },
  {
    id: "arc",
    label: "弧光仪表",
    description: "180度半弧开合，突出实时状态变化",
  },
  {
    id: "ring",
    label: "全环仪表",
    description: "完整圆环读数，更像监控大屏",
  },
  {
    id: "dial",
    label: "指针仪表",
    description: "用指针角度表达强弱，状态感更明显",
  },
];

export const GAUGE_STYLE_PRESETS: GaugeStylePreset[] = [
  {
    id: "clean",
    label: "清透光环",
    description: "保留当前读数感，干净、轻量、通用",
  },
  {
    id: "neon",
    label: "霓虹双轨",
    description: "高亮外晕和双层轨道，更适合暗色背景",
  },
  {
    id: "segmented",
    label: "分段刻度",
    description: "环线带刻度断点，状态变化更有监控感",
  },
  {
    id: "soft",
    label: "柔光厚环",
    description: "更厚的柔和色块，配渐变背板更统一",
  },
  {
    id: "minimal",
    label: "极简细线",
    description: "弱化装饰和边框，优先突出数字",
  },
  {
    id: "fragment",
    label: "碎片轨道",
    description: "不规则断片和错位轨道，像数据被切开",
  },
  {
    id: "pulse",
    label: "脉冲齿环",
    description: "外圈齿状刻度持续脉冲，监控感更强",
  },
  {
    id: "liquid",
    label: "液态胶囊",
    description: "厚环、流体端点和柔和漂浮感，更艺术",
  },
  {
    id: "circuit",
    label: "电路星轨",
    description: "环线接入节点和短线，像设备数据总线",
  },
  {
    id: "wave",
    label: "声波脉冲",
    description: "环外带微动声波柱，适合实时状态变化",
  },
  {
    id: "dual",
    label: "双轨错位",
    description: "内外双轨不同步运动，层次和速度感更明显",
  },
  {
    id: "aurora",
    label: "极光丝带环",
    description: "宽窄叠层和丝带扫光，配背景板更有氛围",
  },
  {
    id: "scan",
    label: "断点扫描",
    description: "断点刻度加扫描拖尾，突出当前进度头",
  },
];

export const DASHBOARD_TUNING_CONTROLS: Record<
  TunableDashboardStyleId,
  DashboardTuningControl[]
> = {
  arc: [
    { key: "thickness", label: "弧线粗细" },
    { key: "glow", label: "弧光强度", max: 200 },
    { key: "motion", label: "动效强度", max: 200 },
    { key: "compactness", label: "紧凑度" },
  ],
  ring: [
    { key: "thickness", label: "环宽" },
    { key: "centerScale", label: "中心数值" },
    { key: "glow", label: "光晕强度", max: 200 },
    { key: "motion", label: "动效强度", max: 200 },
  ],
  dial: [
    { key: "thickness", label: "弧线粗细" },
    { key: "needle", label: "指针粗细" },
    { key: "ticks", label: "刻度强度" },
    { key: "glow", label: "光晕强度", max: 200 },
    { key: "motion", label: "动效强度", max: 200 },
  ],
};

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

export const MARQUEE_STYLE_PRESETS: MarqueeStylePreset[] = [
  {
    id: "classic",
    label: "经典点阵",
    description: "稳定耐看，接近原始跑马灯",
    settings: {
      preset: "classic",
      shape: "classic",
      density: 45,
      radius: 55,
      glow: 12,
      motion: 0,
    },
  },
  {
    id: "aurora",
    label: "极光丝带",
    description: "柔和连线与轻微流动",
    settings: {
      preset: "aurora",
      shape: "aurora",
      density: 64,
      radius: 100,
      glow: 58,
      motion: 46,
    },
  },
  {
    id: "circuit",
    label: "电路线条",
    description: "硬朗折线、节点闪烁",
    settings: {
      preset: "circuit",
      shape: "circuit",
      density: 78,
      radius: 8,
      glow: 30,
      motion: 34,
    },
  },
  {
    id: "neon",
    label: "霓虹脉冲",
    description: "高亮胶囊与呼吸光晕",
    settings: {
      preset: "neon",
      shape: "neon",
      density: 52,
      radius: 100,
      glow: 88,
      motion: 72,
    },
  },
  {
    id: "equalizer",
    label: "均衡器方块",
    description: "堆叠块状，节奏感更强",
    settings: {
      preset: "equalizer",
      shape: "equalizer",
      density: 70,
      radius: 28,
      glow: 36,
      motion: 54,
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
export const RADAR_LATENCY_MAX_MIN_MS = 100;
export const RADAR_LATENCY_MAX_MAX_MS = 5000;
export const RADAR_LATENCY_MAX_STEP_MS = 100;
export const DEFAULT_MARQUEE_STYLE_SETTINGS =
  MARQUEE_STYLE_PRESETS[0].settings;
export const DEFAULT_DASHBOARD_SETTINGS: DashboardSettings = {
  arc: {
    gaugeStyle: "clean",
    thickness: 48,
    glow: 38,
    motion: 42,
    compactness: 42,
  },
  ring: {
    gaugeStyle: "clean",
    thickness: 46,
    centerScale: 54,
    glow: 34,
    motion: 38,
  },
  dial: {
    gaugeStyle: "clean",
    thickness: 42,
    needle: 50,
    ticks: 56,
    glow: 36,
    motion: 48,
  },
};
export const DEFAULT_VISUAL_STYLE_SETTINGS: VisualStyleSettings = {
  cardStyle: "panel",
  dashboardStyle: "bars",
  dashboardSettings: DEFAULT_DASHBOARD_SETTINGS,
  radarLatencyMaxMs: 1000,
  marqueePalette: "health",
  marqueeStyle: DEFAULT_MARQUEE_STYLE_SETTINGS,
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

function isDashboardStyle(value: unknown): value is DashboardStylePresetId {
  return (
    value === "bars" ||
    value === "arc" ||
    value === "ring" ||
    value === "dial"
  );
}

function isGaugeStylePreset(value: unknown): value is GaugeStylePresetId {
  return (
    value === "clean" ||
    value === "neon" ||
    value === "segmented" ||
    value === "soft" ||
    value === "minimal" ||
    value === "fragment" ||
    value === "pulse" ||
    value === "liquid" ||
    value === "circuit" ||
    value === "wave" ||
    value === "dual" ||
    value === "aurora" ||
    value === "scan"
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

function isMarqueeShape(value: unknown): value is MarqueeShapeId {
  return (
    value === "classic" ||
    value === "aurora" ||
    value === "circuit" ||
    value === "neon" ||
    value === "equalizer"
  );
}

function isMarqueeStyle(value: unknown): value is MarqueeStylePresetId {
  return isMarqueeShape(value) || value === "custom";
}

function getMarqueePalette(id: MarqueePalettePresetId) {
  return (
    MARQUEE_PALETTE_PRESETS.find((preset) => preset.id === id) ??
    MARQUEE_PALETTE_PRESETS[0]
  );
}

function getMarqueeStylePreset(id: MarqueeStylePresetId) {
  return (
    MARQUEE_STYLE_PRESETS.find((preset) => preset.id === id) ??
    MARQUEE_STYLE_PRESETS[0]
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

function normalizePercentWithMax(value: unknown, fallback: number, max: number) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(max, Math.round(numeric)));
}

function normalizePercent(value: unknown, fallback: number) {
  return normalizePercentWithMax(value, fallback, 100);
}

function normalizePercent200(value: unknown, fallback: number) {
  return normalizePercentWithMax(value, fallback, 200);
}

function normalizeRadarLatencyMaxMs(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_VISUAL_STYLE_SETTINGS.radarLatencyMaxMs;
  const stepped =
    Math.round(numeric / RADAR_LATENCY_MAX_STEP_MS) * RADAR_LATENCY_MAX_STEP_MS;
  return Math.max(
    RADAR_LATENCY_MAX_MIN_MS,
    Math.min(RADAR_LATENCY_MAX_MAX_MS, stepped),
  );
}

export function normalizeMarqueeStyleSettings(
  value: unknown,
): MarqueeStyleSettings {
  if (!isSettingsObject(value)) return DEFAULT_MARQUEE_STYLE_SETTINGS;
  const record = value as Partial<MarqueeStyleSettings>;
  const preset = isMarqueeStyle(record.preset)
    ? record.preset
    : DEFAULT_MARQUEE_STYLE_SETTINGS.preset;
  const presetSettings =
    preset === "custom"
      ? DEFAULT_MARQUEE_STYLE_SETTINGS
      : getMarqueeStylePreset(preset).settings;

  return {
    preset,
    shape: isMarqueeShape(record.shape) ? record.shape : presetSettings.shape,
    density: normalizePercent(record.density, presetSettings.density),
    radius: normalizePercent(record.radius, presetSettings.radius),
    glow: normalizePercent(record.glow, presetSettings.glow),
    motion: normalizePercent(record.motion, presetSettings.motion),
  };
}

function normalizeArcDashboardSettings(value: unknown): ArcDashboardSettings {
  const fallback = DEFAULT_DASHBOARD_SETTINGS.arc;
  const record = isSettingsObject(value) ? (value as Partial<ArcDashboardSettings>) : {};
  return {
    gaugeStyle: isGaugeStylePreset(record.gaugeStyle)
      ? record.gaugeStyle
      : fallback.gaugeStyle,
    thickness: normalizePercent(record.thickness, fallback.thickness),
    glow: normalizePercent200(record.glow, fallback.glow),
    motion: normalizePercent200(record.motion, fallback.motion),
    compactness: normalizePercent(record.compactness, fallback.compactness),
  };
}

function normalizeRingDashboardSettings(value: unknown): RingDashboardSettings {
  const fallback = DEFAULT_DASHBOARD_SETTINGS.ring;
  const record = isSettingsObject(value) ? (value as Partial<RingDashboardSettings>) : {};
  return {
    gaugeStyle: isGaugeStylePreset(record.gaugeStyle)
      ? record.gaugeStyle
      : fallback.gaugeStyle,
    thickness: normalizePercent(record.thickness, fallback.thickness),
    centerScale: normalizePercent(record.centerScale, fallback.centerScale),
    glow: normalizePercent200(record.glow, fallback.glow),
    motion: normalizePercent200(record.motion, fallback.motion),
  };
}

function normalizeDialDashboardSettings(value: unknown): DialDashboardSettings {
  const fallback = DEFAULT_DASHBOARD_SETTINGS.dial;
  const record = isSettingsObject(value) ? (value as Partial<DialDashboardSettings>) : {};
  return {
    gaugeStyle: isGaugeStylePreset(record.gaugeStyle)
      ? record.gaugeStyle
      : fallback.gaugeStyle,
    thickness: normalizePercent(record.thickness, fallback.thickness),
    needle: normalizePercent(record.needle, fallback.needle),
    ticks: normalizePercent(record.ticks, fallback.ticks),
    glow: normalizePercent200(record.glow, fallback.glow),
    motion: normalizePercent200(record.motion, fallback.motion),
  };
}

export function normalizeDashboardSettings(value: unknown): DashboardSettings {
  const record = isSettingsObject(value) ? (value as Partial<DashboardSettings>) : {};
  return {
    arc: normalizeArcDashboardSettings(record.arc),
    ring: normalizeRingDashboardSettings(record.ring),
    dial: normalizeDialDashboardSettings(record.dial),
  };
}

export function patchDashboardSetting(
  settings: DashboardSettings,
  style: TunableDashboardStyleId,
  key: string,
  value: unknown,
) {
  return normalizeDashboardSettings({
    ...settings,
    [style]: {
      ...settings[style],
      [key]: value,
    },
  });
}

export function normalizeVisualStyleSettings(value: unknown): VisualStyleSettings {
  if (!isSettingsObject(value)) return DEFAULT_VISUAL_STYLE_SETTINGS;
  const record = value as Record<string, unknown>;
  const legacyRadarCardStyle = record.cardStyle === "radar";
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
    dashboardStyle: isDashboardStyle(record.dashboardStyle)
      ? record.dashboardStyle
      : legacyRadarCardStyle
        ? "arc"
        : DEFAULT_VISUAL_STYLE_SETTINGS.dashboardStyle,
    dashboardSettings: normalizeDashboardSettings(record.dashboardSettings),
    radarLatencyMaxMs: normalizeRadarLatencyMaxMs(record.radarLatencyMaxMs),
    marqueePalette,
    marqueeStyle: normalizeMarqueeStyleSettings(record.marqueeStyle),
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
  root.dataset.dashboardStyle = normalized.dashboardStyle;
  root.dataset.marqueePalette = normalized.marqueePalette;
  root.dataset.marqueeStyle = normalized.marqueeStyle.shape;
  root.style.setProperty("--ys-radar-latency-max-ms", `${normalized.radarLatencyMaxMs}`);
  root.style.setProperty("--ys-marquee-density", `${normalized.marqueeStyle.density}`);
  root.style.setProperty("--ys-marquee-radius", `${normalized.marqueeStyle.radius}`);
  root.style.setProperty("--ys-marquee-glow", `${normalized.marqueeStyle.glow}`);
  root.style.setProperty("--ys-marquee-motion", `${normalized.marqueeStyle.motion}`);
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
