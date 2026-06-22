import type { ThemeBackgroundSettings, ThemeBackgroundUpload } from "@/types/komari";

export const BACKGROUND_UPLOAD_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif";
export const BACKGROUND_MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const BACKGROUND_MAX_UPLOADS = 8;

export const DEFAULT_BACKGROUND_SETTINGS: ThemeBackgroundSettings = {
  enabled: false,
  source: "url",
  urls: "",
  uploads: [],
  rotationEnabled: false,
  rotationSeconds: 12,
  opacity: 54,
  blur: 0,
  fit: "cover",
  position: "center",
  layer: "back",
};

const IMAGE_DATA_URL_PATTERN = /^data:image\/(?:jpeg|jpg|png|webp|gif|avif);base64,/i;
const IMAGE_URL_PATTERN = /^(https?:\/\/|\/|\.\/|\.\.\/|data:image\/)/i;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeUpload(value: unknown): ThemeBackgroundUpload | null {
  const item = asRecord(value);
  const dataUrl = asString(item.dataUrl).trim();
  if (!IMAGE_DATA_URL_PATTERN.test(dataUrl)) return null;

  return {
    id: asString(item.id, dataUrl.slice(0, 48)),
    name: asString(item.name, "background"),
    mime: asString(item.mime, "image/*"),
    size: asNumber(item.size, 0, 0, BACKGROUND_MAX_UPLOAD_BYTES),
    dataUrl,
    createdAt: asNumber(item.createdAt, Date.now(), 0, Number.MAX_SAFE_INTEGER),
  };
}

export function parseBackgroundUrls(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((url) => url.trim())
    .filter((url) => url.length > 0 && IMAGE_URL_PATTERN.test(url));
}

export function normalizeBackgroundSettings(value: unknown): ThemeBackgroundSettings {
  const raw = asRecord(value);
  const source = raw.source === "upload" ? "upload" : "url";
  const fit =
    raw.fit === "contain" || raw.fit === "fill" || raw.fit === "cover" ? raw.fit : "cover";
  const layer = raw.layer === "front" ? "front" : "back";
  const position = asString(raw.position, DEFAULT_BACKGROUND_SETTINGS.position).trim() || "center";
  const uploads = Array.isArray(raw.uploads)
    ? raw.uploads
        .map((upload) => normalizeUpload(upload))
        .filter((upload): upload is ThemeBackgroundUpload => Boolean(upload))
        .slice(0, BACKGROUND_MAX_UPLOADS)
    : [];

  return {
    enabled: asBoolean(raw.enabled, DEFAULT_BACKGROUND_SETTINGS.enabled),
    source,
    urls: asString(raw.urls, DEFAULT_BACKGROUND_SETTINGS.urls),
    uploads,
    rotationEnabled: asBoolean(
      raw.rotationEnabled,
      DEFAULT_BACKGROUND_SETTINGS.rotationEnabled,
    ),
    rotationSeconds: Math.round(
      asNumber(
        raw.rotationSeconds,
        DEFAULT_BACKGROUND_SETTINGS.rotationSeconds,
        3,
        300,
      ),
    ),
    opacity: Math.round(asNumber(raw.opacity, DEFAULT_BACKGROUND_SETTINGS.opacity, 8, 100)),
    blur: Math.round(asNumber(raw.blur, DEFAULT_BACKGROUND_SETTINGS.blur, 0, 40)),
    fit,
    position,
    layer,
  };
}

export function getBackgroundSources(settings: ThemeBackgroundSettings) {
  if (!settings.enabled) return [];
  if (settings.source === "upload") {
    return settings.uploads.map((upload) => ({
      id: upload.id,
      name: upload.name,
      url: upload.dataUrl,
    }));
  }

  return parseBackgroundUrls(settings.urls).map((url, index) => ({
    id: `${index}:${url}`,
    name: url,
    url,
  }));
}

export function serializeBackgroundSettings(settings: ThemeBackgroundSettings) {
  const normalized = normalizeBackgroundSettings(settings);
  return JSON.stringify({
    ...normalized,
    urls: normalized.urls
      .split(/\r?\n/)
      .map((url) => url.trim())
      .join("\n"),
    uploads: normalized.uploads.map((upload) => ({
      ...upload,
      createdAt: Math.round(upload.createdAt || 0),
    })),
  });
}
