import type { AdminClient, PingTask } from "@/types/komari";
import { normalizeHomepagePingTaskBindings, type HomepagePingTaskBindings } from "@/utils/pingTasks";

export function serializeBindings(bindings: HomepagePingTaskBindings) {
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

export function sortTasks(tasks: PingTask[]) {
  return [...tasks].sort((left, right) => {
    if (left.weight !== right.weight) return left.weight - right.weight;
    if (left.id !== right.id) return left.id - right.id;
    return left.name.localeCompare(right.name);
  });
}

export function sortClients(clients: AdminClient[]) {
  return [...clients].sort((left, right) => {
    if (left.weight !== right.weight) return left.weight - right.weight;
    return left.name.localeCompare(right.name);
  });
}

export function summarizeNodes(
  uuids: string[],
  clientsById: Map<string, AdminClient>,
) {
  if (uuids.length === 0) return "未绑定节点";
  const names = uuids.map((uuid) => clientsById.get(uuid)?.name || uuid);
  const summary = names.join("、");
  return summary.length > 92 ? `${summary.slice(0, 92)}...` : summary;
}

export function pruneBindings(bindings: HomepagePingTaskBindings) {
  const normalized = normalizeHomepagePingTaskBindings(bindings);
  const pruned: HomepagePingTaskBindings = {};

  for (const [taskId, clients] of Object.entries(normalized)) {
    if (clients.length > 0) {
      pruned[taskId] = clients;
    }
  }

  return pruned;
}

export function applyClientAssignment(
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

export function applyAllClientsToTask(
  bindings: HomepagePingTaskBindings,
  taskId: number,
  clientUuids: string[],
) {
  const taskKey = String(taskId);
  const allClients = Array.from(new Set(clientUuids.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right),
  );
  if (allClients.length === 0) return pruneBindings(bindings);

  const allClientSet = new Set(allClients);
  const next: HomepagePingTaskBindings = {};

  for (const [currentTaskId, clients] of Object.entries(pruneBindings(bindings))) {
    if (currentTaskId === taskKey) continue;
    const filtered = clients.filter((uuid) => !allClientSet.has(uuid));
    if (filtered.length > 0) {
      next[currentTaskId] = filtered;
    }
  }

  next[taskKey] = allClients;
  return pruneBindings(next);
}
