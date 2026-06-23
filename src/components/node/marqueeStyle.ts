import type { MarqueeStyleSettings } from "@/hooks/useVisualStyle";
import { fillRoundedRect, resolveCssColor } from "./CanvasStrip";

export type MarqueeStripVariant = "progress" | "trend" | "histogram" | "quality";

export interface MarqueePoint {
  level: number;
  active?: boolean;
  opacity?: number;
  color?: string;
  accentShare?: number;
  hideInactive?: boolean;
  toneOffset?: number;
}

export interface MarqueeStripColors {
  base: string;
  accent: string;
  inactive: string;
}

interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface DrawMarqueeStripOptions {
  points: MarqueePoint[];
  style: MarqueeStyleSettings;
  colors: MarqueeStripColors;
  variant: MarqueeStripVariant;
  now?: number;
}

const DEFAULT_FRAME_MS = 1000 / 24;

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function parseColor(color: string): RgbaColor | null {
  const normalized = color.trim();
  const hex = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1];
    const expanded =
      raw.length === 3
        ? raw
            .split("")
            .map((part) => `${part}${part}`)
            .join("")
        : raw;
    return {
      r: Number.parseInt(expanded.slice(0, 2), 16),
      g: Number.parseInt(expanded.slice(2, 4), 16),
      b: Number.parseInt(expanded.slice(4, 6), 16),
      a: 1,
    };
  }

  const rgb = normalized.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i,
  );
  if (!rgb) return null;
  return {
    r: clampInt(Number(rgb[1]), 0, 255),
    g: clampInt(Number(rgb[2]), 0, 255),
    b: clampInt(Number(rgb[3]), 0, 255),
    a: rgb[4] == null ? 1 : clamp(Number(rgb[4])),
  };
}

function toRgbaString(color: RgbaColor, alpha = color.a) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${clamp(alpha).toFixed(3)})`;
}

function mixColors(from: string, to: string, amount: number) {
  const a = parseColor(from);
  const b = parseColor(to);
  if (!a || !b) return amount < 0.5 ? from : to;
  const share = clamp(amount);
  return toRgbaString({
    r: clampInt(a.r + (b.r - a.r) * share, 0, 255),
    g: clampInt(a.g + (b.g - a.g) * share, 0, 255),
    b: clampInt(a.b + (b.b - a.b) * share, 0, 255),
    a: a.a + (b.a - a.a) * share,
  });
}

function withAlpha(color: string, alpha: number) {
  const parsed = parseColor(color);
  return parsed ? toRgbaString(parsed, alpha) : color;
}

function resetCanvasEffects(ctx: CanvasRenderingContext2D) {
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";
}

function pointIsActive(point: MarqueePoint) {
  return point.active ?? point.level > 0;
}

function getPointTone(
  point: MarqueePoint,
  styles: CSSStyleDeclaration,
  baseColor: string,
  accentColor: string,
) {
  const source = point.color ? resolveCssColor(point.color, styles) : baseColor;
  const shaded =
    point.toneOffset == null || point.toneOffset === 0
      ? source
      : mixColors(
          source,
          point.toneOffset > 0 ? "#ffffff" : "#000000",
          Math.min(0.42, Math.abs(point.toneOffset)),
        );
  const accentShare =
    point.accentShare ?? (pointIsActive(point) ? 0.08 + clamp(point.level) * 0.28 : 0);
  return mixColors(shaded, accentColor, accentShare);
}

function getMotionPhase(style: MarqueeStyleSettings, now?: number) {
  return ((now ?? 0) / 1000) * (0.45 + style.motion / 70);
}

function drawClassicStrip(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: DrawMarqueeStripOptions,
  resolved: MarqueeStripColors,
  styles: CSSStyleDeclaration,
) {
  const { points, style, variant } = options;
  const slotWidth = width / Math.max(1, points.length);
  const gap = variant === "trend" ? 1 : points.length > 48 ? 1 : 2;
  const fillRatio = 0.42 + (style.density / 100) * 0.48;
  const itemWidth = Math.max(1, Math.min(slotWidth - gap, slotWidth * fillRatio));
  const radius = Math.max(1, (height * style.radius) / 200);

  points.forEach((point, index) => {
    const active = pointIsActive(point);
    if (!active && point.hideInactive) return;
    const level = clamp(point.level);
    const opacity = point.opacity ?? 0.9;
    const x = index * slotWidth + (slotWidth - itemWidth) / 2;

    if (variant === "trend") {
      const dotRadius = Math.max(
        1.25,
        Math.min(height / 2, active ? 1.7 + level * 2.35 : 1.55),
      );
      ctx.beginPath();
      ctx.arc(index * slotWidth + slotWidth / 2, height / 2, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = active
        ? getPointTone(point, styles, resolved.base, resolved.accent)
        : resolved.inactive;
      ctx.globalAlpha = active ? clamp(opacity + 0.06) : 0.42;
      ctx.fill();
      return;
    }

    const barHeight =
      variant === "progress"
        ? height
        : Math.max(2, height * (active ? 0.24 + level * 0.72 : 0.22));
    const y = height - barHeight;
    ctx.globalAlpha = 0.54;
    ctx.fillStyle = resolved.inactive;
    fillRoundedRect(ctx, x, height * 0.08, itemWidth, height * 0.86, radius);

    if (!active) return;
    ctx.globalAlpha = clamp(0.36 + level * 0.6);
    ctx.fillStyle = getPointTone(point, styles, resolved.base, resolved.accent);
    fillRoundedRect(ctx, x, y, itemWidth, barHeight, radius);
  });
}

function drawAuroraStrip(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: DrawMarqueeStripOptions,
  resolved: MarqueeStripColors,
) {
  const { points, style, now, variant } = options;
  const phase = getMotionPhase(style, now);
  const slotWidth = width / Math.max(1, points.length);
  const strokeWidth = Math.max(2.4, Math.min(height * 0.75, 2.4 + style.density * 0.035));
  const glow = (style.glow / 100) * 14;
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, withAlpha(resolved.base, 0.92));
  gradient.addColorStop(0.52, mixColors(resolved.base, resolved.accent, 0.44));
  gradient.addColorStop(1, withAlpha(resolved.accent, 0.92));

  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = resolved.inactive;
  ctx.lineWidth = Math.max(2, strokeWidth * 0.7);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  ctx.globalAlpha = 0.76;
  ctx.strokeStyle = gradient;
  ctx.lineWidth = strokeWidth;
  ctx.shadowBlur = glow;
  ctx.shadowColor = withAlpha(resolved.base, 0.64);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  let drawing = false;
  ctx.beginPath();
  points.forEach((point, index) => {
    const active = pointIsActive(point);
    if (!active) {
      drawing = false;
      return;
    }
    const level = clamp(point.level);
    const x = index * slotWidth + slotWidth / 2;
    const wave = Math.sin(index * 0.84 + phase * 2.8) * height * 0.14;
    const lift = variant === "progress" ? 0 : level * height * 0.18;
    const y = height * 0.54 + wave - lift;
    if (!drawing) {
      ctx.moveTo(x, y);
      drawing = true;
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
}

function drawCircuitStrip(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: DrawMarqueeStripOptions,
  resolved: MarqueeStripColors,
  styles: CSSStyleDeclaration,
) {
  const { points, style, now, variant } = options;
  const phase = getMotionPhase(style, now);
  const slotWidth = width / Math.max(1, points.length);
  const nodeSize = Math.max(2, Math.min(5, slotWidth * (0.24 + style.density / 260)));
  const yMid = height * 0.54;
  const glow = (style.glow / 100) * 8;

  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = resolved.inactive;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, yMid);
  ctx.lineTo(width, yMid);
  ctx.stroke();

  points.forEach((point, index) => {
    const active = pointIsActive(point);
    if (!active && point.hideInactive) return;
    const level = clamp(point.level);
    const x = index * slotWidth + slotWidth / 2;
    const rise = variant === "progress" ? height * 0.38 : height * (0.2 + level * 0.56);
    const yTop = Math.max(1, yMid - rise * 0.55);
    const yBottom = Math.min(height - 1, yMid + rise * 0.45);
    const branchRight = index % 2 === 0;
    const pulse = 0.5 + Math.sin(phase * 5 + index * 0.9) * 0.5;
    const tone = active
      ? getPointTone(point, styles, resolved.base, resolved.accent)
      : resolved.inactive;

    ctx.globalAlpha = active ? 0.62 + pulse * 0.24 : 0.28;
    ctx.strokeStyle = tone;
    ctx.lineWidth = active ? 1.35 : 1;
    ctx.shadowBlur = active ? glow : 0;
    ctx.shadowColor = withAlpha(tone, 0.6);
    ctx.beginPath();
    ctx.moveTo(x - slotWidth * 0.35, yMid);
    ctx.lineTo(x, yMid);
    ctx.lineTo(x, index % 3 === 0 ? yTop : yBottom);
    ctx.lineTo(x + slotWidth * (branchRight ? 0.34 : 0.18), index % 3 === 0 ? yTop : yBottom);
    ctx.stroke();

    ctx.globalAlpha = active ? 0.78 + pulse * 0.16 : 0.34;
    ctx.fillStyle = tone;
    fillRoundedRect(
      ctx,
      x - nodeSize / 2,
      (index % 3 === 0 ? yTop : yBottom) - nodeSize / 2,
      nodeSize,
      nodeSize,
      Math.max(1, nodeSize * style.radius * 0.005),
    );
  });
}

function drawNeonStrip(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: DrawMarqueeStripOptions,
  resolved: MarqueeStripColors,
  styles: CSSStyleDeclaration,
) {
  const { points, style, now, variant } = options;
  const phase = getMotionPhase(style, now);
  const slotWidth = width / Math.max(1, points.length);
  const fillRatio = 0.48 + (style.density / 100) * 0.42;
  const itemWidth = Math.max(1.5, Math.min(slotWidth * fillRatio, slotWidth - 1));
  const radius = Math.max(1, (height * style.radius) / 180);
  const glow = (style.glow / 100) * 16;

  points.forEach((point, index) => {
    const active = pointIsActive(point);
    if (!active && point.hideInactive) return;
    const level = clamp(point.level);
    const pulse = 0.5 + Math.sin(phase * 5.2 + index * 0.58) * 0.5;
    const barHeight =
      variant === "progress"
        ? height * (0.74 + pulse * 0.14)
        : Math.max(2, height * (active ? 0.28 + level * 0.7 : 0.24));
    const x = index * slotWidth + (slotWidth - itemWidth) / 2;
    const y = (height - barHeight) / 2;
    const tone = active
      ? getPointTone(point, styles, resolved.base, resolved.accent)
      : resolved.inactive;

    ctx.globalAlpha = active ? 0.22 + pulse * 0.14 : 0.22;
    ctx.fillStyle = active ? withAlpha(tone, 0.4) : resolved.inactive;
    fillRoundedRect(ctx, x - 1, y - 1, itemWidth + 2, barHeight + 2, radius + 1);

    ctx.globalAlpha = active ? clamp((point.opacity ?? 0.88) + pulse * 0.18) : 0.34;
    ctx.shadowBlur = active ? glow * (0.58 + pulse * 0.42) : 0;
    ctx.shadowColor = withAlpha(tone, 0.78);
    ctx.fillStyle = tone;
    fillRoundedRect(ctx, x, y, itemWidth, barHeight, radius);
    resetCanvasEffects(ctx);
  });
}

function drawEqualizerStrip(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: DrawMarqueeStripOptions,
  resolved: MarqueeStripColors,
  styles: CSSStyleDeclaration,
) {
  const { points, style, now, variant } = options;
  const phase = getMotionPhase(style, now);
  const slotWidth = width / Math.max(1, points.length);
  const itemWidth = Math.max(1, Math.min(slotWidth * (0.42 + style.density / 190), slotWidth - 1));
  const stackCount = variant === "trend" ? 3 : 4;
  const blockGap = 1;
  const blockHeight = Math.max(1, (height - blockGap * (stackCount - 1)) / stackCount);
  const radius = Math.max(0.5, (Math.min(itemWidth, blockHeight) * style.radius) / 200);
  const glow = (style.glow / 100) * 7;

  points.forEach((point, index) => {
    const active = pointIsActive(point);
    if (!active && point.hideInactive) return;
    const level = clamp(point.level);
    const pulse = Math.sin(phase * 4 + index * 0.72) * 0.16;
    const activeBlocks = active
      ? Math.max(1, Math.min(stackCount, Math.ceil((level + pulse) * stackCount)))
      : 0;
    const x = index * slotWidth + (slotWidth - itemWidth) / 2;
    const tone = active
      ? getPointTone(point, styles, resolved.base, resolved.accent)
      : resolved.inactive;

    for (let block = 0; block < stackCount; block += 1) {
      const fromBottom = stackCount - block;
      const y = height - (block + 1) * blockHeight - block * blockGap;
      const lit = active && fromBottom <= activeBlocks;
      ctx.globalAlpha = lit ? 0.48 + block * 0.11 : 0.2;
      ctx.shadowBlur = lit ? glow : 0;
      ctx.shadowColor = withAlpha(tone, 0.58);
      ctx.fillStyle = lit ? mixColors(tone, resolved.accent, block * 0.08) : resolved.inactive;
      fillRoundedRect(ctx, x, y, itemWidth, blockHeight, radius);
    }
    resetCanvasEffects(ctx);
  });
}

export function getMetricSegmentCount(style: MarqueeStyleSettings) {
  if (style.shape === "classic") return 18;
  return clampInt(12 + style.density * 0.2, 12, 34);
}

export function buildProgressPoints(fraction: number, style: MarqueeStyleSettings) {
  const count = getMetricSegmentCount(style);
  const activeSegments = clamp(fraction) * count;
  return Array.from({ length: count }, (_, index): MarqueePoint => {
    const level = clamp(activeSegments - index);
    return {
      level,
      active: level > 0,
      opacity: 0.42 + level * 0.56,
    };
  });
}

export function shouldAnimateMarqueeStyle(style: MarqueeStyleSettings) {
  return style.motion > 0;
}

export function getMarqueeFrameInterval(style: MarqueeStyleSettings) {
  if (!shouldAnimateMarqueeStyle(style)) return DEFAULT_FRAME_MS;
  return Math.max(1000 / 30, 1000 / (16 + style.motion * 0.16));
}

export function drawMarqueeStrip(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: DrawMarqueeStripOptions,
) {
  if (width <= 0 || height <= 0 || options.points.length === 0) return;
  const styles = getComputedStyle(document.documentElement);
  const resolved: MarqueeStripColors = {
    base: resolveCssColor(options.colors.base, styles),
    accent: resolveCssColor(options.colors.accent, styles),
    inactive: resolveCssColor(options.colors.inactive, styles),
  };

  resetCanvasEffects(ctx);
  switch (options.style.shape) {
    case "aurora":
      drawAuroraStrip(ctx, width, height, options, resolved);
      break;
    case "circuit":
      drawCircuitStrip(ctx, width, height, options, resolved, styles);
      break;
    case "neon":
      drawNeonStrip(ctx, width, height, options, resolved, styles);
      break;
    case "equalizer":
      drawEqualizerStrip(ctx, width, height, options, resolved, styles);
      break;
    case "classic":
    default:
      drawClassicStrip(ctx, width, height, options, resolved, styles);
      break;
  }
  resetCanvasEffects(ctx);
}
