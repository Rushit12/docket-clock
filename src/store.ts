import { useCallback, useEffect, useState } from "react";
import type { ISODate } from "./engine/dates";
import type { OrderItem } from "./engine/generate";
import type { CaseInputs } from "./engine/types";

export interface SavedCase {
  id: string;
  inputs: CaseInputs;
  claimNumber?: string;
  client?: string;
  overrides: Record<string, ISODate>;
  done: Record<string, boolean>;
  orderItems?: OrderItem[];
  orderSource?: string;
  createdAt: string;
  updatedAt: string;
}

const KEY = "docketclock.cases.v1";

function read(): SavedCase[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedCase[]) : [];
  } catch {
    return [];
  }
}

function write(cases: SavedCase[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cases));
  } catch {
    /* storage unavailable (private mode) — keep in memory */
  }
}

let memory: SavedCase[] = read();
const listeners = new Set<() => void>();

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function useCases() {
  const [cases, setCases] = useState<SavedCase[]>(memory);
  useEffect(() => {
    const l = () => setCases([...memory]);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  const commit = useCallback((next: SavedCase[]) => {
    memory = next;
    write(next);
    listeners.forEach((l) => l());
  }, []);
  const upsert = useCallback((c: SavedCase) => {
    const now = new Date().toISOString();
    const exists = memory.some((x) => x.id === c.id);
    commit(exists ? memory.map((x) => (x.id === c.id ? { ...c, updatedAt: now } : x)) : [{ ...c, createdAt: now, updatedAt: now }, ...memory]);
  }, [commit]);
  const remove = useCallback((id: string) => commit(memory.filter((x) => x.id !== id)), [commit]);
  return { cases, upsert, remove };
}

export function blankCase(): SavedCase {
  return {
    id: newId(),
    inputs: { name: "", county: "", court: "circuit", caseType: "auto", track: "general", jury: true },
    overrides: {},
    done: {},
    createdAt: "",
    updatedAt: "",
  };
}

// Tiny hash router.
export function useRoute(): [string, (r: string) => void] {
  const get = () => window.location.hash.replace(/^#/, "") || "/";
  const [route, setRoute] = useState(get);
  useEffect(() => {
    const on = () => setRoute(get());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return [route, (r: string) => { window.location.hash = r; }];
}
