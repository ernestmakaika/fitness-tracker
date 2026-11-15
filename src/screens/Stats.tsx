import { useMemo, useState } from "react";
import type { Workout } from "../lib/types";
import { addDays, daysBetween, fromISODate, startOfWeek, today } from "../lib/dates";
import { EmptyState } from "../components/EmptyState";

type Period = "1M" | "3M" | "All";
const PERIODS: Period[] = ["1M", "3M", "All"];

export function Stats({ workouts }: { workouts: Workout[] }) {
  const [period, setPeriod] = useState<Period>("1M");
  const s = useMemo(() => compute(workouts, period), [workouts, period]);

  if (workouts.length < 3) {
    return (
      <section className="screen">
        <header className="home-head">
          <h1 className="home-title">Stats</h1>
        </header>
        <EmptyState
          title="Not enough to show yet"
          body={
            workouts.length === 0
              ? "Log three workouts and your numbers appear here."
              : `Log ${3 - workouts.length} more and your numbers appear here.`
          }
        />
      </section>
    );
  }

  const maxCount = Math.max(1, ...s.weeks.map((w) => w.count));
  // Past ~13 bars the date labels collide, so only every other one is shown.
  const labelEvery = s.weeks.length > 13 ? 2 : 1;

  return (
    <section className="screen st">
      <header className="home-head">
        <h1 className="home-title">Stats</h1>
        <div className="period-toggle" role="group" aria-label="Period">
          {PERIODS.map((p) => (
            <button key={p} aria-pressed={period === p} onClick={() => setPeriod(p)}>
              {p}
            </button>
          ))}
        </div>
      </header>

      <div className="st-body">
        <section className="st-section">
          <h2 className="st-eyebrow">Consistency &amp; activity</h2>
          <div className="st-card">
            <h3 className="st-card-title">Workouts per week</h3>
            <div className="st-bars" role="img" aria-label={`Workouts per week, last ${s.weeks.length} weeks`}>
              {s.weeks.map((w, i) => (
                <div className="st-bar" key={w.start}>
                  <span className="st-bar-n">{w.count}</span>
                  <div className="st-bar-track">
                    <i style={{ height: `${w.count === 0 ? 3 : Math.max(8, (w.count / maxCount) * 100)}%` }} />
                  </div>
                  <span className="st-bar-d">{i % labelEvery === 0 ? fmtWeek(w.start) : ""}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="st-tiles">
            <div className="st-tile">
              <span className="st-tile-k">Workouts</span>
              <span className="st-tile-v">{s.count}</span>
            </div>
            <div className="st-tile">
              <span className="st-tile-k">Streak</span>
              <span className="st-tile-v">
                {s.streakWeeks} {s.streakWeeks === 1 ? "week" : "weeks"}
              </span>
            </div>
            <div className="st-tile">
              <span className="st-tile-k">Avg time</span>
              <span className="st-tile-v">{s.avgMin} min</span>
            </div>
          </div>
        </section>

        <section className="st-section">
          <h2 className="st-eyebrow">Strength &amp; progression</h2>
          <div className="st-card st-card-list">
            <div className="st-row st-row-head">
              <span className="st-row-k">Volume lifted</span>
              <span className="st-row-v">{s.volumeKg.toLocaleString("en-US")} kg</span>
            </div>

            <h3 className="st-eyebrow st-sub">Top sets</h3>
            {s.topSets.length === 0 ? (
              <div className="st-row">
                <span className="st-row-v">No lifts in this period.</span>
              </div>
            ) : (
              s.topSets.map((t) => (
                <div className="st-row" key={t.exercise}>
                  <span className="st-row-k">
                    {t.exercise}
                    {t.pr && <span className="st-pr">PR</span>}
                  </span>
                  <span className="st-row-v">
                    {t.weightKg} kg × {t.reps}
                  </span>
                </div>
              ))
            )}

            <div className="st-row st-row-foot">
              <span className="st-row-k">Distance</span>
              <span className="st-row-v">{s.distanceKm} km</span>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

/** "11/9": the Monday a week starts on. */
function fmtWeek(iso: string): string {
  const d = fromISODate(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const PERIOD_DAYS: Record<Exclude<Period, "All">, number> = { "1M": 30, "3M": 90 };

function compute(all: Workout[], period: Period) {
  const t = today();
  const thisWeekStart = startOfWeek(t);
  const oldest = all.reduce((m, w) => (w.date < m ? w.date : m), t);

  const from = period === "All" ? oldest : addDays(t, -PERIOD_DAYS[period] + 1);
  const ws = all.filter((w) => w.date >= from);

  // Bars: 8 weeks for 1M (to match the design), 13 for 3M, all history (8 to 26) for All.
  const weekCount =
    period === "1M"
      ? 8
      : period === "3M"
        ? 13
        : Math.min(26, Math.max(8, Math.floor(daysBetween(startOfWeek(oldest), thisWeekStart) / 7) + 1));
  const weeks = Array.from({ length: weekCount }, (_, k) => {
    const start = addDays(thisWeekStart, -7 * (weekCount - 1 - k));
    const end = addDays(start, 6);
    return { start, count: all.filter((w) => w.date >= start && w.date <= end).length };
  });

  // Consecutive weeks with at least one workout, counting back from this week
  // (or last week if nothing yet this week).
  let streakWeeks = 0;
  let cursor = all.some((w) => w.date >= thisWeekStart) ? thisWeekStart : addDays(thisWeekStart, -7);
  while (streakWeeks < 520 && all.some((w) => w.date >= cursor && w.date <= addDays(cursor, 6))) {
    streakWeeks++;
    cursor = addDays(cursor, -7);
  }

  const avgMin = ws.length ? Math.round(ws.reduce((s, w) => s + w.durationMin, 0) / ws.length) : 0;
  const distanceKm = Math.round(ws.reduce((s, w) => s + (w.distanceKm ?? 0), 0) * 10) / 10;

  // Lifts: volume in the period, plus the heaviest set per exercise.
  let volumeKg = 0;
  const best = new Map<string, { weightKg: number; reps: number; date: string }>();
  for (const w of ws)
    for (const ex of w.exercises ?? [])
      for (const set of ex.sets) {
        volumeKg += set.kg * set.reps;
        const b = best.get(ex.name);
        if (!b || set.kg > b.weightKg || (set.kg === b.weightKg && set.reps > b.reps))
          best.set(ex.name, { weightKg: set.kg, reps: set.reps, date: w.date });
      }

  // PR: the period's best beats every earlier session of that exercise.
  const topSets = [...best.entries()]
    .map(([exercise, b]) => {
      const earlier = all
        .filter((w) => w.date < b.date)
        .flatMap((w) => w.exercises ?? [])
        .filter((ex) => ex.name === exercise)
        .flatMap((ex) => ex.sets);
      const pr = earlier.length > 0 && earlier.every((set) => set.kg < b.weightKg);
      return { exercise, ...b, pr };
    })
    .sort((a, b) => b.weightKg - a.weightKg)
    .slice(0, 3);

  return {
    weeks,
    count: ws.length,
    streakWeeks,
    avgMin,
    distanceKm,
    volumeKg: Math.round(volumeKg),
    topSets,
  };
}