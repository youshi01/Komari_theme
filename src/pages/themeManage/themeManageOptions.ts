import { Link2, Moon, Sun, SunMoon, Upload } from "lucide-react";

export type Appearance = "system" | "light" | "dark";

export const APPEARANCE_OPTIONS = [
  { value: "light", label: "浅色", icon: Sun },
  { value: "system", label: "跟随系统", icon: SunMoon },
  { value: "dark", label: "深色", icon: Moon },
] as const;

export const BACKGROUND_SOURCE_OPTIONS = [
  { value: "url", label: "图片链接", icon: Link2 },
  { value: "upload", label: "上传图片", icon: Upload },
] as const;

export const BACKGROUND_FIT_OPTIONS = [
  { value: "cover", label: "铺满" },
  { value: "contain", label: "完整" },
  { value: "fill", label: "拉伸" },
] as const;

export const BACKGROUND_POSITION_OPTIONS = [
  { value: "center", label: "居中" },
  { value: "top", label: "顶部" },
  { value: "bottom", label: "底部" },
  { value: "left", label: "左侧" },
  { value: "right", label: "右侧" },
] as const;

export function normalizeAppearance(value: unknown): Appearance {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}
