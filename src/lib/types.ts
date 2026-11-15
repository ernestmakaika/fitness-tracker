export type WorkoutType = "run" | "lift" | "cardio" | "mobility" | "sport" | "other";

export type Feel = 1 | 2 | 3 | 4 | 5;

export interface Workout {
  id: string;
  name: string;
  /** ISO date, YYYY-MM-DD, local. */
  date: string;
  durationMin: number;
  feel: Feel;
  type?: WorkoutType;
  note?: string;
  /** One short line saying what it was. Drawn from what the user typed when not set. */
  description?: string;
  /** Local start time, 24h "HH:MM". Places the workout on the day timeline. */
  startTime?: string;
  /** Strength work, set by set. Drives the detail table and the Stats volume and top sets. */
  exercises?: Exercise[];
  /** Totals typed in by hand, used when there is no set-by-set breakdown. */
  sets?: number;
  reps?: number;
  distanceKm?: number;
}

export interface Exercise {
  name: string;
  sets: SetEntry[];
}

export interface SetEntry {
  kg: number;
  reps: number;
}

export const FEEL_LABELS: Record<Feel, string> = {
  1: "Drained",
  2: "Heavy",
  3: "Steady",
  4: "Good",
  5: "Strong",
};

export const TYPE_LABELS: Record<WorkoutType, string> = {
  run: "Run",
  lift: "Lift",
  cardio: "Cardio",
  mobility: "Mobility",
  sport: "Sport",
  other: "Other",
};

export const ALL_TYPES: WorkoutType[] = ["run", "lift", "cardio", "mobility", "sport", "other"];
export const ALL_FEELS: Feel[] = [1, 2, 3, 4, 5];
