import { describe, it, expect } from "vitest";
import { parseWorkout, normalizeNumbers } from "./parseWorkout";

// Fixed base: Wednesday 2026-11-04
const BASE = "2026-11-04";

describe("normalizeNumbers", () => {
  it("handles compound words", () => {
    expect(normalizeNumbers("forty-five minutes")).toBe("45 minutes");
    expect(normalizeNumbers("forty five minutes")).toBe("45 minutes");
    expect(normalizeNumbers("twenty minutes")).toBe("20 minutes");
    expect(normalizeNumbers("an hour and a half")).toBe("an hour and a half");
  });
});

describe("parseWorkout", () => {
  const cases: Array<[string, Partial<ReturnType<typeof parseWorkout>>]> = [
    ["forty-five minute push day, felt pretty good",
      { name: "Push day", durationMin: 45, feel: 4, type: "lift", date: BASE }],
    ["easy 30 minute run this morning",
      { name: "Easy run", durationMin: 30, type: "run", date: BASE }],
    ["did an hour of yoga yesterday, felt strong",
      { name: "Yoga", durationMin: 60, feel: 5, type: "mobility", date: "2026-11-03" }],
    ["leg day about an hour and a half, absolutely wrecked",
      { name: "Leg day", durationMin: 90, feel: 1, type: "lift" }],
    ["pull day 55 minutes, pretty heavy",
      { name: "Pull day", durationMin: 55, feel: 2 }],
    ["biked for 1h 20",
      { name: "Bike", durationMin: 80, type: "cardio" }],
    ["swam 35 minutes on monday, fine",
      { name: "Swim", durationMin: 35, feel: 3, date: "2026-11-02" }],
    ["tempo run 45 min felt like a 4",
      { name: "Tempo run", durationMin: 45, feel: 4 }],
    ["played pickup basketball for two hours, unstoppable",
      { name: "Basketball", durationMin: 120, feel: 5, type: "sport" }],
    ["twenty minute mobility session",
      { name: "Mobility", durationMin: 20, type: "mobility", feel: undefined }],
    ["long run 75 minutes felt good",
      { name: "Long run", durationMin: 75, feel: 4 }],
    ["half an hour on the bike, okay",
      { name: "Bike", durationMin: 30, feel: 3 }],
    ["bench and squats 50 minutes last friday",
      { name: "Bench", durationMin: 50, type: "lift", date: "2026-10-30" }],
    ["went for a run",
      { name: "Run", durationMin: undefined, feel: undefined, date: BASE }],
    ["2 hour hike, great",
      { name: "Hike", durationMin: 120, feel: 5, type: "cardio" }],
    ["upper body 40 mins not great",
      { name: "Upper body", durationMin: 40, feel: 2 }],
    ["did a 5k this evening felt amazing",
      { name: "Race", type: "run", feel: 5, date: BASE }],
    ["quick stretch 15 minutes",
      { name: "Mobility", durationMin: 15 }],
    ["gym for an hour felt a 3 out of 5",
      { name: "Lift", durationMin: 60, feel: 3 }],
    ["pilates 1:05 decent",
      { name: "Pilates", durationMin: 65, feel: 3 }],
    ["ran intervals 40 minutes legs heavy",
      { name: "Intervals", durationMin: 40, feel: 2, type: "run" }],
    ["climbing session two and a half hours felt great",
      { name: "Climbing", durationMin: 150, feel: 5, type: "sport" }],
  ];

  for (const [input, expected] of cases) {
    it(input, () => {
      const r = parseWorkout(input, BASE);
      for (const [k, v] of Object.entries(expected)) {
        expect((r as unknown as Record<string, unknown>)[k], k).toEqual(v);
      }
      expect(r.note).toBe(input);
    });
  }

  it("defaults date to base when unspecified and marks it as not found", () => {
    const r = parseWorkout("push day", BASE);
    expect(r.date).toBe(BASE);
    expect(r.found.date).toBe(false);
  });

  it("falls back to 'Workout' when nothing is recognised", () => {
    const r = parseWorkout("did a thing for a while", BASE);
    expect(r.name).toBe("Workout");
    expect(r.type).toBeUndefined();
  });
});
