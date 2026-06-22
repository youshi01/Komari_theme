export function normalizeHomepageNodeOrder(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const order: string[] = [];

  for (const item of value) {
    const uuid = typeof item === "string" ? item.trim() : String(item ?? "").trim();
    if (!uuid || seen.has(uuid)) continue;
    seen.add(uuid);
    order.push(uuid);
  }

  return order;
}

export function pruneHomepageNodeOrder(
  order: readonly string[],
  availableUuids: readonly string[],
): string[] {
  const available = new Set(availableUuids);
  return normalizeHomepageNodeOrder(order).filter((uuid) => available.has(uuid));
}

export function applyHomepageNodeOrder(
  baseUuids: readonly string[],
  orderValue: unknown,
): string[] {
  const customOrder = normalizeHomepageNodeOrder(orderValue);
  if (customOrder.length === 0) return [...baseUuids];

  const available = new Set(baseUuids);
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const uuid of customOrder) {
    if (!available.has(uuid) || seen.has(uuid)) continue;
    seen.add(uuid);
    ordered.push(uuid);
  }

  for (const uuid of baseUuids) {
    if (seen.has(uuid)) continue;
    seen.add(uuid);
    ordered.push(uuid);
  }

  return ordered;
}

export function serializeHomepageNodeOrder(order: readonly string[]) {
  return JSON.stringify(normalizeHomepageNodeOrder(order));
}
