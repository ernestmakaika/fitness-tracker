import { useCallback, useEffect, useMemo, useState } from "react";
import type { Workout } from "./types";
import { seedWorkouts } from "./seed";

const KEY = "fitness-tracker.workouts.v3";
/** Older versions lacked start times, exercises, etc. Their data is left in place, untouched. */
const OLD_KEYS = ["fitness-tracker.workouts.v2", "fitness-tracker.workouts.v1", "said.workouts.v3", "said.workouts.v2", "said.workouts.v1"];

function load(): Workout[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Workout[];
  } catch {
    /* fall through */
  }
  // Fresh seed, plus anything the user logged themselves under an older version.
  const own = new Map<string, Workout>();
  for (const key of OLD_KEYS) {
    try {
      const old = localStorage.getItem(key);
      if (old)
        for (const w of JSON.parse(old) as Workout[])
          if (!w.id.startsWith("seed-")) own.set(w.id, w);
    } catch {
      /* ignore */
    }
  }
  const seeded = [...own.values(), ...seedWorkouts()];
  localStorage.setItem(KEY, JSON.stringify(seeded));
  return seeded;
}

function save(ws: Workout[]) {
  localStorage.setItem(KEY, JSON.stringify(ws));
}

export function newId(): string {
  return `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useWorkouts() {
  const [workouts, setWorkouts] = useState<Workout[]>(() => load());

  useEffect(() => {
    save(workouts);
  }, [workouts]);

  const sorted = useMemo(
    () =>
      [...workouts].sort((a, b) =>
        a.date !== b.date
          ? a.date < b.date ? 1 : -1
          : (b.startTime ?? "").localeCompare(a.startTime ?? ""),
      ),
    [workouts],
  );

  const add = useCallback((w: Omit<Workout, "id">) => {
    const full = { ...w, id: newId() };
    setWorkouts((ws) => [full, ...ws]);
    return full;
  }, []);

  const update = useCallback((id: string, patch: Partial<Workout>) => {
    setWorkouts((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  }, []);

  const remove = useCallback((id: string) => {
    setWorkouts((ws) => ws.filter((w) => w.id !== id));
  }, []);

  const clearAll = useCallback(() => setWorkouts([]), []);
  const reseed = useCallback(() => setWorkouts(seedWorkouts()), []);

  return { workouts: sorted, add, update, remove, clearAll, reseed };
}
