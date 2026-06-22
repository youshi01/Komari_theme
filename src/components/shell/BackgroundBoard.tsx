import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { useBackgroundBoardToggle } from "@/hooks/useBackgroundBoardToggle";
import { useGradientBackground } from "@/hooks/useGradientBackground";
import {
  getBackgroundSources,
  normalizeBackgroundSettings,
} from "@/utils/backgroundSettings";

export function BackgroundBoard() {
  const { data: config } = usePublicConfig();
  const { backgroundBoardVisible } = useBackgroundBoardToggle();
  const { gradientBackground } = useGradientBackground();
  const settings = useMemo(
    () => normalizeBackgroundSettings(config?.theme_settings?.background),
    [config?.theme_settings?.background],
  );
  const sources = useMemo(() => getBackgroundSources(settings), [settings]);
  const imageEnabled = settings.enabled && backgroundBoardVisible && sources.length > 0;
  const gradientEnabled = gradientBackground.enabled;
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const root = document.documentElement;
    const enabled = gradientBackground.enabled && gradientBackground.tintSurfaces;

    if (!enabled) {
      delete root.dataset.gradientSurfaces;
      root.style.removeProperty("--ys-gradient-surface-primary");
      root.style.removeProperty("--ys-gradient-surface-secondary");
      root.style.removeProperty("--ys-gradient-surface-accent");
      root.style.removeProperty("--ys-gradient-surface-opacity");
      root.style.removeProperty("--ys-gradient-surface-tint");
      root.style.removeProperty("--ys-gradient-surface-faint");
      root.style.removeProperty("--ys-gradient-surface-border");
      root.style.removeProperty("--ys-gradient-surface-glass");
      return;
    }

    const opacity = gradientBackground.surfaceOpacity;
    const tint = Math.min(92, Math.round(opacity * 0.52));
    const faint = Math.min(72, Math.round(opacity * 0.3));
    const border = Math.min(82, Math.round(opacity * 0.38));
    const glass = Math.max(44, Math.round(96 - opacity * 0.28));
    root.dataset.gradientSurfaces = "true";
    root.style.setProperty("--ys-gradient-surface-primary", gradientBackground.colors.primary);
    root.style.setProperty("--ys-gradient-surface-secondary", gradientBackground.colors.secondary);
    root.style.setProperty("--ys-gradient-surface-accent", gradientBackground.colors.accent);
    root.style.setProperty("--ys-gradient-surface-opacity", `${opacity}%`);
    root.style.setProperty("--ys-gradient-surface-tint", `${tint}%`);
    root.style.setProperty("--ys-gradient-surface-faint", `${faint}%`);
    root.style.setProperty("--ys-gradient-surface-border", `${border}%`);
    root.style.setProperty("--ys-gradient-surface-glass", `${glass}%`);

    return () => {
      delete root.dataset.gradientSurfaces;
      root.style.removeProperty("--ys-gradient-surface-primary");
      root.style.removeProperty("--ys-gradient-surface-secondary");
      root.style.removeProperty("--ys-gradient-surface-accent");
      root.style.removeProperty("--ys-gradient-surface-opacity");
      root.style.removeProperty("--ys-gradient-surface-tint");
      root.style.removeProperty("--ys-gradient-surface-faint");
      root.style.removeProperty("--ys-gradient-surface-border");
      root.style.removeProperty("--ys-gradient-surface-glass");
    };
  }, [
    gradientBackground.colors.accent,
    gradientBackground.colors.primary,
    gradientBackground.colors.secondary,
    gradientBackground.enabled,
    gradientBackground.surfaceOpacity,
    gradientBackground.tintSurfaces,
  ]);

  useEffect(() => {
    setActiveIndex(0);
  }, [sources.length, settings.source]);

  useEffect(() => {
    if (!imageEnabled || !settings.rotationEnabled || sources.length < 2) return;
    const interval = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % sources.length);
    }, settings.rotationSeconds * 1000);
    return () => window.clearInterval(interval);
  }, [
    imageEnabled,
    settings.rotationEnabled,
    settings.rotationSeconds,
    sources.length,
  ]);

  if (!gradientEnabled && !imageEnabled) {
    return null;
  }

  const source = sources[activeIndex % sources.length];
  const opacity = settings.opacity / 100;
  const gradientBoost = Math.max(0, gradientBackground.opacity - 100);
  const gradientOpacity = Math.min(1, gradientBackground.opacity / 100);
  const gradientAccentStrength = Math.min(96, 72 + Math.round(gradientBoost * 0.24));
  const gradientSecondaryStrength = Math.min(88, 58 + Math.round(gradientBoost * 0.3));
  const gradientSoftSecondaryStrength = Math.min(86, 62 + Math.round(gradientBoost * 0.24));
  const gradientSoftAccentStrength = Math.min(82, 54 + Math.round(gradientBoost * 0.28));
  const gradientGridOpacity = Math.min(0.56, 0.34 + gradientBoost / 460);

  return (
    <>
      {gradientEnabled && (
        <div
          className="ys-gradient-backdrop"
          data-grid={gradientBackground.grid ? "true" : "false"}
          aria-hidden
          style={
            {
              "--ys-gradient-primary": gradientBackground.colors.primary,
              "--ys-gradient-secondary": gradientBackground.colors.secondary,
              "--ys-gradient-accent": gradientBackground.colors.accent,
              "--ys-gradient-angle": `${gradientBackground.angle}deg`,
              "--ys-gradient-opacity": gradientOpacity,
              "--ys-gradient-softness": `${gradientBackground.softness}px`,
              "--ys-gradient-accent-strength": `${gradientAccentStrength}%`,
              "--ys-gradient-secondary-strength": `${gradientSecondaryStrength}%`,
              "--ys-gradient-soft-secondary-strength": `${gradientSoftSecondaryStrength}%`,
              "--ys-gradient-soft-accent-strength": `${gradientSoftAccentStrength}%`,
              "--ys-gradient-grid-opacity": gradientGridOpacity,
            } as CSSProperties
          }
        />
      )}
      {imageEnabled && (
        <div
          className="ys-background-board"
          data-layer={settings.layer}
          aria-hidden
          style={{
            "--ys-bg-opacity": opacity,
            "--ys-bg-blur": `${settings.blur}px`,
            "--ys-bg-scale": settings.blur > 0 ? 1 + settings.blur / 300 : 1,
          } as CSSProperties}
        >
          <img
            key={source.id}
            src={source.url}
            alt=""
            draggable={false}
            className="ys-background-image"
            style={{
              objectFit: settings.fit,
              objectPosition: settings.position,
            }}
          />
          {settings.layer === "back" && <div className="ys-background-scrim" />}
        </div>
      )}
    </>
  );
}
