"use client";

import { useSyncExternalStore } from "react";

// Investigations picked with "Add to compare" (max 4), remembered per browser. Storage can be
// unavailable (private mode, blocked site data) - the selection then lives only in memory.
const KEY = "fif-compare";
export const MAX_COMPARE = 4;
const EMPTY: string[] = [];

let memory: string[] = EMPTY;
let snapshot: string[] | null = null;
const listeners = new Set<() => void>();

function load(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string").slice(0, MAX_COMPARE) : EMPTY;
  } catch {
    return memory;
  }
}

function getSnapshot(): string[] {
  if (snapshot === null) snapshot = load();
  return snapshot;
}

function save(ids: string[]) {
  memory = ids;
  snapshot = ids;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* storage blocked: keep in memory */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      snapshot = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

// Stable module-level setters (safe to use in effect dependency lists).
function setCompare(next: string[]) {
  const ids = next.slice(0, MAX_COMPARE);
  if (ids.join(",") !== getSnapshot().join(",")) save(ids);
}

function toggleCompare(id: string) {
  const ids = getSnapshot();
  save(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-MAX_COMPARE));
}

export function useCompare() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
  return { ids, toggle: toggleCompare, set: setCompare };
}
