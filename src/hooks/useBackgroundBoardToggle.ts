import { useCallback, useSyncExternalStore } from "react";

const BACKGROUND_BOARD_VISIBLE_STORAGE_KEY = "komari-theme-YS:background-board-visible";
const DEFAULT_VISIBLE = true;

const listeners = new Set<() => void>();
let initialized = false;
let snapshot = DEFAULT_VISIBLE;

function readStoredVisibility() {
  if (typeof window === "undefined") return DEFAULT_VISIBLE;

  try {
    const raw = window.localStorage.getItem(BACKGROUND_BOARD_VISIBLE_STORAGE_KEY);
    if (raw == null) return DEFAULT_VISIBLE;
    return raw !== "0" && raw !== "false";
  } catch {
    return DEFAULT_VISIBLE;
  }
}

function persistVisibility(value: boolean) {
  try {
    window.localStorage.setItem(
      BACKGROUND_BOARD_VISIBLE_STORAGE_KEY,
      value ? "1" : "0",
    );
  } catch {
    // Keep the in-memory state if localStorage is unavailable.
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function setSnapshot(value: boolean, persist = true) {
  if (snapshot === value) return;
  snapshot = value;
  if (persist && typeof window !== "undefined") {
    persistVisibility(value);
  }
  emit();
}

function initIfNeeded() {
  if (initialized) return;
  initialized = true;
  snapshot = readStoredVisibility();

  if (typeof window === "undefined") return;
  window.addEventListener("storage", (event) => {
    if (event.key !== BACKGROUND_BOARD_VISIBLE_STORAGE_KEY) return;
    setSnapshot(readStoredVisibility(), false);
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

export function useBackgroundBoardToggle() {
  initIfNeeded();
  const visible = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setVisible = useCallback((next: boolean) => {
    setSnapshot(next);
  }, []);

  const toggleVisible = useCallback(() => {
    setSnapshot(!snapshot);
  }, []);

  return {
    backgroundBoardVisible: visible,
    setBackgroundBoardVisible: setVisible,
    toggleBackgroundBoardVisible: toggleVisible,
  };
}
