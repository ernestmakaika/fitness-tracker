import type { Exercise, Feel, Workout } from "./types";
import { addDays, today } from "./dates";

/** The demo runs on four workouts: Push day, Strength day (really leg day), Morning run and Yoga. */
type Kind = "bench" | "squat" | "run" | "yoga";
/** [days ago, kind, minutes, feel, start time, km for runs] */
type Row = [number, Kind, number, Feel, string, number?];

const round = (kg: number) => Math.round(kg / 2.5) * 2.5;

/** Ramp up to a top weight. Older sessions were a little lighter. */
function bench(ago: number): Exercise[] {
  const top = round(80 - ago * 0.25);
  return [{ name: "Bench press", sets: [
    { kg: top - 20, reps: 8 },
    { kg: top - 10, reps: 6 },
    { kg: top, reps: 5 },
    { kg: top, reps: 4 },
  ] }];
}

function squat(ago: number): Exercise[] {
  const top = round(110 - ago * 0.25);
  return [{ name: "Squat", sets: [
    { kg: top - 40, reps: 8 },
    { kg: top - 20, reps: 5 },
    { kg: top, reps: 5 },
    { kg: top, reps: 5 },
    { kg: top, reps: 4 },
  ] }];
}

/** The four demo workouts, dated relative to today. */
export function seedWorkouts(): Workout[] {
  const t = today();
  // Exactly four. Anything else in the app was logged by the user.
  const rows: Row[] = [
    [0, "bench", 48, 4, "18:12"],
    [1, "run", 31, 3, "07:40", 5.2],
    [1, "squat", 58, 4, "18:05"],
    [2, "yoga", 40, 5, "07:00"],
  ];
  return rows.map(([ago, kind, durationMin, feel, startTime, km], i) => {
    const base = { id: `seed-${i}`, date: addDays(t, -ago), durationMin, feel, startTime };
    switch (kind) {
      case "bench":
        return { ...base, name: "Push day", type: "lift", exercises: bench(ago), description: `Bench press, working up to ${round(80 - ago * 0.25)} kg` };
      case "squat":
        return { ...base, name: "Strength day", type: "lift", exercises: squat(ago), description: `Squats, working up to ${round(110 - ago * 0.25)} kg` };
      case "run":
        return { ...base, name: "Morning run", type: "run", distanceKm: km, description: `${km! < 6 ? "Easy" : km! < 10 ? "Steady" : "Long"} ${km} km loop before breakfast` };
      case "yoga":
        return { ...base, name: "Yoga", type: "mobility", description: "Slow flow for hips and lower back" };
    }
  });
}
