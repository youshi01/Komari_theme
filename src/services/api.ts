import { z } from "zod";
import { getRpc2Client } from "@/services/rpc2Client";
import {
  MeSchema,
  NodeInfoSchema,
  PublicConfigSchema,
  AdminClientSchema,
  VersionSchema,
  LoadRecordSchema,
  PingRecordSchema,
  PingTaskSchema,
  PingBasicInfoSchema,
  type Me,
  type NodeInfo,
  type PublicConfig,
  type AdminClient,
  type Version,
  type LoadRecordsResponse,
  type PingRecordsResponse,
  type PingTask,
  type PingBasicInfo,
} from "@/types/komari";

const ApiEnvelope = <T extends z.ZodTypeAny>(inner: T) =>
  z.object({
    status: z.string().optional(),
    message: z.string().optional(),
    data: inner,
  });

const RpcRecordsSchema = z
  .object({
    count: z.number().default(0),
    records: z.unknown().optional(),
    tasks: z.unknown().optional(),
    basic_info: z.unknown().optional(),
  })
  .passthrough();

const LOAD_RECORDS_PER_HOUR = 12;
const MAX_RPC_RECORDS = 20_000;
const OVERVIEW_PING_MAX_COUNT = 4_000;
const PING_DETAIL_RPC_TIMEOUT_MS = 60_000;
const ASYNC_JSON_STRINGIFY_THRESHOLD = 512 * 1024;

interface RpcRecordsPayload {
  count?: number;
  records?: unknown;
  tasks?: unknown;
  basic_info?: unknown;
}

interface RpcCallOptions {
  timeout?: number;
}

export interface PingOverviewResponse {
  count: number;
  records: PingRecordsResponse["records"];
  tasks: PingTask[];
  basicInfo: PingBasicInfo[];
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly path: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function estimateJsonPayloadSize(
  value: unknown,
  seen = new Set<object>(),
  limit = ASYNC_JSON_STRINGIFY_THRESHOLD,
): number {
  if (limit <= 0) return ASYNC_JSON_STRINGIFY_THRESHOLD;
  if (value == null) return 4;
  if (typeof value === "string") return value.length + 2;
  if (typeof value === "number" || typeof value === "boolean") return 8;
  if (typeof value !== "object") return 0;
  if (seen.has(value)) return 0;
  seen.add(value);

  if (Array.isArray(value)) {
    let total = 2;
    for (const item of value) {
      total += estimateJsonPayloadSize(item, seen, limit - total) + 1;
      if (total >= limit) return total;
    }
    return total;
  }

  let total = 2;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    total += key.length + estimateJsonPayloadSize(item, seen, limit - total) + 4;
    if (total >= limit) return total;
  }
  return total;
}

function stringifyJsonInWorker(value: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    const workerSource = `
      self.onmessage = function(event) {
        try {
          self.postMessage({ ok: true, value: JSON.stringify(event.data) });
        } catch (error) {
          self.postMessage({
            ok: false,
            message: error && error.message ? error.message : "JSON stringify failed"
          });
        }
      };
    `;
    const workerUrl = URL.createObjectURL(
      new Blob([workerSource], { type: "text/javascript" }),
    );
    const worker = new Worker(workerUrl);
    const cleanup = () => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
    };

    worker.onmessage = (event: MessageEvent<{ ok: boolean; value?: string; message?: string }>) => {
      cleanup();
      if (event.data.ok && typeof event.data.value === "string") {
        resolve(event.data.value);
        return;
      }
      reject(new Error(event.data.message || "JSON stringify failed"));
    };
    worker.onerror = (event) => {
      cleanup();
      reject(new Error(event.message || "JSON stringify failed"));
    };
    worker.postMessage(value);
  });
}

async function stringifyJsonBody(value: unknown) {
  if (
    typeof Worker !== "undefined" &&
    typeof Blob !== "undefined" &&
    typeof URL !== "undefined" &&
    estimateJsonPayloadSize(value) >= ASYNC_JSON_STRINGIFY_THRESHOLD
  ) {
    try {
      return await stringifyJsonInWorker(value);
    } catch {
      // Fall back to the main thread if workers are blocked by browser policy.
    }
  }

  return JSON.stringify(value);
}

function normalizeRpcLatestStatus(
  payload: unknown,
): Record<string, unknown> {
  const direct = z.record(z.string(), z.unknown()).safeParse(payload);
  if (direct.success) {
    return direct.data;
  }

  const wrapped = z
    .object({
      records: z.record(z.string(), z.unknown()).default({}),
    })
    .passthrough()
    .safeParse(payload);
  if (wrapped.success) {
    return wrapped.data.records;
  }

  return {};
}

function getRecordsMaxCount(hours: number, recordsPerHour: number) {
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 1;
  return Math.min(
    MAX_RPC_RECORDS,
    Math.max(recordsPerHour, Math.ceil(safeHours * recordsPerHour)),
  );
}

function normalizeHistoryHours(hours: number) {
  return Number.isFinite(hours) && hours > 0 ? Math.max(1, Math.floor(hours)) : 1;
}

function buildHistoryWindow(hours: number) {
  const safeHours = normalizeHistoryHours(hours);
  const end = new Date();
  const start = new Date(end.getTime() - safeHours * 60 * 60 * 1000);
  return {
    hours: safeHours,
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

async function apiGet<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const resp = await fetch(path, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!resp.ok) {
    throw new ApiRequestError(`Request ${path} failed: ${resp.status}`, resp.status, path);
  }
  const json = (await resp.json()) as unknown;
  const envelopeResult = ApiEnvelope(schema).safeParse(json);
  if (envelopeResult.success) return envelopeResult.data.data as T;
  const rawResult = schema.safeParse(json);
  if (rawResult.success) return rawResult.data;
  throw new Error(
    `Schema mismatch on ${path}: ${envelopeResult.error.issues[0]?.message ?? ""}`,
  );
}

async function rpcCall<T>(
  method: string,
  params: Record<string, unknown>,
  schema: z.ZodType<T>,
  options: RpcCallOptions = {},
): Promise<T> {
  const payload = await getRpc2Client().call(method, params, options);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(
      `Schema mismatch on rpc:${method}: ${parsed.error.issues[0]?.message ?? ""}`,
    );
  }
  return parsed.data;
}

function normalizeRpcLoadRecords(
  uuid: string,
  payload: RpcRecordsPayload,
): LoadRecordsResponse {
  const rawRecords = Array.isArray(payload.records)
    ? payload.records
    : payload.records &&
        typeof payload.records === "object" &&
        Array.isArray((payload.records as Record<string, unknown>)[uuid])
      ? (payload.records as Record<string, unknown>)[uuid]
      : [];
  const records = z.array(LoadRecordSchema).parse(rawRecords);
  return {
    count: payload.count || records.length,
    records,
  };
}

function derivePingTasks(records: PingRecordsResponse["records"]): PingTask[] {
  return Array.from(new Set(records.map((record) => record.task_id)))
    .sort((a, b) => a - b)
    .map((id) => ({
      id,
      interval: 60,
      name: `任务 #${id}`,
      loss: 0,
      clients: [],
      type: "icmp",
      target: "",
      weight: id,
    }));
}

function normalizeRpcPingRecords(
  payload: RpcRecordsPayload,
): PingRecordsResponse {
  const records = z.array(PingRecordSchema).parse(
    Array.isArray(payload.records) ? payload.records : [],
  );
  const parsedTasks = z.array(PingTaskSchema).safeParse(payload.tasks);
  const tasks = parsedTasks.success ? parsedTasks.data : derivePingTasks(records);
  return {
    count: payload.count || records.length,
    records,
    tasks,
  };
}

function normalizeRpcPingOverview(
  payload: RpcRecordsPayload,
): PingOverviewResponse {
  const records = z.array(PingRecordSchema).parse(
    Array.isArray(payload.records) ? payload.records : [],
  );
  const parsedTasks = z.array(PingTaskSchema).safeParse(payload.tasks);
  const basicInfo = z.array(PingBasicInfoSchema).safeParse(payload.basic_info);
  return {
    count: payload.count || records.length,
    records,
    tasks: parsedTasks.success ? parsedTasks.data : derivePingTasks(records),
    basicInfo: basicInfo.success ? basicInfo.data : [],
  };
}

export async function getMe(): Promise<Me> {
  return (await apiGet("/api/me", MeSchema)) as Me;
}

export async function getPublic(): Promise<PublicConfig> {
  return (await apiGet("/api/public", PublicConfigSchema)) as PublicConfig;
}

export async function getVersion(): Promise<Version> {
  return (await apiGet("/api/version", VersionSchema)) as Version;
}

export async function getNodesLatestStatus(
  uuids?: string[],
): Promise<Record<string, unknown>> {
  const payload = await rpcCall(
    "common:getNodesLatestStatus",
    uuids && uuids.length > 0 ? { uuids } : {},
    z.unknown(),
  );
  return normalizeRpcLatestStatus(payload);
}

export async function getNodes(): Promise<NodeInfo[]> {
  return (await apiGet("/api/nodes", z.array(NodeInfoSchema))) as NodeInfo[];
}

export async function getAdminClients(): Promise<AdminClient[]> {
  return (await apiGet("/api/admin/client/list", z.array(AdminClientSchema))) as AdminClient[];
}

export async function getLoadRecords(
  uuid: string,
  hours = 6,
): Promise<LoadRecordsResponse> {
  try {
    const maxCount = getRecordsMaxCount(hours, LOAD_RECORDS_PER_HOUR);
    const payload = await rpcCall(
      "common:getRecords",
      {
        uuid,
        hours,
        type: "load",
        maxCount,
      },
      RpcRecordsSchema,
    );
    return normalizeRpcLoadRecords(uuid, payload);
  } catch {
    return (await apiGet(
      `/api/records/load?uuid=${encodeURIComponent(uuid)}&hours=${hours}`,
      z.object({
        count: z.number().default(0),
        records: z.array(LoadRecordSchema).default([]),
      }),
    )) as LoadRecordsResponse;
  }
}

export async function getPingRecords(
  uuid: string,
  hours = 6,
): Promise<PingRecordsResponse> {
  const safeHours = normalizeHistoryHours(hours);
  try {
    return (await apiGet(
      `/api/records/ping?uuid=${encodeURIComponent(uuid)}&hours=${safeHours}`,
      z.object({
        count: z.number().default(0),
        records: z.array(PingRecordSchema).default([]),
        tasks: z.array(PingTaskSchema).default([]),
      }),
    )) as PingRecordsResponse;
  } catch {
    const window = buildHistoryWindow(safeHours);
    const payload = await rpcCall(
      "common:getRecords",
      {
        uuid,
        ...window,
        type: "ping",
        task_id: -1,
        maxCount: -1,
      },
      RpcRecordsSchema,
      { timeout: PING_DETAIL_RPC_TIMEOUT_MS },
    );
    return normalizeRpcPingRecords(payload);
  }
}

export async function getPublicPingTasks(): Promise<PingTask[]> {
  return (await apiGet("/api/task/ping", z.array(PingTaskSchema))) as PingTask[];
}

export async function getAdminPingTasks(): Promise<PingTask[]> {
  return (await apiGet("/api/admin/ping", z.array(PingTaskSchema))) as PingTask[];
}

export async function saveThemeSettings(
  theme: string,
  settings: Record<string, unknown>,
): Promise<void> {
  const body = await stringifyJsonBody(settings);
  const resp = await fetch(`/api/admin/theme/settings?theme=${encodeURIComponent(theme)}`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body,
  });

  if (!resp.ok) {
    let message = `Request /api/admin/theme/settings failed: ${resp.status}`;
    try {
      const json = (await resp.json()) as { message?: string };
      if (json?.message) {
        message = json.message;
      }
    } catch {
      // Keep the fallback error message when the body is not JSON.
    }
    throw new ApiRequestError(message, resp.status, "/api/admin/theme/settings");
  }
}

export async function getPingOverview(
  hours = 1,
  taskId?: number,
): Promise<PingOverviewResponse> {
  try {
    const payload = await rpcCall(
      "common:getRecords",
      {
        hours,
        type: "ping",
        ...(taskId ? { task_id: taskId } : {}),
        maxCount: OVERVIEW_PING_MAX_COUNT,
      },
      RpcRecordsSchema,
    );
    return normalizeRpcPingOverview(payload);
  } catch {
    if (!taskId) {
      throw new Error("Ping overview fallback requires a concrete task_id");
    }

    const data = await apiGet(
      `/api/records/ping?task_id=${encodeURIComponent(taskId)}&hours=${hours}`,
      z.object({
        count: z.number().default(0),
        records: z.array(PingRecordSchema).default([]),
        tasks: z.array(PingTaskSchema).default([]),
        basic_info: z.array(PingBasicInfoSchema).default([]),
      }),
    );
    return {
      count: data.count,
      records: data.records,
      tasks: data.tasks,
      basicInfo: data.basic_info,
    } as PingOverviewResponse;
  }
}
