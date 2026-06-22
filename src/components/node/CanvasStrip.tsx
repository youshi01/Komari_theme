import { useEffect, useRef, useState, type PointerEvent } from "react";

interface CanvasStripProps {
  className?: string;
  height: number;
  ariaHidden?: boolean;
  redrawKey?: string | number;
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void;
  getHoverIndex?: (offsetX: number, width: number) => number | null;
  onHoverIndex?: (index: number | null) => void;
}

export function resolveCssColor(
  color: string,
  styles = getComputedStyle(document.documentElement),
): string {
  let resolvedColor = color;

  for (let guard = 0; guard < 8; guard += 1) {
    const start = resolvedColor.indexOf("var(");
    if (start < 0) return resolvedColor;

    let depth = 0;
    let end = -1;
    for (let index = start; index < resolvedColor.length; index += 1) {
      const char = resolvedColor[index];
      if (char === "(") depth += 1;
      if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          end = index;
          break;
        }
      }
    }

    if (end < 0) return resolvedColor;

    const body = resolvedColor.slice(start + 4, end);
    let commaIndex = -1;
    depth = 0;
    for (let index = 0; index < body.length; index += 1) {
      const char = body[index];
      if (char === "(") depth += 1;
      if (char === ")") depth -= 1;
      if (char === "," && depth === 0) {
        commaIndex = index;
        break;
      }
    }

    const name = (commaIndex >= 0 ? body.slice(0, commaIndex) : body).trim();
    const fallback = commaIndex >= 0 ? body.slice(commaIndex + 1).trim() : "";
    const value = name.startsWith("--") ? styles.getPropertyValue(name).trim() : "";
    const replacement = value || (fallback ? resolveCssColor(fallback, styles) : "");
    if (!replacement) return resolvedColor;

    resolvedColor = `${resolvedColor.slice(0, start)}${replacement}${resolvedColor.slice(end + 1)}`;
  }

  return resolvedColor;
}

export function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
  ctx.fill();
}

export function CanvasStrip({
  className,
  height,
  ariaHidden = false,
  redrawKey,
  draw,
  getHoverIndex,
  onHoverIndex,
}: CanvasStripProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateWidth = () => {
      setWidth(canvas.clientWidth);
    };

    updateWidth();
    const observer = new ResizeObserver(() => {
      updateWidth();
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    draw(ctx, width, height);
  }, [draw, height, redrawKey, width]);

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!getHoverIndex || !onHoverIndex || width <= 0) return;
    onHoverIndex(getHoverIndex(event.nativeEvent.offsetX, width));
  };

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height }}
      aria-hidden={ariaHidden}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => onHoverIndex?.(null)}
    />
  );
}
