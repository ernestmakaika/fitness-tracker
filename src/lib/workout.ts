import type { Workout } from "./types";
import { FEEL_LABELS, TYPE_LABELS } from "./types";
import { fmtMinutes } from "./dates";

/** Sets and reps: counted from the set-by-set log when there is one, else the typed totals. */
export function totals(w: Workout): { sets?: number; reps?: number } {
  if (w.exercises?.length) {
    const all = w.exercises.flatMap((ex) => ex.sets);
    return { sets: all.length, reps: all.reduce((n, s) => n + s.reps, 0) };
  }
  return { sets: w.sets, reps: w.reps };
}

/** "5:58 /km" */
export function fmtPace(durationMin: number, km: number): string {
  const sec = Math.round((durationMin * 60) / km);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")} /km`;
}

/**
 * The headline numbers, which depend on what kind of workout it was:
 * strength shows sets and reps, a run shows distance and pace,
 * anything else (yoga) shows how it felt.
 */
export function statsOf(w: Workout): Array<{ k: string; v: string }> {
  const s = [{ k: "Duration", v: fmtMinutes(w.durationMin) }];
  const { sets, reps } = totals(w);
  if (w.distanceKm) {
    s.push({ k: "Distance", v: `${w.distanceKm} km` });
    s.push({ k: "Pace", v: fmtPace(w.durationMin, w.distanceKm) });
  } else {
    if (sets) s.push({ k: "Sets", v: String(sets) });
    if (reps) s.push({ k: "Reps", v: String(reps) });
  }
  if (s.length < 3) s.push({ k: "Felt", v: FEEL_LABELS[w.feel] });
  return s.slice(0, 3);
}

/**
 * One short line from what the user typed: the opening clause, before the
 * "felt…" and other asides, capitalised and kept to a line's worth.
 */
export function shortDescription(text: string, max = 56): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const clauses = clean.split(/\s*[,.;!?–—]\s+|\s+(?:felt|feeling|and it was|it was)\s+/i);
  let s = clauses[0];
  // "Strength day" alone only repeats the name, so keep what follows it too.
  if (s.split(" ").length <= 2 && clauses[1]) s = `${s}, ${clauses[1]}`;
  if (s.length < 4) s = clean;
  if (s.length > max) s = `${s.slice(0, s.lastIndexOf(" ", max) > 20 ? s.lastIndexOf(" ", max) : max)}…`;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The one-line description: the saved one, else what was said, else the exercises or type. */
export function describe(w: Workout): string | null {
  if (w.description) return w.description;
  if (w.note) return shortDescription(w.note);
  if (w.exercises?.length) return w.exercises.map((ex) => ex.name).join(", ");
  return w.type ? TYPE_LABELS[w.type] : null;
}
