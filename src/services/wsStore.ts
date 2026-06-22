import type { NodeDisplay, NodeInfo, NodeRealtime, TrafficTrendSample } from "@/types/komari";
import { getNodes, getNodesLatestStatus } from "@/services/api";

type Listener = () => void;
type RealtimePayload = Record<string, unknown>;

interface State {
  byUuid: Record<string, NodeDisplay>;
  trafficTrends: Record<string, NodeTrafficTrend>;
  order: string[];
  lastSuccessAt: number;
  failureStreak: number;
}

interface TrafficTrendSeries {
  buffer: TrafficTrendSample[];
  start: number;
  size: number;
  signature: string;
  snapshot: TrafficTrendSample[];
}

interface NodeTrafficTrend {
  up: TrafficTrendSeries;
  down: TrafficTrendSeries;
  snapshot: {
    up: TrafficTrendSample[];
    down: TrafficTrendSample[];
  };
}

const LIVE_STATUS_REFRESH_INTERVAL_MS = 2_000;
const NODE_INFO_REFRESH_INTERVAL_MS = 30_000;
const SCROLL_IDLE_DELAY_MS = 160;
const TRAFFIC_TREND_SAMPLE_COUNT = 18;
const EMPTY_TRAFFIC_TREND_SAMPLE: TrafficTrendSample = {
  value: 0,
  level: 0.25,
  opacity: 0.52,
};
const EMPTY_TRAFFIC_TREND_SNAPSHOT = Array.from(
  { length: TRAFFIC_TREND_SAMPLE_COUNT },
  () => EMPTY_TRAFFIC_TREND_SAMPLE,
);
const EMPTY_TRAFFIC_TREND_SERIES: TrafficTrendSeries = {
  buffer: [],
  start: 0,
  size: 0,
  signature: "",
  snapshot: EMPTY_TRAFFIC_TREND_SNAPSHOT,
};
const EMPTY_NODE_TRAFFIC_TREND_SNAPSHOT = {
  up: EMPTY_TRAFFIC_TREND_SNAPSHOT,
  down: EMPTY_TRAFFIC_TREND_SNAPSHOT,
};
const EMPTY_TRAFFIC_TREND: NodeTrafficTrend = {
  up: EMPTY_TRAFFIC_TREND_SERIES,
  down: EMPTY_TRAFFIC_TREND_SERIES,
  snapshot: EMPTY_NODE_TRAFFIC_TREND_SNAPSHOT,
};

function emptyState(): State {
  return {
    byUuid: {},
    trafficTrends: {},
    order: [],
    lastSuccessAt: 0,
    failureStreak: 0,
  };
}

function emptyDisplay(info: NodeInfo, online: boolean | null): NodeDisplay {
  return {
    ...info,
    online,
    cpuPct: 0,
    ramUsed: 0,
    ramTotal: info.mem_total,
    ramPct: 0,
    swapUsed: 0,
    swapTotal: info.swap_total,
    swapPct: 0,
    diskUsed: 0,
    diskTotal: info.disk_total,
    diskPct: 0,
    netUp: 0,
    netDown: 0,
    trafficUp: 0,
    trafficDown: 0,
    uptime: 0,
    load1: 0,
    load5: 0,
    load15: 0,
    process: 0,
    connectionsTcp: 0,
    connectionsUdp: 0,
    updatedAt: 0,
  };
}

function mergeNodeInfo(
  display: NodeDisplay | undefined,
  info: NodeInfo,
): NodeDisplay {
  if (!display) {
    return emptyDisplay(info, null);
  }

  return {
    ...display,
    ...info,
  };
}

function mergeRealtime(
  display: NodeDisplay,
  rt: NodeRealtime,
  online: boolean,
): NodeDisplay {
  const ramUsed = rt.ram?.used ?? 0;
  const ramTotal = rt.ram?.total ?? display.ramTotal ?? display.mem_total;
  const swapUsed = rt.swap?.used ?? 0;
  const swapTotal = rt.swap?.total ?? display.swapTotal ?? display.swap_total;
  const diskUsed = rt.disk?.used ?? 0;
  const diskTotal = rt.disk?.total ?? display.diskTotal ?? display.disk_total;
  const updatedAt = toTimestamp(rt.updated_at);

  return {
    ...display,
    online,
    cpuPct: rt.cpu?.usage ?? 0,
    ramUsed,
    ramTotal,
    ramPct: ramTotal > 0 ? (ramUsed / ramTotal) * 100 : 0,
    swapUsed,
    swapTotal,
    swapPct: swapTotal > 0 ? (swapUsed / swapTotal) * 100 : 0,
    diskUsed,
    diskTotal,
    diskPct: diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0,
    netUp: rt.network?.up ?? 0,
    netDown: rt.network?.down ?? 0,
    trafficUp: rt.network?.totalUp ?? 0,
    trafficDown: rt.network?.totalDown ?? 0,
    uptime: rt.uptime ?? 0,
    load1: rt.load?.load1 ?? 0,
    load5: rt.load?.load5 ?? 0,
    load15: rt.load?.load15 ?? 0,
    process: rt.process ?? 0,
    connectionsTcp: rt.connections?.tcp ?? 0,
    connectionsUdp: rt.connections?.udp ?? 0,
    updatedAt: updatedAt > 0 ? updatedAt : display.updatedAt,
  };
}

function shallowEqualDisplay(a: NodeDisplay, b: NodeDisplay) {
  return (
    a.online === b.online &&
    a.cpuPct === b.cpuPct &&
    a.ramUsed === b.ramUsed &&
    a.ramTotal === b.ramTotal &&
    a.ramPct === b.ramPct &&
    a.swapUsed === b.swapUsed &&
    a.swapTotal === b.swapTotal &&
    a.swapPct === b.swapPct &&
    a.diskUsed === b.diskUsed &&
    a.diskTotal === b.diskTotal &&
    a.diskPct === b.diskPct &&
    a.netUp === b.netUp &&
    a.netDown === b.netDown &&
    a.trafficUp === b.trafficUp &&
    a.trafficDown === b.trafficDown &&
    a.uptime === b.uptime &&
    a.load1 === b.load1 &&
    a.load5 === b.load5 &&
    a.load15 === b.load15 &&
    a.process === b.process &&
    a.connectionsTcp === b.connectionsTcp &&
    a.connectionsUdp === b.connectionsUdp &&
    a.updatedAt === b.updatedAt
  );
}

function materializeTrafficTrendSnapshot(
  buffer: TrafficTrendSample[],
  start: number,
  size: number,
) {
  if (size <= 0) return EMPTY_TRAFFIC_TREND_SNAPSHOT;

  const snapshot = new Array<TrafficTrendSample>(TRAFFIC_TREND_SAMPLE_COUNT);
  const padding = TRAFFIC_TREND_SAMPLE_COUNT - size;

  for (let i = 0; i < padding; i++) {
    snapshot[i] = EMPTY_TRAFFIC_TREND_SAMPLE;
  }

  for (let i = 0; i < size; i++) {
    snapshot[padding + i] = buffer[(start + i) % TRAFFIC_TREND_SAMPLE_COUNT]!;
  }

  return snapshot;
}

function updateTrafficTrendSeries(
  prevSeries: TrafficTrendSeries,
  value: number,
  updatedAt: number,
  online: boolean | null,
) {
  if (online === false) {
    if (!prevSeries.signature && prevSeries.size === 0) {
      return { series: prevSeries, changed: false };
    }
    return { series: EMPTY_TRAFFIC_TREND_SERIES, changed: true };
  }

  const safeValue = Number.isFinite(value) && value > 0 ? value : 0;
  const signature = `${updatedAt || 0}:${safeValue}`;
  if (signature === prevSeries.signature) {
    return { series: prevSeries, changed: false };
  }

  let visibleMax = safeValue > 0 ? safeValue : 1;
  for (let i = 0; i < prevSeries.size; i++) {
    const sample = prevSeries.buffer[(prevSeries.start + i) % TRAFFIC_TREND_SAMPLE_COUNT];
    if (sample && sample.value > visibleMax) {
      visibleMax = sample.value;
    }
  }

  const level = safeValue > 0 ? Math.max(0.2, Math.min(1, safeValue / visibleMax)) : 0.25;
  const nextSample: TrafficTrendSample = {
    value: safeValue,
    level,
    opacity: safeValue > 0 ? 0.4 + level * 0.48 : 0.52,
  };

  const buffer =
    prevSeries.buffer.length === TRAFFIC_TREND_SAMPLE_COUNT
      ? prevSeries.buffer
      : new Array<TrafficTrendSample>(TRAFFIC_TREND_SAMPLE_COUNT);
  const nextSize =
    prevSeries.size < TRAFFIC_TREND_SAMPLE_COUNT
      ? prevSeries.size + 1
      : TRAFFIC_TREND_SAMPLE_COUNT;
  const nextStart =
    prevSeries.size < TRAFFIC_TREND_SAMPLE_COUNT
      ? prevSeries.start
      : (prevSeries.start + 1) % TRAFFIC_TREND_SAMPLE_COUNT;
  const insertIndex =
    prevSeries.size < TRAFFIC_TREND_SAMPLE_COUNT
      ? (prevSeries.start + prevSeries.size) % TRAFFIC_TREND_SAMPLE_COUNT
      : prevSeries.start;

  if (prevSeries.size > 0 && buffer !== prevSeries.buffer) {
    for (let i = 0; i < prevSeries.size; i++) {
      buffer[(prevSeries.start + i) % TRAFFIC_TREND_SAMPLE_COUNT] =
        prevSeries.buffer[(prevSeries.start + i) % TRAFFIC_TREND_SAMPLE_COUNT]!;
    }
  }
  buffer[insertIndex] = nextSample;

  return {
    series: {
      buffer,
      start: nextStart,
      size: nextSize,
      signature,
      snapshot: materializeTrafficTrendSnapshot(buffer, nextStart, nextSize),
    },
    changed: true,
  };
}

let state: State = emptyState();
const globalListeners = new Set<Listener>();
const nodeListeners = new Map<string, Set<Listener>>();
let visibleNodeUuidsSnapshot: string[] = [];
let scrollIdleTimer: number | null = null;
let scrollTrackingStarted = false;
let scrollActive = false;
let refreshDeferredWhileScrolling = false;

function commit(next: State, touched: Iterable<string>) {
  state = next;
  const touchedUuids = [...touched];

  for (const listener of globalListeners) listener();
  for (const uuid of touchedUuids) {
    const listeners = nodeListeners.get(uuid);
    if (listeners) {
      for (const listener of listeners) listener();
    }
  }
}

function markScrollActivity() {
  scrollActive = true;
  if (scrollIdleTimer != null) {
    window.clearTimeout(scrollIdleTimer);
  }
  scrollIdleTimer = window.setTimeout(() => {
    scrollIdleTimer = null;
    scrollActive = false;
    if (refreshDeferredWhileScrolling) {
      refreshDeferredWhileScrolling = false;
      void refreshLatestStatus();
    }
  }, SCROLL_IDLE_DELAY_MS);
}

function ensureScrollTrackingStarted() {
  if (scrollTrackingStarted) return;
  scrollTrackingStarted = true;
  window.addEventListener("scroll", markScrollActivity, { passive: true });
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function asRecord(value: unknown): RealtimePayload {
  return value && typeof value === "object" ? (value as RealtimePayload) : {};
}

function toTimestamp(value: string | number | undefined): number {
  if (typeof value === "number") {
    return value > 1_000_000_000_000 ? value : value * 1000;
  }
  if (!value) return 0;
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric > 1_000_000_000_000 ? numeric : numeric * 1000;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeRealtime(raw: unknown, fallback: NodeDisplay): NodeRealtime | null {
  const payload = asRecord(raw);
  if (Object.keys(payload).length === 0) return null;

  const cpu = asRecord(payload.cpu);
  const ram = asRecord(payload.ram);
  const swap = asRecord(payload.swap);
  const load = asRecord(payload.load);
  const disk = asRecord(payload.disk);
  const network = asRecord(payload.network);
  const connections = asRecord(payload.connections);
  const hasNestedShape =
    Object.keys(cpu).length > 0 ||
    Object.keys(ram).length > 0 ||
    Object.keys(network).length > 0;

  if (hasNestedShape) {
    return {
      cpu: { usage: asNumber(cpu.usage) },
      ram: {
        total: asNumber(ram.total, fallback.ramTotal || fallback.mem_total),
        used: asNumber(ram.used),
      },
      swap: {
        total: asNumber(swap.total, fallback.swapTotal || fallback.swap_total),
        used: asNumber(swap.used),
      },
      load: {
        load1: asNumber(load.load1),
        load5: asNumber(load.load5),
        load15: asNumber(load.load15),
      },
      disk: {
        total: asNumber(disk.total, fallback.diskTotal || fallback.disk_total),
        used: asNumber(disk.used),
      },
      network: {
        up: asNumber(network.up),
        down: asNumber(network.down),
        totalUp: asNumber(network.totalUp),
        totalDown: asNumber(network.totalDown),
      },
      connections: {
        tcp: asNumber(connections.tcp),
        udp: asNumber(connections.udp),
      },
      uptime: asNumber(payload.uptime),
      process: asNumber(payload.process),
      updated_at: (payload.updated_at ?? payload.time) as string | number | undefined,
    };
  }

  return {
    cpu: { usage: asNumber(payload.cpu) },
    ram: {
      total: asNumber(payload.ram_total, fallback.ramTotal || fallback.mem_total),
      used: asNumber(payload.ram),
    },
    swap: {
      total: asNumber(payload.swap_total, fallback.swapTotal || fallback.swap_total),
      used: asNumber(payload.swap),
    },
    load: {
      load1: asNumber(payload.load),
      load5: asNumber(payload.load5),
      load15: asNumber(payload.load15),
    },
    disk: {
      total: asNumber(payload.disk_total, fallback.diskTotal || fallback.disk_total),
      used: asNumber(payload.disk),
    },
    network: {
      up: asNumber(payload.net_out),
      down: asNumber(payload.net_in),
      totalUp: asNumber(payload.net_total_up),
      totalDown: asNumber(payload.net_total_down),
    },
    connections: {
      tcp: asNumber(payload.connections),
      udp: asNumber(payload.connections_udp),
    },
    uptime: asNumber(payload.uptime),
    process: asNumber(payload.process),
    updated_at: (payload.updated_at ?? payload.time) as string | number | undefined,
  };
}

function applyLatestStatus(records: Record<string, unknown>) {
  const touched = new Set<string>();
  const nextByUuid: Record<string, NodeDisplay> = { ...state.byUuid };
  const nextTrafficTrends: Record<string, NodeTrafficTrend> = { ...state.trafficTrends };

  for (const uuid of state.order) {
    const prev = state.byUuid[uuid];
    if (!prev) continue;
    const rawRecord = records[uuid];
    const online = rawRecord != null ? asRecord(rawRecord).online !== false : false;
    const realtime = normalizeRealtime(rawRecord, prev);
    const merged = realtime
      ? mergeRealtime(prev, realtime, online)
      : { ...prev, online };

    if (!shallowEqualDisplay(prev, merged)) {
      nextByUuid[uuid] = merged;
      touched.add(uuid);
    }

    const prevTrend = state.trafficTrends[uuid] ?? EMPTY_TRAFFIC_TREND;
    const nextUp = updateTrafficTrendSeries(
      prevTrend.up,
      merged.netUp,
      merged.updatedAt,
      merged.online,
    );
    const nextDown = updateTrafficTrendSeries(
      prevTrend.down,
      merged.netDown,
      merged.updatedAt,
      merged.online,
    );

    if (nextUp.changed || nextDown.changed) {
      nextTrafficTrends[uuid] = {
        up: nextUp.series,
        down: nextDown.series,
        snapshot: {
          up: nextUp.series.snapshot,
          down: nextDown.series.snapshot,
        },
      };
      touched.add(uuid);
    } else if (!(uuid in nextTrafficTrends)) {
      nextTrafficTrends[uuid] = prevTrend;
    }
  }

  return { nextByUuid, nextTrafficTrends, touched: [...touched] };
}

let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let refreshInFlight = false;
let nodeInfoInFlight = false;
let lastNodeInfoSyncAt = 0;

function sortNodes(nodes: NodeInfo[]) {
  return nodes
    .map((node, index) => ({ node, index }))
    .sort((a, b) => {
      const byWeight = a.node.weight - b.node.weight;
      return byWeight === 0 ? a.index - b.index : byWeight;
    })
    .map(({ node }) => node);
}

async function syncNodeInfo(force = false) {
  if (nodeInfoInFlight) return;
  if (!force && hydrated && Date.now() - lastNodeInfoSyncAt < NODE_INFO_REFRESH_INTERVAL_MS) {
    return;
  }

  nodeInfoInFlight = true;
  try {
    const nodes = sortNodes(await getNodes());
    const order = nodes.map((node) => node.uuid);
    const touched = new Set<string>([...state.order, ...order]);
    const byUuid = Object.fromEntries(
      nodes.map((info) => [info.uuid, mergeNodeInfo(state.byUuid[info.uuid], info)]),
    );
    const trafficTrends = Object.fromEntries(
      order.map((uuid) => [uuid, state.trafficTrends[uuid] ?? EMPTY_TRAFFIC_TREND]),
    );

    hydrated = true;
    hydratePromise = Promise.resolve();
    lastNodeInfoSyncAt = Date.now();
    commit(
      {
        ...state,
        order,
        byUuid,
        trafficTrends,
      },
      touched,
    );
  } finally {
    nodeInfoInFlight = false;
  }
}

async function hydrate() {
  if (hydrated) return;
  if (hydratePromise) return hydratePromise;

  hydratePromise = syncNodeInfo(true).catch((error) => {
    hydratePromise = null;
    throw error;
  });

  return hydratePromise;
}

async function refreshLatestStatus() {
  if (refreshInFlight || state.order.length === 0) return;
  if (scrollActive) {
    refreshDeferredWhileScrolling = true;
    return;
  }

  refreshInFlight = true;
  try {
    const records = await getNodesLatestStatus([...state.order]);
    const applied = applyLatestStatus(records);
    if (applied.touched.length > 0 || state.failureStreak > 0 || state.lastSuccessAt === 0) {
      commit(
        {
          ...state,
          byUuid: applied.touched.length > 0 ? applied.nextByUuid : state.byUuid,
          trafficTrends:
            applied.touched.length > 0 ? applied.nextTrafficTrends : state.trafficTrends,
          lastSuccessAt: Date.now(),
          failureStreak: 0,
        },
        applied.touched,
      );
    }
  } catch {
    commit(
      {
        ...state,
        failureStreak: state.failureStreak + 1,
      },
      [],
    );
  } finally {
    refreshInFlight = false;
  }
}

async function bootstrap() {
  try {
    await hydrate();
    await syncNodeInfo();
    await refreshLatestStatus();
  } catch {
    // Retry on the next scheduled tick.
  }
}

let started = false;
export function ensureStarted() {
  if (started) return;
  started = true;

  ensureScrollTrackingStarted();
  void bootstrap();
  window.setInterval(() => {
    void bootstrap();
  }, LIVE_STATUS_REFRESH_INTERVAL_MS);
}

export function subscribe(listener: Listener): () => void {
  globalListeners.add(listener);
  return () => {
    globalListeners.delete(listener);
  };
}

export function subscribeToNode(uuid: string, listener: Listener): () => void {
  let listeners = nodeListeners.get(uuid);
  if (!listeners) {
    listeners = new Set();
    nodeListeners.set(uuid, listeners);
  }
  listeners.add(listener);

  return () => {
    listeners?.delete(listener);
    if (listeners && listeners.size === 0) {
      nodeListeners.delete(uuid);
    }
  };
}

export function getSnapshot(): State {
  return state;
}

export function getNodeSnapshot(uuid: string): NodeDisplay | undefined {
  return state.byUuid[uuid];
}

export function getNodeTrafficTrendSnapshot(uuid: string): {
  up: TrafficTrendSample[];
  down: TrafficTrendSample[];
} {
  const trend = state.trafficTrends[uuid] ?? EMPTY_TRAFFIC_TREND;
  return trend.snapshot;
}

export function getVisibleNodeUuidsSnapshot(): string[] {
  const next = state.order.filter((uuid) => {
    const node = state.byUuid[uuid];
    return Boolean(node) && !node.hidden;
  });

  if (
    next.length === visibleNodeUuidsSnapshot.length &&
    next.every((uuid, index) => uuid === visibleNodeUuidsSnapshot[index])
  ) {
    return visibleNodeUuidsSnapshot;
  }

  visibleNodeUuidsSnapshot = next;
  return visibleNodeUuidsSnapshot;
}
