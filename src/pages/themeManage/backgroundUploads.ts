import type { ThemeBackgroundSettings, ThemeBackgroundUpload } from "@/types/komari";
import { normalizeBackgroundSettings } from "@/utils/backgroundSettings";

export const BACKGROUND_OPTIMIZE_MIN_BYTES = 1_200_000;
export const BACKGROUND_OPTIMIZE_MAX_EDGE = 1920;
export const BACKGROUND_OPTIMIZE_QUALITY = 0.86;

export function createUploadId(file: File) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${file.name}-${file.size}-${file.lastModified}-${Date.now()}`;
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("无法读取图片文件"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("无法读取图片文件"));
    reader.readAsDataURL(file);
  });
}

export function estimateDataUrlBytes(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) return dataUrl.length;
  const base64 = dataUrl.slice(commaIndex + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

export function readBlobAsDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("无法读取压缩后的图片"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("无法读取压缩后的图片"));
    reader.readAsDataURL(blob);
  });
}

export function loadDataUrlImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("无法解码背景图片"));
    image.src = dataUrl;
  });
}

export async function optimizeBackgroundUpload(upload: ThemeBackgroundUpload) {
  const estimatedBytes = upload.size || estimateDataUrlBytes(upload.dataUrl);
  const canOptimize =
    /^image\/jpe?g$/i.test(upload.mime) &&
    upload.dataUrl.startsWith("data:image/") &&
    estimatedBytes >= BACKGROUND_OPTIMIZE_MIN_BYTES;
  if (!canOptimize) return upload;

  try {
    const image = await loadDataUrlImage(upload.dataUrl);
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (width <= 0 || height <= 0) return upload;

    const scale = Math.min(1, BACKGROUND_OPTIMIZE_MAX_EDGE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return upload;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", BACKGROUND_OPTIMIZE_QUALITY),
    );
    if (!blob || blob.size >= estimatedBytes * 0.92) return upload;

    return {
      ...upload,
      mime: "image/webp",
      size: blob.size,
      dataUrl: await readBlobAsDataUrl(blob),
    };
  } catch {
    return upload;
  }
}

export async function optimizeBackgroundUploads(settings: ThemeBackgroundSettings) {
  if (settings.source !== "upload" || settings.uploads.length === 0) {
    return normalizeBackgroundSettings(settings);
  }

  const uploads: ThemeBackgroundUpload[] = [];
  let changed = false;
  for (const upload of settings.uploads) {
    const optimized = await optimizeBackgroundUpload(upload);
    if (optimized !== upload) changed = true;
    uploads.push(optimized);
  }

  return changed
    ? normalizeBackgroundSettings({ ...settings, uploads })
    : normalizeBackgroundSettings(settings);
}
