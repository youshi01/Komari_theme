import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { useBackgroundBoardToggle } from "@/hooks/useBackgroundBoardToggle";
import {
  getBackgroundSources,
  normalizeBackgroundSettings,
} from "@/utils/backgroundSettings";

export function BackgroundBoard() {
  const { data: config } = usePublicConfig();
  const { backgroundBoardVisible } = useBackgroundBoardToggle();
  const settings = useMemo(
    () => normalizeBackgroundSettings(config?.theme_settings?.background),
    [config?.theme_settings?.background],
  );
  const sources = useMemo(() => getBackgroundSources(settings), [settings]);
  const enabled = settings.enabled && backgroundBoardVisible;
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [sources.length, settings.source]);

  useEffect(() => {
    if (!enabled || !settings.rotationEnabled || sources.length < 2) return;
    const interval = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % sources.length);
    }, settings.rotationSeconds * 1000);
    return () => window.clearInterval(interval);
  }, [
    enabled,
    settings.rotationEnabled,
    settings.rotationSeconds,
    sources.length,
  ]);

  if (!enabled || sources.length === 0) {
    return null;
  }

  const source = sources[activeIndex % sources.length];
  const opacity = settings.opacity / 100;

  return (
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
  );
}
