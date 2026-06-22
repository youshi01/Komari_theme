import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  Cpu,
  GripVertical,
  Grid2X2,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  ListOrdered,
  Link2,
  Moon,
  Palette,
  RefreshCw,
  Save,
  Search,
  Shuffle,
  Sparkles,
  Sun,
  SunMoon,
  Trash2,
  Upload,
} from "lucide-react";
import { clsx } from "clsx";
import { InstancePanel } from "@/components/instance/InstancePanel";
import { Spinner } from "@/components/ui/Spinner";
import { Flag } from "@/components/ui/Flag";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { queryClient } from "@/services/queryClient";
import {
  ApiRequestError,
  getAdminClients,
  getAdminPingTasks,
  saveThemeSettings,
} from "@/services/api";
import type {
  AdminClient,
  PingTask,
  PublicConfig,
  ThemeBackgroundSettings,
  ThemeBackgroundUpload,
  ThemeSettings,
} from "@/types/komari";
import { formatBytes } from "@/utils/format";
import {
  BACKGROUND_MAX_UPLOAD_BYTES,
  BACKGROUND_MAX_UPLOADS,
  BACKGROUND_UPLOAD_ACCEPT,
  DEFAULT_BACKGROUND_SETTINGS,
  getBackgroundSettingsFingerprint,
  getBackgroundSources,
  normalizeBackgroundSettings,
  parseBackgroundUrls,
} from "@/utils/backgroundSettings";
import {
  DEFAULT_GRADIENT_BACKGROUND_SETTINGS,
  GRADIENT_BACKGROUND_PRESETS,
  normalizeGradientBackgroundSettings,
  presetToGradientSettings,
  serializeGradientBackgroundSettings,
  type GradientBackgroundSettings,
} from "@/hooks/useGradientBackground";
import {
  CARD_STYLE_PRESETS,
  DEFAULT_VISUAL_STYLE_SETTINGS,
  MARQUEE_PALETTE_PRESETS,
  VISUAL_COLOR_CONTROLS,
  normalizeVisualStyleSettings,
  serializeVisualStyleSettings,
  type VisualStyleSettings,
} from "@/hooks/useVisualStyle";
import {
  normalizeHomepagePingTaskBindings,
  type HomepagePingTaskBindings,
} from "@/utils/pingTasks";
import {
  applyHomepageNodeOrder,
  normalizeHomepageNodeOrder,
  pruneHomepageNodeOrder,
  serializeHomepageNodeOrder,
} from "@/utils/nodeOrder";
import {
  DEFAULT_HOMEPAGE_NODE_SORT,
  HOMEPAGE_NODE_SORT_OPTIONS,
  NODE_SORT_INTERVAL_OPTIONS,
  isRealtimeNodeSortMode,
  normalizeHomepageNodeSortSettings,
  serializeHomepageNodeSortSettings,
  type HomepageNodeSortSettings,
} from "@/utils/nodeSort";

type Appearance = "system" | "light" | "dark";

const APPEARANCE_OPTIONS = [
  { value: "light", label: "浅色", icon: Sun },
  { value: "system", label: "跟随系统", icon: SunMoon },
  { value: "dark", label: "深色", icon: Moon },
] as const;

const BACKGROUND_SOURCE_OPTIONS = [
  { value: "url", label: "图片链接", icon: Link2 },
  { value: "upload", label: "上传图片", icon: Upload },
] as const;

const BACKGROUND_FIT_OPTIONS = [
  { value: "cover", label: "铺满" },
  { value: "contain", label: "完整" },
  { value: "fill", label: "拉伸" },
] as const;

const BACKGROUND_POSITION_OPTIONS = [
  { value: "center", label: "居中" },
  { value: "top", label: "顶部" },
  { value: "bottom", label: "底部" },
  { value: "left", label: "左侧" },
  { value: "right", label: "右侧" },
] as const;

const BACKGROUND_OPTIMIZE_MIN_BYTES = 1_200_000;
const BACKGROUND_OPTIMIZE_MAX_EDGE = 1920;
const BACKGROUND_OPTIMIZE_QUALITY = 0.86;

function normalizeAppearance(value: unknown): Appearance {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

function createUploadId(file: File) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${file.name}-${file.size}-${file.lastModified}-${Date.now()}`;
}

function readFileAsDataUrl(file: File) {
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

function estimateDataUrlBytes(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) return dataUrl.length;
  const base64 = dataUrl.slice(commaIndex + 1);
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function readBlobAsDataUrl(blob: Blob) {
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

function loadDataUrlImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("无法解码背景图片"));
    image.src = dataUrl;
  });
}

async function optimizeBackgroundUpload(upload: ThemeBackgroundUpload) {
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

async function optimizeBackgroundUploads(settings: ThemeBackgroundSettings) {
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

function serializeBindings(bindings: HomepagePingTaskBindings) {
  return JSON.stringify(
    Object.entries(bindings)
      .map(
        ([taskId, clients]): [number, string[]] => [
          Number(taskId),
          [...clients].sort((left, right) => left.localeCompare(right)),
        ],
      )
      .filter(([taskId]) => Number.isInteger(taskId) && taskId > 0)
      .sort(([left], [right]) => Number(left) - Number(right)),
  );
}

function sortTasks(tasks: PingTask[]) {
  return [...tasks].sort((left, right) => {
    if (left.weight !== right.weight) return left.weight - right.weight;
    if (left.id !== right.id) return left.id - right.id;
    return left.name.localeCompare(right.name);
  });
}

function sortClients(clients: AdminClient[]) {
  return [...clients].sort((left, right) => {
    if (left.weight !== right.weight) return left.weight - right.weight;
    return left.name.localeCompare(right.name);
  });
}

function summarizeNodes(
  uuids: string[],
  clientsById: Map<string, AdminClient>,
) {
  if (uuids.length === 0) return "未绑定节点";
  const names = uuids.map((uuid) => clientsById.get(uuid)?.name || uuid);
  const summary = names.join("、");
  return summary.length > 92 ? `${summary.slice(0, 92)}...` : summary;
}

function pruneBindings(bindings: HomepagePingTaskBindings) {
  const normalized = normalizeHomepagePingTaskBindings(bindings);
  const pruned: HomepagePingTaskBindings = {};

  for (const [taskId, clients] of Object.entries(normalized)) {
    if (clients.length > 0) {
      pruned[taskId] = clients;
    }
  }

  return pruned;
}

function applyClientAssignment(
  bindings: HomepagePingTaskBindings,
  taskId: number,
  clientUuid: string,
  checked: boolean,
) {
  const taskKey = String(taskId);
  const next = pruneBindings(bindings);

  for (const [currentTaskId, clients] of Object.entries(next)) {
    const filtered = clients.filter((uuid) => uuid !== clientUuid);
    if (filtered.length > 0) {
      next[currentTaskId] = filtered;
    } else {
      delete next[currentTaskId];
    }
  }

  if (checked) {
    const selected = next[taskKey] ?? [];
    next[taskKey] = Array.from(new Set([...selected, clientUuid])).sort((left, right) =>
      left.localeCompare(right),
    );
  }

  return next;
}

export function ThemeManage() {
  const { data: config, isLoading: configLoading } = usePublicConfig();
  const backgroundFileInputRef = useRef<HTMLInputElement | null>(null);
  const [draftAppearance, setDraftAppearance] = useState<Appearance>("system");
  const [draftBackground, setDraftBackground] = useState<ThemeBackgroundSettings>(
    DEFAULT_BACKGROUND_SETTINGS,
  );
  const [draftGradientBackground, setDraftGradientBackground] =
    useState<GradientBackgroundSettings>(DEFAULT_GRADIENT_BACKGROUND_SETTINGS);
  const [draftVisualStyle, setDraftVisualStyle] =
    useState<VisualStyleSettings>(DEFAULT_VISUAL_STYLE_SETTINGS);
  const [draftBindings, setDraftBindings] = useState<HomepagePingTaskBindings>({});
  const [draftNodeOrder, setDraftNodeOrder] = useState<string[]>([]);
  const [draftNodeSort, setDraftNodeSort] =
    useState<HomepageNodeSortSettings>(DEFAULT_HOMEPAGE_NODE_SORT);
  const [draggingNodeUuid, setDraggingNodeUuid] = useState<string | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [taskSearch, setTaskSearch] = useState("");
  const [nodeSearch, setNodeSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessRevoked, setAccessRevoked] = useState(false);
  const deferredTaskSearch = useDeferredValue(taskSearch);
  const deferredNodeSearch = useDeferredValue(nodeSearch);
  const deferredOrderSearch = useDeferredValue(orderSearch);

  const {
    data: pingTasks,
    isLoading: tasksLoading,
    error: tasksError,
  } = useQuery({
    queryKey: ["admin", "ping-tasks"],
    queryFn: getAdminPingTasks,
    staleTime: 30_000,
    retry: false,
  });
  const {
    data: adminClients,
    isLoading: clientsLoading,
    error: clientsError,
  } = useQuery({
    queryKey: ["admin", "clients"],
    queryFn: getAdminClients,
    staleTime: 30_000,
    retry: false,
  });

  const sourceAppearance = useMemo(
    () => normalizeAppearance(config?.theme_settings?.defaultAppearance),
    [config?.theme_settings?.defaultAppearance],
  );
  const sourceBackground = useMemo(
    () => normalizeBackgroundSettings(config?.theme_settings?.background),
    [config?.theme_settings?.background],
  );
  const sourceGradientBackground = useMemo(
    () => normalizeGradientBackgroundSettings(config?.theme_settings?.gradientBackground),
    [config?.theme_settings?.gradientBackground],
  );
  const sourceVisualStyle = useMemo(
    () => normalizeVisualStyleSettings(config?.theme_settings?.visualStyle),
    [config?.theme_settings?.visualStyle],
  );
  const sourceBindings = useMemo(
    () => normalizeHomepagePingTaskBindings(config?.theme_settings?.homepagePingBindings),
    [config?.theme_settings?.homepagePingBindings],
  );
  const sourceNodeOrder = useMemo(
    () => normalizeHomepageNodeOrder(config?.theme_settings?.homepageNodeOrder),
    [config?.theme_settings?.homepageNodeOrder],
  );
  const sourceNodeSort = useMemo(
    () => normalizeHomepageNodeSortSettings(config?.theme_settings?.homepageNodeSort),
    [config?.theme_settings?.homepageNodeSort],
  );

  useEffect(() => {
    if (!config) return;
    setDraftAppearance(sourceAppearance);
    setDraftBackground(sourceBackground);
    setDraftGradientBackground(sourceGradientBackground);
    setDraftVisualStyle(sourceVisualStyle);
    setDraftBindings(sourceBindings);
    setDraftNodeOrder(sourceNodeOrder);
    setDraftNodeSort(sourceNodeSort);
  }, [
    config,
    sourceAppearance,
    sourceBackground,
    sourceGradientBackground,
    sourceVisualStyle,
    sourceBindings,
    sourceNodeOrder,
    sourceNodeSort,
  ]);

  const sortedTasks = useMemo(() => sortTasks(pingTasks ?? []), [pingTasks]);
  const sortedClients = useMemo(() => sortClients(adminClients ?? []), [adminClients]);
  const clientsById = useMemo(
    () => new Map(sortedClients.map((client) => [client.uuid, client])),
    [sortedClients],
  );
  const defaultNodeOrder = useMemo(
    () => sortedClients.map((client) => client.uuid),
    [sortedClients],
  );
  const hasClientList = sortedClients.length > 0;
  const effectiveNodeOrder = useMemo(
    () => applyHomepageNodeOrder(defaultNodeOrder, draftNodeOrder),
    [defaultNodeOrder, draftNodeOrder],
  );
  const orderedClients = useMemo(
    () =>
      effectiveNodeOrder
        .map((uuid) => clientsById.get(uuid))
        .filter((client): client is AdminClient => Boolean(client)),
    [clientsById, effectiveNodeOrder],
  );
  const orderIndexByUuid = useMemo(
    () => new Map(effectiveNodeOrder.map((uuid, index) => [uuid, index])),
    [effectiveNodeOrder],
  );

  const filteredTasks = useMemo(() => {
    const keyword = deferredTaskSearch.trim().toLowerCase();
    if (!keyword) return sortedTasks;
    return sortedTasks.filter((task) => {
      return (
        task.name.toLowerCase().includes(keyword) ||
        String(task.id).includes(keyword) ||
        task.type.toLowerCase().includes(keyword) ||
        task.target.toLowerCase().includes(keyword)
      );
    });
  }, [deferredTaskSearch, sortedTasks]);

  const visibleClients = useMemo(() => {
    const keyword = deferredNodeSearch.trim().toLowerCase();
    if (!keyword) return sortedClients;
    return sortedClients.filter((client) => {
      const group = String(client.group || "").toLowerCase();
      const region = String(client.region || "").toLowerCase();
      return (
        client.name.toLowerCase().includes(keyword) ||
        client.uuid.toLowerCase().includes(keyword) ||
        group.includes(keyword) ||
        region.includes(keyword)
      );
    });
  }, [deferredNodeSearch, sortedClients]);

  const visibleOrderClients = useMemo(() => {
    const keyword = deferredOrderSearch.trim().toLowerCase();
    if (!keyword) return orderedClients;
    return orderedClients.filter((client) => {
      const group = String(client.group || "").toLowerCase();
      const region = String(client.region || "").toLowerCase();
      return (
        client.name.toLowerCase().includes(keyword) ||
        client.uuid.toLowerCase().includes(keyword) ||
        group.includes(keyword) ||
        region.includes(keyword)
      );
    });
  }, [deferredOrderSearch, orderedClients]);

  const draftBindingsSerialized = useMemo(
    () => serializeBindings(draftBindings),
    [draftBindings],
  );
  const sourceBindingsSerialized = useMemo(
    () => serializeBindings(sourceBindings),
    [sourceBindings],
  );
  const draftNodeOrderSerialized = useMemo(() => {
    const order = hasClientList
      ? pruneHomepageNodeOrder(draftNodeOrder, defaultNodeOrder)
      : draftNodeOrder;
    return serializeHomepageNodeOrder(order);
  }, [defaultNodeOrder, draftNodeOrder, hasClientList]);
  const sourceNodeOrderSerialized = useMemo(() => {
    const order = hasClientList
      ? pruneHomepageNodeOrder(sourceNodeOrder, defaultNodeOrder)
      : sourceNodeOrder;
    return serializeHomepageNodeOrder(order);
  }, [defaultNodeOrder, hasClientList, sourceNodeOrder]);
  const draftNodeSortSerialized = useMemo(
    () => serializeHomepageNodeSortSettings(draftNodeSort),
    [draftNodeSort],
  );
  const sourceNodeSortSerialized = useMemo(
    () => serializeHomepageNodeSortSettings(sourceNodeSort),
    [sourceNodeSort],
  );
  const draftBackgroundSerialized = useMemo(
    () => getBackgroundSettingsFingerprint(draftBackground),
    [draftBackground],
  );
  const sourceBackgroundSerialized = useMemo(
    () => getBackgroundSettingsFingerprint(sourceBackground),
    [sourceBackground],
  );
  const draftGradientBackgroundSerialized = useMemo(
    () => serializeGradientBackgroundSettings(draftGradientBackground),
    [draftGradientBackground],
  );
  const sourceGradientBackgroundSerialized = useMemo(
    () => serializeGradientBackgroundSettings(sourceGradientBackground),
    [sourceGradientBackground],
  );
  const draftVisualStyleSerialized = useMemo(
    () => serializeVisualStyleSettings(draftVisualStyle),
    [draftVisualStyle],
  );
  const sourceVisualStyleSerialized = useMemo(
    () => serializeVisualStyleSettings(sourceVisualStyle),
    [sourceVisualStyle],
  );
  const isDirty =
    draftAppearance !== sourceAppearance ||
    draftBackgroundSerialized !== sourceBackgroundSerialized ||
    draftGradientBackgroundSerialized !== sourceGradientBackgroundSerialized ||
    draftVisualStyleSerialized !== sourceVisualStyleSerialized ||
    draftNodeOrderSerialized !== sourceNodeOrderSerialized ||
    draftNodeSortSerialized !== sourceNodeSortSerialized ||
    draftBindingsSerialized !== sourceBindingsSerialized;

  const assignedNodeCount = useMemo(
    () => Object.values(draftBindings).reduce((total, clients) => total + clients.length, 0),
    [draftBindings],
  );
  const backgroundSources = useMemo(
    () => getBackgroundSources(draftBackground),
    [draftBackground],
  );
  const backgroundUrlCount = useMemo(
    () => parseBackgroundUrls(draftBackground.urls).length,
    [draftBackground.urls],
  );
  const gradientPreviewStyle = useMemo(
    () =>
      ({
        background: `
          radial-gradient(circle at 16% 18%, color-mix(in srgb, ${draftGradientBackground.colors.accent} 78%, transparent) 0%, transparent ${draftGradientBackground.softness + 28}%),
          radial-gradient(circle at 82% 12%, color-mix(in srgb, ${draftGradientBackground.colors.secondary} 68%, transparent) 0%, transparent ${draftGradientBackground.softness + 24}%),
          linear-gradient(${draftGradientBackground.angle}deg, ${draftGradientBackground.colors.primary} 0%, color-mix(in srgb, ${draftGradientBackground.colors.primary} 48%, white 52%) 34%, ${draftGradientBackground.colors.secondary} 68%, ${draftGradientBackground.colors.accent} 100%)
        `,
        opacity: draftGradientBackground.enabled
          ? Math.min(1, draftGradientBackground.opacity / 100)
          : 0.42,
      }) satisfies CSSProperties,
    [draftGradientBackground],
  );

  const updateBackground = (patch: Partial<ThemeBackgroundSettings>) => {
    setDraftBackground((current) => normalizeBackgroundSettings({ ...current, ...patch }));
    setMessage(null);
  };

  const updateDraftGradientBackground = (
    patch:
      | Partial<GradientBackgroundSettings>
      | ((current: GradientBackgroundSettings) => GradientBackgroundSettings),
  ) => {
    setDraftGradientBackground((current) =>
      normalizeGradientBackgroundSettings(
        typeof patch === "function" ? patch(current) : { ...current, ...patch },
      ),
    );
    setMessage(null);
  };

  const updateDraftVisualStyle = (patch: Partial<VisualStyleSettings>) => {
    setDraftVisualStyle((current) => normalizeVisualStyleSettings({ ...current, ...patch }));
    setMessage(null);
  };

  const updateDraftNodeSort = (patch: Partial<HomepageNodeSortSettings>) => {
    setDraftNodeSort((current) =>
      normalizeHomepageNodeSortSettings({ ...current, ...patch }),
    );
    setMessage(null);
  };

  const handleBackgroundUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    setMessage(null);
    setError(null);

    const availableSlots = Math.max(0, BACKGROUND_MAX_UPLOADS - draftBackground.uploads.length);
    const selectedFiles = files.slice(0, availableSlots);
    const skippedMessages: string[] = [];

    if (files.length > availableSlots) {
      skippedMessages.push(`最多保留 ${BACKGROUND_MAX_UPLOADS} 张背景图。`);
    }

    const uploads: ThemeBackgroundUpload[] = [];
    for (const file of selectedFiles) {
      if (!file.type.startsWith("image/")) {
        skippedMessages.push(`${file.name} 不是图片文件。`);
        continue;
      }
      if (file.size > BACKGROUND_MAX_UPLOAD_BYTES) {
        skippedMessages.push(`${file.name} 超过 ${formatBytes(BACKGROUND_MAX_UPLOAD_BYTES)}。`);
        continue;
      }

      let dataUrl = "";
      try {
        dataUrl = await readFileAsDataUrl(file);
      } catch (readError) {
        skippedMessages.push(
          `${file.name} 读取失败: ${
            readError instanceof Error ? readError.message : "未知错误"
          }`,
        );
        continue;
      }
      const upload: ThemeBackgroundUpload = {
        id: createUploadId(file),
        name: file.name,
        mime: file.type || "image/*",
        size: file.size,
        dataUrl,
        createdAt: Date.now(),
      };
      uploads.push(await optimizeBackgroundUpload(upload));
    }

    if (uploads.length > 0) {
      setDraftBackground((current) =>
        normalizeBackgroundSettings({
          ...current,
          enabled: true,
          source: "upload",
          uploads: [...current.uploads, ...uploads].slice(0, BACKGROUND_MAX_UPLOADS),
        }),
      );
    }

    if (skippedMessages.length > 0) {
      setError(skippedMessages.join(" "));
    }
  };

  const removeBackgroundUpload = (id: string) => {
    setDraftBackground((current) =>
      normalizeBackgroundSettings({
        ...current,
        uploads: current.uploads.filter((upload) => upload.id !== id),
      }),
    );
    setMessage(null);
  };

  const commitNodeOrder = (order: string[]) => {
    setDraftNodeOrder(pruneHomepageNodeOrder(order, defaultNodeOrder));
    setMessage(null);
  };

  const moveNodeOrder = (uuid: string, targetIndex: number) => {
    const currentIndex = effectiveNodeOrder.indexOf(uuid);
    if (currentIndex < 0) return;

    const nextOrder = [...effectiveNodeOrder];
    const [current] = nextOrder.splice(currentIndex, 1);
    const nextIndex = Math.max(0, Math.min(targetIndex, nextOrder.length));
    nextOrder.splice(nextIndex, 0, current);
    commitNodeOrder(nextOrder);
  };

  const moveNodeOrderBefore = (uuid: string, targetUuid: string) => {
    if (uuid === targetUuid) return;
    const currentIndex = effectiveNodeOrder.indexOf(uuid);
    const targetIndex = effectiveNodeOrder.indexOf(targetUuid);
    if (currentIndex < 0 || targetIndex < 0) return;

    const nextOrder = [...effectiveNodeOrder];
    const [current] = nextOrder.splice(currentIndex, 1);
    const nextIndex = currentIndex < targetIndex ? targetIndex - 1 : targetIndex;
    nextOrder.splice(Math.max(0, nextIndex), 0, current);
    commitNodeOrder(nextOrder);
  };

  const handleNodeOrderDragStart = (
    event: DragEvent<HTMLDivElement>,
    uuid: string,
  ) => {
    setDraggingNodeUuid(uuid);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", uuid);
  };

  const handleNodeOrderDrop = (
    event: DragEvent<HTMLDivElement>,
    targetUuid: string,
  ) => {
    event.preventDefault();
    const sourceUuid =
      draggingNodeUuid || event.dataTransfer.getData("text/plain");
    if (sourceUuid) {
      moveNodeOrderBefore(sourceUuid, targetUuid);
    }
    setDraggingNodeUuid(null);
  };

  const resetNodeOrder = () => {
    setDraftNodeOrder([]);
    setDraggingNodeUuid(null);
    setMessage(null);
  };

  const handleSave = async () => {
    if (!config?.theme) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const nextBackground = await optimizeBackgroundUploads(draftBackground);
      const nextGradientBackground = normalizeGradientBackgroundSettings(draftGradientBackground);
      const nextVisualStyle = normalizeVisualStyleSettings(draftVisualStyle);
      const nextBindings = pruneBindings(draftBindings);
      if (getBackgroundSettingsFingerprint(nextBackground) !== draftBackgroundSerialized) {
        setDraftBackground(nextBackground);
      }
      const baseSettings: ThemeSettings & Record<string, unknown> = {
        ...(config.theme_settings ?? {}),
      };
      delete baseSettings.homepagePingTask;
      const nextSettings: ThemeSettings & Record<string, unknown> = {
        ...baseSettings,
        defaultAppearance: draftAppearance,
        background: nextBackground,
        gradientBackground: nextGradientBackground,
        visualStyle: nextVisualStyle,
        homepagePingBindings: nextBindings,
        homepageNodeSort: normalizeHomepageNodeSortSettings(draftNodeSort),
      };
      const nextNodeOrder = hasClientList
        ? pruneHomepageNodeOrder(draftNodeOrder, defaultNodeOrder)
        : normalizeHomepageNodeOrder(draftNodeOrder);
      if (nextNodeOrder.length > 0) {
        nextSettings.homepageNodeOrder = nextNodeOrder;
      } else {
        delete nextSettings.homepageNodeOrder;
      }
      await saveThemeSettings(config.theme, nextSettings);
      queryClient.setQueryData<PublicConfig>(["public"], (current) =>
        current
          ? {
              ...current,
              theme_settings: nextSettings,
            }
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: ["public"] });
      setMessage("主题设置已保存");
    } catch (saveError) {
      if (
        saveError instanceof ApiRequestError &&
        (saveError.status === 401 || saveError.status === 403)
      ) {
        setAccessRevoked(true);
        return;
      }
      setError(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDraftAppearance(sourceAppearance);
    setDraftBackground(sourceBackground);
    setDraftGradientBackground(sourceGradientBackground);
    setDraftVisualStyle(sourceVisualStyle);
    setDraftBindings(sourceBindings);
    setDraftNodeOrder(sourceNodeOrder);
    setDraftNodeSort(sourceNodeSort);
    setDraggingNodeUuid(null);
    setMessage(null);
    setError(null);
  };

  if (configLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size={24} />
      </div>
    );
  }

  if (accessRevoked) {
    return <Navigate to="/" replace />;
  }

  const adminAccessDenied =
    (tasksError instanceof ApiRequestError &&
      (tasksError.status === 401 || tasksError.status === 403)) ||
    (clientsError instanceof ApiRequestError &&
      (clientsError.status === 401 || clientsError.status === 403));

  if (adminAccessDenied) {
    return <Navigate to="/" replace />;
  }

  const adminError =
    (tasksError instanceof Error ? tasksError.message : null) ||
    (clientsError instanceof Error ? clientsError.message : null);
  const noTasksYet = !tasksLoading && !clientsLoading && sortedTasks.length === 0;
  const noFilteredTaskMatch = !tasksLoading && !clientsLoading && !noTasksYet && filteredTasks.length === 0;
  const noClientsYet = !clientsLoading && sortedClients.length === 0;
  const noFilteredOrderMatch =
    !clientsLoading && !noClientsYet && visibleOrderClients.length === 0;

  return (
    <div className="flex flex-col gap-5 py-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/" className="instance-page-back">
          <ArrowLeft size={14} />
          返回首页
        </Link>
        <div className="theme-manage-toolbar-actions">
          <button
            type="button"
            onClick={handleReset}
            disabled={!isDirty || saving}
            className="theme-manage-button"
          >
            <RefreshCw size={14} />
            <span>重置</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="theme-manage-button is-primary"
          >
            {saving ? <Spinner size={14} /> : <Save size={14} />}
            <span>{saving ? "保存中" : "保存设置"}</span>
          </button>
        </div>
      </div>

      <InstancePanel
        title="YS 主题设置"
        description="集中调整 komari-theme-YS 的展示偏好与首页延迟绑定；保存后会立即应用到当前站点。"
        aside={
          <div className="text-right text-[11px] text-[var(--text-tertiary)]">
            <div>主题: {config?.theme || "komari-theme-YS"}</div>
            <div>已绑定首页 Ping 节点 {assignedNodeCount} / {sortedClients.length}</div>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          {message && (
            <div className="rounded-[12px] border border-[color-mix(in_srgb,var(--status-online)_28%,transparent)] bg-[color-mix(in_srgb,var(--status-online)_11%,var(--surface))] px-4 py-3 text-[13px] text-[var(--status-online)]">
              {message}
            </div>
          )}
          {error && (
            <div className="rounded-[12px] border border-[color-mix(in_srgb,var(--status-offline)_28%,transparent)] bg-[color-mix(in_srgb,var(--status-offline)_11%,var(--surface))] px-4 py-3 text-[13px] text-[var(--status-offline)]">
              {error}
            </div>
          )}
          {adminError && (
            <div className="rounded-[12px] border border-[color-mix(in_srgb,var(--status-offline)_28%,transparent)] bg-[color-mix(in_srgb,var(--status-offline)_11%,var(--surface))] px-4 py-3 text-[13px] text-[var(--status-offline)]">
              无法读取后台 Ping 任务或节点列表: {adminError}
            </div>
          )}
        </div>
      </InstancePanel>

      <InstancePanel
        title="默认外观"
        description="为首次访问或尚未手动切换外观的用户设置默认显示模式；后续仍可在首页右上角按需切换。"
        aside={<LayoutTemplate size={16} />}
      >
        <div className="instance-segmented is-scrollable">
          {APPEARANCE_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              data-active={draftAppearance === value ? "true" : "false"}
              onClick={() => setDraftAppearance(value)}
              className="inline-flex items-center justify-center gap-2"
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </InstancePanel>

      <InstancePanel
        title="全站默认卡片样式"
        description="管理员保存后作为游客和未设置本机样式用户的默认卡片与跑马灯风格；首页快捷面板仍可本机覆盖。"
        aside={<Layers size={16} />}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4">
            <div className="surface-inset p-4">
              <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)]">
                <Layers size={14} />
                <span>卡片样式预设</span>
              </div>
              <div className="visual-style-preset-list is-grid">
                {CARD_STYLE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="visual-style-preset"
                    data-active={draftVisualStyle.cardStyle === preset.id ? "true" : "false"}
                    onClick={() => updateDraftVisualStyle({ cardStyle: preset.id })}
                  >
                    <span className="visual-style-preset-name">{preset.label}</span>
                    <span className="visual-style-preset-copy">{preset.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="surface-inset p-4">
              <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)]">
                <Sparkles size={14} />
                <span>跑马灯配色预设</span>
              </div>
              <div className="visual-style-preset-list is-grid">
                {MARQUEE_PALETTE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className="visual-style-preset"
                    data-active={
                      draftVisualStyle.marqueePalette === preset.id ? "true" : "false"
                    }
                    onClick={() =>
                      updateDraftVisualStyle({
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

            <div className="surface-inset p-4">
              <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-[var(--text-primary)]">
                <Palette size={14} />
                <span>自定义指标颜色</span>
              </div>
              <div className="visual-color-grid is-wide">
                {VISUAL_COLOR_CONTROLS.map(({ key, label }) => (
                  <label key={key} className="visual-color-control">
                    <span>{label}</span>
                    <input
                      type="color"
                      value={draftVisualStyle.colors[key]}
                      onChange={(event) =>
                        updateDraftVisualStyle({
                          marqueePalette: "custom",
                          colors: {
                            ...draftVisualStyle.colors,
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

            <div className="gradient-panel-actions flex-wrap">
              <button
                type="button"
                className="theme-manage-button is-compact"
                onClick={() => {
                  setDraftVisualStyle(DEFAULT_VISUAL_STYLE_SETTINGS);
                  setMessage(null);
                }}
              >
                <RefreshCw size={13} />
                <span>恢复主题默认</span>
              </button>
            </div>
          </div>

          <div
            className="visual-style-preview surface-inset"
            data-card-style={draftVisualStyle.cardStyle}
            style={
              (() => {
                return {
                  "--ys-metric-cpu": draftVisualStyle.colors.cpu,
                  "--ys-metric-memory": draftVisualStyle.colors.memory,
                  "--ys-metric-disk": draftVisualStyle.colors.disk,
                  "--ys-metric-load": draftVisualStyle.colors.load,
                  "--ys-metric-latency": draftVisualStyle.colors.latency,
                  "--ys-metric-loss": draftVisualStyle.colors.loss,
                  "--ys-marquee-up": draftVisualStyle.colors.up,
                  "--ys-marquee-down": draftVisualStyle.colors.down,
                  "--ys-marquee-peak": draftVisualStyle.colors.peak,
                  "--ys-marquee-idle": draftVisualStyle.colors.idle,
                } as CSSProperties;
              })()
            }
          >
            <div className="visual-style-preview-head">
              <span>预览</span>
              <span>
                {
                  CARD_STYLE_PRESETS.find(
                    (preset) => preset.id === draftVisualStyle.cardStyle,
                  )?.label
                }
              </span>
            </div>
            <div className="visual-style-preview-card">
              <div className="visual-style-preview-title-row">
                <span className="visual-style-preview-dot" />
                <span className="visual-style-preview-title">Tokyo-01</span>
              </div>
              <div className="visual-style-preview-bars">
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="visual-style-preview-marquee">
                {Array.from({ length: 18 }).map((_, index) => (
                  <span
                    key={index}
                    style={{
                      background:
                        index % 7 === 0
                          ? "var(--ys-marquee-peak)"
                          : index % 3 === 0
                            ? "var(--ys-marquee-down)"
                            : index % 5 === 0
                              ? "var(--ys-marquee-idle)"
                              : "var(--ys-marquee-up)",
                      opacity: index % 5 === 0 ? 0.48 : 0.92,
                    }}
                  />
                ))}
              </div>
              <div className="visual-style-preview-foot">
                <span>128 MB/s</span>
                <span>24 ms</span>
              </div>
            </div>
          </div>
        </div>
      </InstancePanel>

      <InstancePanel
        title="全站默认渐变背板"
        description="管理员保存后会作为未设置本机外观用户的默认样式；用户在首页自行调整后，本机设置仍会优先生效。"
        aside={<Palette size={16} />}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="surface-inset flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[var(--text-primary)]">
                  默认启用渐变背板
                </div>
                <div className="mt-1 text-[12px] text-[var(--text-tertiary)]">
                  首页本机面板可临时覆盖，也可恢复全站默认
                </div>
              </div>
              <button
                type="button"
                className="instance-toggle-button instance-switch-button gradient-panel-switch"
                data-active={draftGradientBackground.enabled ? "true" : "false"}
                onClick={() =>
                  updateDraftGradientBackground({ enabled: !draftGradientBackground.enabled })
                }
                aria-pressed={draftGradientBackground.enabled}
              >
                <span className="instance-switch-copy">渐变</span>
                <span className="instance-switch-track" aria-hidden>
                  <span className="instance-switch-thumb" />
                </span>
                <span className="instance-switch-state">
                  {draftGradientBackground.enabled ? "开启" : "关闭"}
                </span>
              </button>
            </div>

            <div className="gradient-preset-grid" aria-label="全站渐变预设">
              {GRADIENT_BACKGROUND_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={clsx(
                    "gradient-preset-button",
                    draftGradientBackground.preset === preset.id && "is-active",
                  )}
                  onClick={() =>
                    updateDraftGradientBackground((current) =>
                      presetToGradientSettings(preset, current),
                    )
                  }
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
                    value={draftGradientBackground.colors[key]}
                    onChange={(event) =>
                      updateDraftGradientBackground((current) => ({
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

            <div className="grid gap-3 md:grid-cols-2">
              <label className="gradient-range-control">
                <span>
                  <span>角度</span>
                  <strong>{draftGradientBackground.angle}°</strong>
                </span>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={draftGradientBackground.angle}
                  onChange={(event) =>
                    updateDraftGradientBackground({
                      preset: "custom",
                      angle: Number(event.target.value),
                    })
                  }
                />
              </label>

              <label className="gradient-range-control">
                <span>
                  <span>柔和</span>
                  <strong>{draftGradientBackground.softness}px</strong>
                </span>
                <input
                  type="range"
                  min={0}
                  max={80}
                  value={draftGradientBackground.softness}
                  onChange={(event) =>
                    updateDraftGradientBackground({
                      preset: "custom",
                      softness: Number(event.target.value),
                    })
                  }
                />
              </label>

              <label className="gradient-range-control">
                <span>
                  <span>透明</span>
                  <strong>{draftGradientBackground.opacity}%</strong>
                </span>
                <input
                  type="range"
                  min={10}
                  max={200}
                  value={draftGradientBackground.opacity}
                  onChange={(event) =>
                    updateDraftGradientBackground({
                      preset: "custom",
                      opacity: Number(event.target.value),
                    })
                  }
                />
              </label>

              <label className="gradient-range-control">
                <span>
                  <span>色块强度</span>
                  <strong>{draftGradientBackground.surfaceOpacity}%</strong>
                </span>
                <input
                  type="range"
                  min={35}
                  max={200}
                  value={draftGradientBackground.surfaceOpacity}
                  disabled={!draftGradientBackground.tintSurfaces}
                  onChange={(event) =>
                    updateDraftGradientBackground({
                      surfaceOpacity: Number(event.target.value),
                    })
                  }
                />
              </label>
            </div>

            <div className="gradient-surface-sync">
              <div>
                <div className="gradient-surface-title">同步卡片色彩</div>
                <div className="gradient-surface-subtitle">
                  节点卡片、总览和部分色块跟随渐变
                </div>
              </div>
              <button
                type="button"
                className="instance-toggle-button instance-switch-button gradient-panel-switch"
                data-active={draftGradientBackground.tintSurfaces ? "true" : "false"}
                onClick={() =>
                  updateDraftGradientBackground({
                    tintSurfaces: !draftGradientBackground.tintSurfaces,
                  })
                }
                aria-pressed={draftGradientBackground.tintSurfaces}
              >
                <span className="instance-switch-track" aria-hidden>
                  <span className="instance-switch-thumb" />
                </span>
                <span className="instance-switch-state">
                  {draftGradientBackground.tintSurfaces ? "开启" : "关闭"}
                </span>
              </button>
            </div>

            <div className="gradient-panel-actions flex-wrap">
              <button
                type="button"
                className="theme-manage-button is-compact"
                onClick={() =>
                  updateDraftGradientBackground({
                    preset: "custom",
                    grid: !draftGradientBackground.grid,
                  })
                }
                data-active={draftGradientBackground.grid ? "true" : "false"}
              >
                <Grid2X2 size={13} />
                <span>{draftGradientBackground.grid ? "网格开" : "网格关"}</span>
              </button>
              <button
                type="button"
                className="theme-manage-button is-compact"
                onClick={() => {
                  setDraftGradientBackground(DEFAULT_GRADIENT_BACKGROUND_SETTINGS);
                  setMessage(null);
                }}
              >
                <RefreshCw size={13} />
                <span>恢复主题默认</span>
              </button>
            </div>
          </div>

          <div className="surface-inset flex min-h-[260px] flex-col gap-3 p-3">
            <div className="flex items-center justify-between gap-3 text-[12px] font-semibold text-[var(--text-secondary)]">
              <span>全站默认预览</span>
              <span>{draftGradientBackground.enabled ? "启用" : "关闭"}</span>
            </div>
            <div className="relative flex min-h-[220px] overflow-hidden rounded-[12px] border border-[var(--hairline)] bg-[var(--surface)]">
              <div className="absolute inset-0" style={gradientPreviewStyle} />
              {draftGradientBackground.grid && (
                <div
                  className="absolute inset-0 opacity-40"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(255,255,255,0.42) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.34) 1px, transparent 1px)",
                    backgroundSize: "22px 22px",
                  }}
                  aria-hidden
                />
              )}
              <div className="relative z-10 mt-auto grid w-full gap-2 p-4">
                <div className="rounded-[12px] border border-white/40 bg-white/40 px-3 py-3 shadow-[0_18px_36px_-28px_rgba(0,0,0,0.55)] backdrop-blur">
                  <div className="h-2 w-20 rounded-full bg-white/70" />
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="h-9 rounded-[8px] bg-[var(--ys-metric-cpu)]" />
                    <div className="h-9 rounded-[8px] bg-[var(--ys-metric-memory)]" />
                    <div className="h-9 rounded-[8px] bg-[var(--ys-metric-disk)]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="h-16 rounded-[12px] border border-white/40 bg-white/30 backdrop-blur" />
                  <div className="h-16 rounded-[12px] border border-white/40 bg-white/30 backdrop-blur" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </InstancePanel>

      <InstancePanel
        title="首页服务器排序"
        description="设置全站默认排序方式；自定义排序支持拖拽，新增或未排序的服务器会继续按后台权重顺序追加。"
        aside={
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-tertiary)]">
            <ListOrdered size={16} />
            <span>{clientsLoading ? "载入中" : `${effectiveNodeOrder.length} 台服务器`}</span>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="surface-inset flex flex-col gap-3 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[var(--text-primary)]">
                  全站默认排序方式
                </div>
                <div className="mt-1 text-[12px] text-[var(--text-tertiary)]">
                  游客可以在首页临时覆盖；CPU 排序按快照间隔更新位置
                </div>
              </div>
              {isRealtimeNodeSortMode(draftNodeSort.mode) && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--progress-cpu)_30%,var(--hairline))] bg-[color-mix(in_srgb,var(--progress-cpu)_8%,var(--surface))] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                  <Cpu size={13} />
                  <span>{draftNodeSort.realtimeIntervalSeconds}s 快照</span>
                </div>
              )}
            </div>

            <div className="instance-segmented is-scrollable">
              {HOMEPAGE_NODE_SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  data-active={draftNodeSort.mode === option.value ? "true" : "false"}
                  onClick={() => updateDraftNodeSort({ mode: option.value })}
                  title={option.description}
                >
                  <span>{option.label}</span>
                </button>
              ))}
            </div>

            {isRealtimeNodeSortMode(draftNodeSort.mode) && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-[var(--text-tertiary)]">
                  快照间隔
                </span>
                <div className="instance-segmented is-scrollable">
                  {NODE_SORT_INTERVAL_OPTIONS.map((seconds) => (
                    <button
                      key={seconds}
                      type="button"
                      data-active={
                        draftNodeSort.realtimeIntervalSeconds === seconds
                          ? "true"
                          : "false"
                      }
                      onClick={() =>
                        updateDraftNodeSort({ realtimeIntervalSeconds: seconds })
                      }
                    >
                      <span>{seconds}s</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <label className="surface-inset flex items-center gap-2 px-3 py-2">
              <Search size={14} className="text-[var(--text-tertiary)]" />
              <input
                value={orderSearch}
                onChange={(event) => setOrderSearch(event.target.value)}
                placeholder="搜索服务器名称 / UUID / 分组 / 地区"
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--text-tertiary)]"
              />
            </label>
            <button
              type="button"
              onClick={resetNodeOrder}
              disabled={draftNodeOrderSerialized === "[]" || saving}
              className="theme-manage-button"
            >
              <RefreshCw size={14} />
              <span>恢复默认排序</span>
            </button>
          </div>

          {clientsLoading && (
            <div className="flex min-h-[20vh] items-center justify-center">
              <Spinner size={24} />
            </div>
          )}

          {noClientsYet && (
            <div className="theme-manage-empty-state">
              <span>当前还没有可排序的服务器。</span>
              <a href="/admin/client" className="theme-manage-inline-link">
                前往后台添加服务器
              </a>
            </div>
          )}

          {noFilteredOrderMatch && (
            <div className="surface-inset px-4 py-5 text-[13px] text-[var(--text-secondary)]">
              没有匹配的服务器。
            </div>
          )}

          {!clientsLoading && !noClientsYet && !noFilteredOrderMatch && (
            <div className="grid gap-2">
              {visibleOrderClients.map((client) => {
                const orderIndex = orderIndexByUuid.get(client.uuid) ?? -1;
                const isFirst = orderIndex <= 0;
                const isLast = orderIndex >= effectiveNodeOrder.length - 1;
                const subtitle = [client.group, client.region, client.uuid]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <div
                    key={client.uuid}
                    draggable={!saving}
                    onDragStart={(event) => handleNodeOrderDragStart(event, client.uuid)}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(event) => handleNodeOrderDrop(event, client.uuid)}
                    onDragEnd={() => setDraggingNodeUuid(null)}
                    className={clsx(
                      "surface-inset flex flex-wrap items-center gap-3 px-3 py-3 transition-opacity",
                      !saving && "cursor-grab active:cursor-grabbing",
                      draggingNodeUuid === client.uuid && "opacity-55",
                    )}
                  >
                    <div
                      className="grid h-9 w-7 shrink-0 place-items-center text-[var(--text-tertiary)]"
                      title="拖拽排序"
                      aria-hidden
                    >
                      <GripVertical size={16} />
                    </div>
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-[var(--hairline)] bg-[var(--surface)] text-[12px] font-semibold text-[var(--text-tertiary)]">
                      {orderIndex + 1}
                    </div>
                    <div className="min-w-0 flex flex-1 items-center gap-3">
                      <Flag region={client.region} size={18} />
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold text-[var(--text-primary)]">
                          {client.name || client.uuid}
                        </div>
                        <div className="mt-1 truncate text-[11px] text-[var(--text-tertiary)]">
                          {subtitle || "未设置分组"}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        className="theme-manage-button is-compact"
                        onClick={() => moveNodeOrder(client.uuid, 0)}
                        disabled={isFirst}
                        aria-label={`置顶 ${client.name || client.uuid}`}
                        title="置顶"
                      >
                        <ChevronsUp size={13} />
                      </button>
                      <button
                        type="button"
                        className="theme-manage-button is-compact"
                        onClick={() => moveNodeOrder(client.uuid, orderIndex - 1)}
                        disabled={isFirst}
                        aria-label={`上移 ${client.name || client.uuid}`}
                        title="上移"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        className="theme-manage-button is-compact"
                        onClick={() => moveNodeOrder(client.uuid, orderIndex + 1)}
                        disabled={isLast}
                        aria-label={`下移 ${client.name || client.uuid}`}
                        title="下移"
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        type="button"
                        className="theme-manage-button is-compact"
                        onClick={() => moveNodeOrder(client.uuid, effectiveNodeOrder.length - 1)}
                        disabled={isLast}
                        aria-label={`置底 ${client.name || client.uuid}`}
                        title="置底"
                      >
                        <ChevronsDown size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </InstancePanel>

      <InstancePanel
        title="背景板"
        description="设置全站背景图片。可以使用图片链接，也可以上传图片保存到主题设置；多张图片可按间隔轮换。"
        aside={<ImageIcon size={16} />}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="surface-inset flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[var(--text-primary)]">启用背景板</div>
                <div className="mt-1 text-[12px] text-[var(--text-tertiary)]">
                  当前来源 {draftBackground.source === "upload" ? "上传图片" : "图片链接"}，可用 {backgroundSources.length} 张
                </div>
              </div>
              <button
                type="button"
                className="instance-toggle-button instance-switch-button"
                data-active={draftBackground.enabled ? "true" : "false"}
                onClick={() => updateBackground({ enabled: !draftBackground.enabled })}
                aria-pressed={draftBackground.enabled}
              >
                <span className="instance-switch-copy">背景</span>
                <span className="instance-switch-track" aria-hidden>
                  <span className="instance-switch-thumb" />
                </span>
                <span className="instance-switch-state">
                  {draftBackground.enabled ? "开启" : "关闭"}
                </span>
              </button>
            </div>

            <div className="instance-segmented is-scrollable">
              {BACKGROUND_SOURCE_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  data-active={draftBackground.source === value ? "true" : "false"}
                  onClick={() => updateBackground({ source: value, enabled: true })}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {draftBackground.source === "url" ? (
              <label className="flex flex-col gap-2">
                <span className="text-[12px] font-semibold text-[var(--text-secondary)]">
                  图片链接，每行一个，支持 GIF / WebP / APNG
                </span>
                <textarea
                  value={draftBackground.urls}
                  onChange={(event) =>
                    updateBackground({
                      urls: event.target.value,
                      source: "url",
                      enabled: true,
                    })
                  }
                  className="surface-inset min-h-[128px] resize-y bg-transparent px-3 py-3 text-[13px] leading-6 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
                  placeholder="https://example.com/background.webp"
                />
                <span className="text-[11px] text-[var(--text-tertiary)]">
                  已识别 {backgroundUrlCount} 个有效图片链接
                </span>
              </label>
            ) : (
              <div className="flex flex-col gap-3">
                <input
                  ref={backgroundFileInputRef}
                  type="file"
                  accept={BACKGROUND_UPLOAD_ACCEPT}
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    void handleBackgroundUpload(event);
                  }}
                />
                <div className="surface-inset flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 text-[12px] text-[var(--text-secondary)]">
                    已上传 {draftBackground.uploads.length} / {BACKGROUND_MAX_UPLOADS} 张，单张上限 {formatBytes(BACKGROUND_MAX_UPLOAD_BYTES)}
                  </div>
                  <button
                    type="button"
                    className="theme-manage-button is-compact"
                    onClick={() => backgroundFileInputRef.current?.click()}
                    disabled={draftBackground.uploads.length >= BACKGROUND_MAX_UPLOADS}
                  >
                    <Upload size={13} />
                    <span>选择图片</span>
                  </button>
                </div>
                {draftBackground.uploads.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {draftBackground.uploads.map((upload) => (
                      <div key={upload.id} className="surface-inset overflow-hidden">
                        <div className="aspect-[16/9] bg-[var(--surface)]">
                          <img
                            src={upload.dataUrl}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                            draggable={false}
                          />
                        </div>
                        <div className="flex items-center justify-between gap-2 px-3 py-2">
                          <div className="min-w-0">
                            <div className="truncate text-[12px] font-semibold text-[var(--text-primary)]">
                              {upload.name}
                            </div>
                            <div className="text-[11px] text-[var(--text-tertiary)]">
                              {formatBytes(upload.size)}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="theme-manage-button is-compact is-danger"
                            onClick={() => removeBackgroundUpload(upload.id)}
                            aria-label={`删除 ${upload.name}`}
                            title="删除"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="surface-inset px-4 py-5 text-[13px] text-[var(--text-secondary)]">
                    还没有上传背景图片。
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="surface-inset flex flex-col gap-3 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-[var(--text-secondary)]">
                    <Shuffle size={13} />
                    背景轮换
                  </span>
                  <button
                    type="button"
                    className="instance-toggle-button instance-switch-button"
                    data-active={draftBackground.rotationEnabled ? "true" : "false"}
                    onClick={() =>
                      updateBackground({ rotationEnabled: !draftBackground.rotationEnabled })
                    }
                    aria-pressed={draftBackground.rotationEnabled}
                  >
                    <span className="instance-switch-track" aria-hidden>
                      <span className="instance-switch-thumb" />
                    </span>
                    <span className="instance-switch-state">
                      {draftBackground.rotationEnabled ? "开启" : "关闭"}
                    </span>
                  </button>
                </div>
                <label className="flex items-center justify-between gap-3 text-[12px] text-[var(--text-secondary)]">
                  <span>间隔秒数</span>
                  <input
                    type="number"
                    min={3}
                    max={300}
                    value={draftBackground.rotationSeconds}
                    onChange={(event) =>
                      updateBackground({ rotationSeconds: Number(event.target.value) })
                    }
                    className="surface-inset h-9 w-24 bg-transparent px-3 text-right text-[13px] text-[var(--text-primary)] outline-none"
                  />
                </label>
              </div>

              <div className="surface-inset flex flex-col gap-3 px-4 py-3">
                <label className="flex flex-col gap-2 text-[12px] text-[var(--text-secondary)]">
                  <span className="flex items-center justify-between gap-3">
                    <span>图片透明度</span>
                    <strong className="text-[var(--text-primary)]">{draftBackground.opacity}%</strong>
                  </span>
                  <input
                    type="range"
                    min={8}
                    max={100}
                    value={draftBackground.opacity}
                    onChange={(event) =>
                      updateBackground({ opacity: Number(event.target.value) })
                    }
                  />
                </label>
                <label className="flex flex-col gap-2 text-[12px] text-[var(--text-secondary)]">
                  <span className="flex items-center justify-between gap-3">
                    <span>背景模糊</span>
                    <strong className="text-[var(--text-primary)]">{draftBackground.blur}px</strong>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={40}
                    value={draftBackground.blur}
                    onChange={(event) => updateBackground({ blur: Number(event.target.value) })}
                  />
                </label>
              </div>

              <label className="surface-inset flex items-center justify-between gap-3 px-4 py-3 text-[12px] text-[var(--text-secondary)]">
                <span>适配方式</span>
                <select
                  value={draftBackground.fit}
                  onChange={(event) =>
                    updateBackground({
                      fit: event.target.value as ThemeBackgroundSettings["fit"],
                    })
                  }
                  className="bg-transparent text-[13px] font-semibold text-[var(--text-primary)] outline-none"
                >
                  {BACKGROUND_FIT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="surface-inset flex items-center justify-between gap-3 px-4 py-3 text-[12px] text-[var(--text-secondary)]">
                <span>图片位置</span>
                <select
                  value={draftBackground.position}
                  onChange={(event) => updateBackground({ position: event.target.value })}
                  className="bg-transparent text-[13px] font-semibold text-[var(--text-primary)] outline-none"
                >
                  {BACKGROUND_POSITION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="surface-inset flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-[var(--text-secondary)]">
                    图片置顶
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                    开启后图片叠在节点上方，只保留透明度
                  </div>
                </div>
                <button
                  type="button"
                  className="instance-toggle-button instance-switch-button"
                  data-active={draftBackground.layer === "front" ? "true" : "false"}
                  onClick={() =>
                    updateBackground({
                      layer: draftBackground.layer === "front" ? "back" : "front",
                    })
                  }
                  aria-pressed={draftBackground.layer === "front"}
                >
                  <span className="instance-switch-track" aria-hidden>
                    <span className="instance-switch-thumb" />
                  </span>
                  <span className="instance-switch-state">
                    {draftBackground.layer === "front" ? "开启" : "关闭"}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="surface-inset flex min-h-[220px] flex-col gap-3 p-3">
            <div className="flex items-center justify-between gap-3 text-[12px] font-semibold text-[var(--text-secondary)]">
              <span>背景预览</span>
              <span>{backgroundSources.length} 张</span>
            </div>
            <div className="relative aspect-[4/5] overflow-hidden rounded-[10px] bg-[var(--surface)]">
              {backgroundSources[0] ? (
                <>
                  <img
                    src={backgroundSources[0].url}
                    alt=""
                    className="h-full w-full"
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    style={{
                      objectFit: draftBackground.fit,
                      objectPosition: draftBackground.position,
                      opacity: draftBackground.opacity / 100,
                      filter: `blur(${draftBackground.blur}px)`,
                    }}
                  />
                  {draftBackground.layer === "back" && (
                    <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--bg-0)_58%,transparent)]" />
                  )}
                </>
              ) : (
                <div className="grid h-full place-items-center px-5 text-center text-[12px] text-[var(--text-tertiary)]">
                  添加图片后显示预览
                </div>
              )}
            </div>
          </div>
        </div>
      </InstancePanel>

      <InstancePanel
        title="主页延迟检测"
        description={
          <>
            为首页延迟卡片指定对应的 Ping 任务与展示节点。每个节点只能归属一个任务；未分配的节点不会显示延迟。
            {" "}
            如果当前还没有可用任务，请先前往
            {" "}
            <a href="/admin/ping" className="theme-manage-inline-link">
              后台 Ping 管理
            </a>
            {" "}
            创建任务，再回来完成绑定。
          </>
        }
        aside={
          <div className="text-[11px] text-[var(--text-tertiary)]">
            {tasksLoading || clientsLoading ? "载入中" : `${sortedTasks.length} 个任务`}
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
            <label className="surface-inset flex items-center gap-2 px-3 py-2">
              <Search size={14} className="text-[var(--text-tertiary)]" />
              <input
                value={taskSearch}
                onChange={(event) => setTaskSearch(event.target.value)}
                placeholder="搜索 Ping 任务名称 / ID / 类型 / 目标"
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--text-tertiary)]"
              />
            </label>
            <div className="surface-inset flex items-center justify-between gap-3 px-3 py-2 text-[12px] text-[var(--text-secondary)]">
              <span>首页绑定总数</span>
              <strong className="text-[var(--text-primary)]">
                {assignedNodeCount} / {sortedClients.length}
              </strong>
            </div>
          </div>

          {(tasksLoading || clientsLoading) && (
            <div className="flex min-h-[20vh] items-center justify-center">
              <Spinner size={24} />
            </div>
          )}

          {noTasksYet && (
            <div className="theme-manage-empty-state">
              <span>当前还没有可用于首页展示的 Ping 任务。</span>
              <a href="/admin/ping" className="theme-manage-inline-link">
                前往后台 Ping 管理创建任务
              </a>
            </div>
          )}

          {noFilteredTaskMatch && (
            <div className="surface-inset px-4 py-5 text-[13px] text-[var(--text-secondary)]">
              没有匹配的 Ping 任务。
            </div>
          )}

          {!tasksLoading &&
            !clientsLoading &&
            !noTasksYet &&
            filteredTasks.map((task) => {
              const assigned = draftBindings[String(task.id)] ?? [];
              const isExpanded = expandedTaskId === task.id;
              const assignedSet = isExpanded ? new Set(assigned) : null;
              const assignedSummary = summarizeNodes(assigned, clientsById);
              return (
                <section key={task.id} className="surface-inset px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[15px] font-semibold text-[var(--text-primary)]">
                          {task.name || `任务 #${task.id}`}
                        </h3>
                        <span className="rounded-full border border-[var(--hairline)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                          {task.type || "icmp"}
                        </span>
                        <span className="rounded-full border border-[var(--hairline)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">
                          {task.interval}s
                        </span>
                        <span className="rounded-full border border-[var(--hairline)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">
                          ID {task.id}
                        </span>
                      </div>
                      <div className="mt-2 text-[12px] text-[var(--text-secondary)]">
                        <span className="font-medium text-[var(--text-primary)]">
                          已绑定 {assigned.length} 个节点
                        </span>
                        <span className="mx-2 text-[var(--text-tertiary)]">·</span>
                        <span title={task.target || ""}>{task.target || "未填写目标"}</span>
                      </div>
                      <p
                        className="mt-2 text-[12px] text-[var(--text-tertiary)]"
                        title={assignedSummary}
                      >
                        {assignedSummary}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {assigned.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setDraftBindings((prev) => {
                              const next = { ...prev };
                              delete next[String(task.id)];
                              return pruneBindings(next);
                            });
                          }}
                          className="theme-manage-button is-compact is-danger"
                        >
                          清空节点
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedTaskId((current) => (current === task.id ? null : task.id));
                          setNodeSearch("");
                        }}
                        className="theme-manage-button is-compact"
                      >
                        {isExpanded ? "收起节点" : "编辑节点"}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 border-t border-[var(--hairline)] pt-4">
                      <label className="surface-inset flex items-center gap-2 px-3 py-2">
                        <Search size={14} className="text-[var(--text-tertiary)]" />
                        <input
                          value={nodeSearch}
                          onChange={(event) => setNodeSearch(event.target.value)}
                          placeholder="搜索节点名称 / UUID / 分组 / 地区"
                          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--text-tertiary)]"
                        />
                      </label>

                      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {visibleClients.map((client) => {
                          const checked = assignedSet?.has(client.uuid) ?? false;
                          const subtitle = [client.group, client.uuid].filter(Boolean).join(" · ");
                          return (
                            <label
                              key={client.uuid}
                              className={clsx(
                                "flex cursor-pointer items-start gap-3 rounded-[12px] border px-3 py-3 transition-colors",
                                checked
                                  ? "border-[var(--border-strong)] bg-[color-mix(in_srgb,var(--hover-bg)_72%,transparent)]"
                                  : "border-[var(--hairline)] bg-transparent hover:bg-[var(--hover-bg)]",
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => {
                                  const nextChecked = event.target.checked;
                                  setDraftBindings((prev) =>
                                    applyClientAssignment(prev, task.id, client.uuid, nextChecked),
                                  );
                                }}
                                className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent-500)]"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <Flag region={client.region} size={14} />
                                  <span className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                                    {client.name}
                                  </span>
                                </div>
                                <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                                  {subtitle || client.region || "未设置分组"}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
        </div>
      </InstancePanel>
    </div>
  );
}
