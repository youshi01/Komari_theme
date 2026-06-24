import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  Cpu,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  ImageOff,
  Layers,
  Monitor,
  Moon,
  Palette,
  Settings,
  SlidersHorizontal,
  Sun,
  Wallpaper,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { usePreferences } from "@/hooks/usePreferences";
import { useBackgroundBoardToggle } from "@/hooks/useBackgroundBoardToggle";
import { useNodeSort } from "@/hooks/useNodeSort";
import {
  GRADIENT_BACKGROUND_PRESETS,
  presetToGradientSettings,
  useGradientBackground,
} from "@/hooks/useGradientBackground";
import {
  CARD_STYLE_PRESETS,
  DASHBOARD_STYLE_PRESETS,
  DASHBOARD_TUNING_CONTROLS,
  GAUGE_STYLE_PRESETS,
  MARQUEE_PALETTE_PRESETS,
  MARQUEE_STYLE_PRESETS,
  RADAR_LATENCY_MAX_MAX_MS,
  RADAR_LATENCY_MAX_MIN_MS,
  RADAR_LATENCY_MAX_STEP_MS,
  VISUAL_COLOR_CONTROLS,
  patchDashboardSetting,
  useVisualStyle,
} from "@/hooks/useVisualStyle";
import { MarqueePreviewStrip } from "@/components/node/MarqueePreviewStrip";
import {
  HOMEPAGE_NODE_SORT_OPTIONS,
  NODE_SORT_INTERVAL_OPTIONS,
  isRealtimeNodeSortMode,
} from "@/utils/nodeSort";
import { useNodeStoreStatus } from "@/hooks/useNode";
import { useAuth } from "@/hooks/useAuth";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import {
  getBackgroundSources,
  normalizeBackgroundSettings,
} from "@/utils/backgroundSettings";
import { clsx } from "clsx";

const APPEARANCE_OPTIONS = [
  { value: "light", icon: Sun, label: "浅色" },
  { value: "system", icon: Monitor, label: "跟随系统" },
  { value: "dark", icon: Moon, label: "深色" },
] as const;
const VISUAL_STYLE_QUICK_TABS = [
  { id: "card", label: "卡片外壳" },
  { id: "dashboard", label: "信息展板" },
  { id: "palette", label: "配色" },
] as const;
type VisualStyleQuickTab = (typeof VISUAL_STYLE_QUICK_TABS)[number]["id"];
const COLLAPSED_STORAGE_KEY = "komari-theme-YS:floating-controls-collapsed";

function readStoredCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function persistCollapsed(value: boolean) {
  try {
    localStorage.setItem(COLLAPSED_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Keep the in-memory state if localStorage is unavailable.
  }
}

export function FloatingControls() {
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const { appearance, setAppearance } = usePreferences();
  const { backgroundBoardVisible, toggleBackgroundBoardVisible } =
    useBackgroundBoardToggle();
  const {
    gradientBackground,
    gradientBackgroundSourceLabel,
    hasLocalGradientBackground,
    updateGradientBackground,
    clearLocalGradientBackground,
  } = useGradientBackground();
  const {
    visualStyle,
    visualStyleSourceLabel,
    hasLocalVisualStyle,
    updateVisualStyle,
    clearLocalVisualStyle,
  } = useVisualStyle();
  const {
    nodeSort,
    nodeSortSourceLabel,
    hasLocalNodeSort,
    updateNodeSort,
    clearLocalNodeSort,
  } = useNodeSort();
  const { data: me } = useAuth();
  const { data: config } = usePublicConfig();
  const { failureStreak } = useNodeStoreStatus();
  const [searchParams] = useSearchParams();
  const [collapsed, setCollapsed] = useState(readStoredCollapsed);
  const [gradientPanelOpen, setGradientPanelOpen] = useState(false);
  const [stylePanelOpen, setStylePanelOpen] = useState(false);
  const [sortPanelOpen, setSortPanelOpen] = useState(false);
  const [visualStyleTab, setVisualStyleTab] =
    useState<VisualStyleQuickTab>("card");
  const anyPanelOpen = gradientPanelOpen || stylePanelOpen || sortPanelOpen;
  const showAdmin = config?.theme_settings?.enableAdminButton !== false;
  const showThemeManage = Boolean(me?.logged_in);
  const isThemeManageView = searchParams.get("view") === "theme-manage";
  const showSyncWarning = failureStreak >= 2;
  const hiddenTabIndex = collapsed ? -1 : undefined;
  const ToggleIcon = collapsed ? ChevronLeft : ChevronRight;
  const backgroundSettings = useMemo(
    () => normalizeBackgroundSettings(config?.theme_settings?.background),
    [config?.theme_settings?.background],
  );
  const backgroundSources = useMemo(
    () => getBackgroundSources(backgroundSettings),
    [backgroundSettings],
  );
  const hasImageBackground = backgroundSettings.enabled && backgroundSources.length > 0;
  const effectiveBackgroundVisible = hasImageBackground && backgroundBoardVisible;
  const BackgroundIcon = effectiveBackgroundVisible ? Wallpaper : ImageOff;
  const backgroundToggleTitle = hasImageBackground
    ? effectiveBackgroundVisible
      ? "隐藏图片背景"
      : "显示图片背景"
    : backgroundSettings.enabled
      ? "先添加图片背景"
      : "先在主题设置启用图片背景";
  const activeDashboardStyle =
    visualStyle.dashboardStyle === "bars" ? null : visualStyle.dashboardStyle;

  useEffect(() => {
    if (!anyPanelOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (controlsRef.current?.contains(target)) return;

      setGradientPanelOpen(false);
      setStylePanelOpen(false);
      setSortPanelOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [anyPanelOpen]);

  if (isThemeManageView) {
    return null;
  }

  return (
    <div
      ref={controlsRef}
      className={clsx(
        "floating-controls",
        collapsed && "is-collapsed",
        showSyncWarning && "has-warning",
      )}
    >
      <div className="floating-controls-inner">
        <div className="floating-controls-row">
          <div className="floating-controls-actions" aria-hidden={collapsed}>
            <div
              className="control-group"
              role="group"
              aria-label="外观选择"
            >
              {APPEARANCE_OPTIONS.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAppearance(value)}
                  aria-label={label}
                  aria-pressed={appearance === value}
                  title={label}
                  tabIndex={hiddenTabIndex}
                  className={clsx(
                    "control-button control-toggle grid h-9 w-9 place-items-center",
                    appearance === value && "is-active",
                  )}
                >
                  <Icon size={16} />
                </button>
              ))}
              <button
                type="button"
                onClick={toggleBackgroundBoardVisible}
                aria-label={backgroundToggleTitle}
                aria-pressed={effectiveBackgroundVisible}
                title={backgroundToggleTitle}
                tabIndex={hiddenTabIndex}
                disabled={!hasImageBackground}
                className={clsx(
                  "control-button control-toggle grid h-9 w-9 place-items-center",
                  effectiveBackgroundVisible && "is-active",
                )}
              >
                <BackgroundIcon size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setGradientPanelOpen((open) => !open);
                  setStylePanelOpen(false);
                  setSortPanelOpen(false);
                }}
                aria-label="渐变背板"
                aria-expanded={gradientPanelOpen}
                title="渐变背板"
                tabIndex={hiddenTabIndex}
                className={clsx(
                  "control-button control-toggle grid h-9 w-9 place-items-center",
                  (gradientPanelOpen || gradientBackground.enabled) && "is-active",
                )}
              >
                <Palette size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setStylePanelOpen((open) => !open);
                  setGradientPanelOpen(false);
                  setSortPanelOpen(false);
                }}
                aria-label="卡片样式"
                aria-expanded={stylePanelOpen}
                title="卡片样式"
                tabIndex={hiddenTabIndex}
                className={clsx(
                  "control-button control-toggle grid h-9 w-9 place-items-center",
                  (stylePanelOpen || hasLocalVisualStyle) && "is-active",
                )}
              >
                <Layers size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setSortPanelOpen((open) => !open);
                  setGradientPanelOpen(false);
                  setStylePanelOpen(false);
                }}
                aria-label="首页排序"
                aria-expanded={sortPanelOpen}
                title="首页排序"
                tabIndex={hiddenTabIndex}
                className={clsx(
                  "control-button control-toggle grid h-9 w-9 place-items-center",
                  (sortPanelOpen || hasLocalNodeSort) && "is-active",
                )}
              >
                <ArrowUpDown size={16} />
              </button>
            </div>
            {showThemeManage && (
              <Link
                to="/?view=theme-manage"
                aria-label="主题设置"
                title="主题设置"
                tabIndex={hiddenTabIndex}
                className={clsx(
                  "control-button grid h-9 w-9 place-items-center",
                  isThemeManageView && "control-toggle is-active",
                )}
              >
                <SlidersHorizontal size={16} />
              </Link>
            )}
            {showAdmin && (
              <a
                href="/admin"
                aria-label={me?.logged_in ? "管理" : "后台登录"}
                title={me?.logged_in ? "管理" : "后台登录"}
                tabIndex={hiddenTabIndex}
                className="control-button grid h-9 w-9 place-items-center"
              >
                <Settings size={16} />
              </a>
            )}
          </div>
          <button
            type="button"
            className="control-button floating-controls-trigger grid h-9 w-9 place-items-center"
            aria-label={collapsed ? "展开快捷按钮" : "收起快捷按钮"}
            aria-expanded={!collapsed}
            onClick={() => {
              setCollapsed((value) => {
                const next = !value;
                persistCollapsed(next);
                if (next) {
                  setGradientPanelOpen(false);
                  setStylePanelOpen(false);
                  setSortPanelOpen(false);
                }
                return next;
              });
            }}
            title={collapsed ? "展开快捷按钮" : "收起快捷按钮"}
          >
            <ToggleIcon size={16} />
            {showSyncWarning && collapsed && (
              <span className="floating-controls-warning-dot" aria-hidden />
            )}
          </button>
        </div>
        {gradientPanelOpen && !collapsed && (
          <div className="gradient-quick-panel">
            <div className="gradient-quick-panel-head">
              <div>
                <div className="gradient-quick-title">渐变背板</div>
                <div className="gradient-quick-subtitle">
                  {gradientBackground.enabled ? "已启用" : "已关闭"} · {gradientBackgroundSourceLabel}
                </div>
              </div>
              <button
                type="button"
                className="instance-toggle-button instance-switch-button gradient-panel-switch"
                data-active={gradientBackground.enabled ? "true" : "false"}
                onClick={() =>
                  updateGradientBackground({ enabled: !gradientBackground.enabled })
                }
                aria-pressed={gradientBackground.enabled}
              >
                <span className="instance-switch-track" aria-hidden>
                  <span className="instance-switch-thumb" />
                </span>
                <span className="instance-switch-state">
                  {gradientBackground.enabled ? "开启" : "关闭"}
                </span>
              </button>
            </div>

            <div className="gradient-preset-grid" aria-label="渐变预设">
              {GRADIENT_BACKGROUND_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={clsx(
                    "gradient-preset-button",
                    gradientBackground.preset === preset.id && "is-active",
                  )}
                  onClick={() => updateGradientBackground(presetToGradientSettings(preset))}
                  title={preset.label}
                  aria-label={preset.label}
                >
                  <span
                    className="gradient-preset-swatch"
                    style={{
                      background: `linear-gradient(${preset.angle}deg, ${preset.colors.primary}, ${preset.colors.secondary} 58%, ${preset.colors.accent})`,
                    }}
                    aria-hidden
                  />
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>

            <div className="gradient-color-grid">
              {([
                ["primary", "主色"],
                ["secondary", "辅色"],
                ["accent", "点缀"],
              ] as const).map(([key, label]) => (
                <label key={key} className="gradient-color-control">
                  <span>{label}</span>
                  <input
                    type="color"
                    value={gradientBackground.colors[key]}
                    onChange={(event) =>
                      updateGradientBackground((current) => ({
                        ...current,
                        preset: "custom",
                        colors: {
                          ...current.colors,
                          [key]: event.target.value,
                        },
                      }))
                    }
                    aria-label={label}
                  />
                </label>
              ))}
            </div>

            <label className="gradient-range-control">
              <span>
                <span>角度</span>
                <strong>{gradientBackground.angle}°</strong>
              </span>
              <input
                type="range"
                min={0}
                max={360}
                value={gradientBackground.angle}
                onChange={(event) =>
                  updateGradientBackground({
                    preset: "custom",
                    angle: Number(event.target.value),
                  })
                }
              />
            </label>

            <label className="gradient-range-control">
              <span>
                <span>柔和</span>
                <strong>{gradientBackground.softness}px</strong>
              </span>
              <input
                type="range"
                min={0}
                max={80}
                value={gradientBackground.softness}
                onChange={(event) =>
                  updateGradientBackground({
                    preset: "custom",
                    softness: Number(event.target.value),
                  })
                }
              />
            </label>

            <label className="gradient-range-control">
              <span>
                <span>透明</span>
                <strong>{gradientBackground.opacity}%</strong>
              </span>
              <input
                type="range"
                min={10}
                max={200}
                value={gradientBackground.opacity}
                onChange={(event) =>
                  updateGradientBackground({
                    preset: "custom",
                    opacity: Number(event.target.value),
                  })
                }
              />
            </label>

            <div className="gradient-surface-sync">
              <div>
                <div className="gradient-surface-title">同步卡片色彩</div>
                <div className="gradient-surface-subtitle">
                  节点卡片和总览会跟随当前渐变
                </div>
              </div>
              <button
                type="button"
                className="instance-toggle-button instance-switch-button gradient-panel-switch"
                data-active={gradientBackground.tintSurfaces ? "true" : "false"}
                onClick={() =>
                  updateGradientBackground({
                    tintSurfaces: !gradientBackground.tintSurfaces,
                  })
                }
                aria-pressed={gradientBackground.tintSurfaces}
              >
                <span className="instance-switch-track" aria-hidden>
                  <span className="instance-switch-thumb" />
                </span>
                <span className="instance-switch-state">
                  {gradientBackground.tintSurfaces ? "开启" : "关闭"}
                </span>
              </button>
            </div>

            <label className="gradient-range-control">
              <span>
                <span>色块强度</span>
                <strong>{gradientBackground.surfaceOpacity}%</strong>
              </span>
              <input
                type="range"
                min={35}
                max={200}
                value={gradientBackground.surfaceOpacity}
                disabled={!gradientBackground.tintSurfaces}
                onChange={(event) =>
                  updateGradientBackground({
                    surfaceOpacity: Number(event.target.value),
                  })
                }
              />
            </label>

            <div className="gradient-panel-actions">
              <button
                type="button"
                className="theme-manage-button is-compact"
                onClick={() =>
                  updateGradientBackground({
                    preset: "custom",
                    grid: !gradientBackground.grid,
                  })
                }
                data-active={gradientBackground.grid ? "true" : "false"}
              >
                <Grid2X2 size={13} />
                <span>{gradientBackground.grid ? "网格开" : "网格关"}</span>
              </button>
              <button
                type="button"
                className="theme-manage-button is-compact"
                onClick={clearLocalGradientBackground}
                disabled={!hasLocalGradientBackground}
                title={hasLocalGradientBackground ? "恢复全站默认" : "当前已经是默认样式"}
              >
                <span>恢复全站默认</span>
              </button>
            </div>
          </div>
        )}
        {stylePanelOpen && !collapsed && (
          <div
            className={clsx(
              "visual-style-quick-panel",
              visualStyleTab === "dashboard" && "is-dashboard-panel",
            )}
          >
            <div className="gradient-quick-panel-head">
              <div>
                <div className="gradient-quick-title">卡片与样式</div>
                <div className="gradient-quick-subtitle">{visualStyleSourceLabel}</div>
              </div>
              <button
                type="button"
                className="theme-manage-button is-compact"
                onClick={clearLocalVisualStyle}
                disabled={!hasLocalVisualStyle}
                title={hasLocalVisualStyle ? "恢复全站默认" : "当前已经是默认样式"}
              >
                <span>恢复全站默认</span>
              </button>
            </div>

            <div className="visual-style-tab-list" role="tablist" aria-label="样式设置分类">
              {VISUAL_STYLE_QUICK_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={visualStyleTab === tab.id}
                  className="visual-style-tab-button"
                  data-active={visualStyleTab === tab.id ? "true" : "false"}
                  onClick={() => setVisualStyleTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {visualStyleTab === "card" && (
              <div className="visual-style-section">
                <div className="visual-style-section-title">卡片外壳</div>
                <div className="visual-style-preset-list">
                  {CARD_STYLE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className="visual-style-preset"
                      data-active={visualStyle.cardStyle === preset.id ? "true" : "false"}
                      onClick={() => updateVisualStyle({ cardStyle: preset.id })}
                    >
                      <span className="visual-style-preset-name">{preset.label}</span>
                      <span className="visual-style-preset-copy">{preset.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {visualStyleTab === "dashboard" && (
              <div className="visual-style-section">
                <div className="visual-style-dashboard-layout">
                  <div>
                  <div className="visual-style-section-title">信息展板</div>
                  <div className="visual-style-preset-list">
                    {DASHBOARD_STYLE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className="visual-style-preset"
                        data-active={
                          visualStyle.dashboardStyle === preset.id ? "true" : "false"
                        }
                        onClick={() => updateVisualStyle({ dashboardStyle: preset.id })}
                      >
                        <span className="visual-style-preset-name">{preset.label}</span>
                        <span className="visual-style-preset-copy">{preset.description}</span>
                      </button>
                    ))}
                  </div>
                  </div>

                  <div className="visual-style-linked-settings">
                    {visualStyle.dashboardStyle === "bars" ? (
                      <>
                        <div className="visual-style-section-title">数据条细节</div>
                        <div className="visual-style-preset-list">
                          {MARQUEE_STYLE_PRESETS.map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              className="visual-style-preset"
                              data-active={
                                visualStyle.marqueeStyle.preset === preset.id
                                  ? "true"
                                  : "false"
                              }
                              onClick={() =>
                                updateVisualStyle({
                                  marqueeStyle: { ...preset.settings },
                                })
                              }
                            >
                              <span className="visual-style-preset-name">
                                {preset.label}
                              </span>
                              <span className="visual-style-preset-copy">
                                {preset.description}
                              </span>
                            </button>
                          ))}
                        </div>

                        <div className="visual-style-section is-tight">
                          <MarqueePreviewStrip
                            className="marquee-style-preview-strip"
                            style={visualStyle.marqueeStyle}
                            colors={visualStyle.colors}
                            height={16}
                          />
                          {(
                            [
                              ["density", "密度"],
                              ["radius", "圆角"],
                              ["glow", "光晕"],
                              ["motion", "动效"],
                            ] as const
                          ).map(([key, label]) => (
                            <label key={key} className="gradient-range-control">
                              <span>
                                <span>{label}</span>
                                <strong>{visualStyle.marqueeStyle[key]}%</strong>
                              </span>
                              <input
                                type="range"
                                min={0}
                                max={100}
                                value={visualStyle.marqueeStyle[key]}
                                onChange={(event) =>
                                  updateVisualStyle({
                                    marqueeStyle: {
                                      ...visualStyle.marqueeStyle,
                                      preset: "custom",
                                      [key]: Number(event.target.value),
                                    },
                                  })
                                }
                              />
                            </label>
                          ))}
                        </div>
                      </>
                    ) : activeDashboardStyle ? (
                      <>
                        <div className="visual-style-section-title">环形样式</div>
                        <div className="visual-style-preset-list is-gauge-style">
                          {GAUGE_STYLE_PRESETS.map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              className="visual-style-preset"
                              data-active={
                                visualStyle.dashboardSettings[activeDashboardStyle]
                                  .gaugeStyle === preset.id
                                  ? "true"
                                  : "false"
                              }
                              onClick={() =>
                                updateVisualStyle({
                                  dashboardSettings: patchDashboardSetting(
                                    visualStyle.dashboardSettings,
                                    activeDashboardStyle,
                                    "gaugeStyle",
                                    preset.id,
                                  ),
                                })
                              }
                            >
                              <span className="visual-style-preset-name">
                                {preset.label}
                              </span>
                              <span className="visual-style-preset-copy">
                                {preset.description}
                              </span>
                            </button>
                          ))}
                        </div>
                        <div className="visual-style-section-title">仪表细节</div>
                        <label className="gradient-range-control">
                          <span>
                            <span>延迟上限</span>
                            <strong>{visualStyle.radarLatencyMaxMs}ms</strong>
                          </span>
                          <input
                            type="range"
                            min={RADAR_LATENCY_MAX_MIN_MS}
                            max={RADAR_LATENCY_MAX_MAX_MS}
                            step={RADAR_LATENCY_MAX_STEP_MS}
                            value={visualStyle.radarLatencyMaxMs}
                            onChange={(event) =>
                              updateVisualStyle({
                                radarLatencyMaxMs: Number(event.target.value),
                              })
                            }
                          />
                        </label>
                        {DASHBOARD_TUNING_CONTROLS[activeDashboardStyle].map(
                          ({ key, label, max = 100 }) => {
                            const value = Number(
                              visualStyle.dashboardSettings[activeDashboardStyle][
                                key as keyof (typeof visualStyle.dashboardSettings)[typeof activeDashboardStyle]
                              ],
                            );

                            return (
                              <label key={key} className="gradient-range-control">
                                <span>
                                  <span>{label}</span>
                                  <strong>{value}%</strong>
                                </span>
                                <input
                                  type="range"
                                  min={0}
                                  max={max}
                                  value={value}
                                  onChange={(event) =>
                                    updateVisualStyle({
                                      dashboardSettings: patchDashboardSetting(
                                        visualStyle.dashboardSettings,
                                        activeDashboardStyle,
                                        key,
                                        Number(event.target.value),
                                      ),
                                    })
                                  }
                                />
                              </label>
                            );
                          },
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {visualStyleTab === "palette" && (
              <>
                <div className="visual-style-section">
                  <div className="visual-style-section-title">跑马灯配色</div>
                  <div className="visual-style-preset-list">
                    {MARQUEE_PALETTE_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className="visual-style-preset"
                        data-active={
                          visualStyle.marqueePalette === preset.id ? "true" : "false"
                        }
                        onClick={() =>
                          updateVisualStyle({
                            marqueePalette: preset.id,
                            colors: preset.colors,
                          })
                        }
                      >
                        <span className="visual-style-preset-head">
                          <span className="visual-style-preset-name">{preset.label}</span>
                          <span className="marquee-swatch-row" aria-hidden>
                            {Object.values(preset.colors).slice(0, 6).map((color) => (
                              <span key={color} style={{ background: color }} />
                            ))}
                          </span>
                        </span>
                        <span className="visual-style-preset-copy">{preset.description}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="visual-style-section">
                  <div className="visual-style-section-title">自定义指标颜色</div>
                  <div className="visual-color-grid">
                    {VISUAL_COLOR_CONTROLS.map(({ key, label }) => (
                      <label key={key} className="visual-color-control">
                        <span>{label}</span>
                        <input
                          type="color"
                          value={visualStyle.colors[key]}
                          onChange={(event) =>
                            updateVisualStyle({
                              marqueePalette: "custom",
                              colors: {
                                ...visualStyle.colors,
                                [key]: event.target.value,
                              },
                            })
                          }
                          aria-label={label}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        {sortPanelOpen && !collapsed && (
          <div className="visual-style-quick-panel">
            <div className="gradient-quick-panel-head">
              <div>
                <div className="gradient-quick-title">首页排序</div>
                <div className="gradient-quick-subtitle">{nodeSortSourceLabel}</div>
              </div>
              <button
                type="button"
                className="theme-manage-button is-compact"
                onClick={clearLocalNodeSort}
                disabled={!hasLocalNodeSort}
                title={hasLocalNodeSort ? "恢复全站默认" : "当前已经是默认排序"}
              >
                <span>恢复全站默认</span>
              </button>
            </div>

            <div className="visual-style-section">
              <div className="visual-style-section-title">排序方式</div>
              <div className="visual-style-preset-list">
                {HOMEPAGE_NODE_SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="visual-style-preset"
                    data-active={nodeSort.mode === option.value ? "true" : "false"}
                    onClick={() => updateNodeSort({ mode: option.value })}
                    title={option.description}
                  >
                    <span className="visual-style-preset-head">
                      <span className="visual-style-preset-name">{option.label}</span>
                      {option.realtime && <Cpu size={13} aria-hidden />}
                    </span>
                    <span className="visual-style-preset-copy">{option.description}</span>
                  </button>
                ))}
              </div>
            </div>

            {isRealtimeNodeSortMode(nodeSort.mode) && (
              <div className="visual-style-section">
                <div className="visual-style-section-title">快照间隔</div>
                <div className="node-sort-interval-grid">
                  {NODE_SORT_INTERVAL_OPTIONS.map((seconds) => (
                    <button
                      key={seconds}
                      type="button"
                      className={clsx(
                        "gradient-preset-button",
                        nodeSort.realtimeIntervalSeconds === seconds && "is-active",
                      )}
                      onClick={() => updateNodeSort({ realtimeIntervalSeconds: seconds })}
                    >
                      <span>{seconds}s</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {showSyncWarning && !collapsed && (
          <div className="pointer-events-none flex items-center gap-2 rounded-full border border-[color-mix(in_srgb,var(--status-offline)_32%,transparent)] bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] px-3 py-1 text-[11px] font-medium text-[var(--status-offline)] shadow-[0_10px_25px_-18px_rgba(0,0,0,0.8)] backdrop-blur">
            <AlertTriangle size={12} />
            <span>实时状态同步异常，当前展示的是最近缓存</span>
          </div>
        )}
      </div>
    </div>
  );
}
