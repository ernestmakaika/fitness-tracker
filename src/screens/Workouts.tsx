import { useMemo, useState } from "react";
import type { Workout, WorkoutType } from "../lib/types";
import { MONTHS_LONG, WEEKDAYS, fmtMinutes, fromISODate, startOfMonth, today } from "../lib/dates";
import { WorkoutIcon } from "../components/Icons";
import { EmptyState } from "../components/EmptyState";

type Filter = "all" | WorkoutType;
const FILTERS: Array<{ id: Filter; label: string; noun: string }> = [
  { id: "all", label: "All", noun: "" },
  { id: "lift", label: "Strength", noun: "strength" },
  { id: "run", label: "Running", noun: "running" },
  { id: "mobility", label: "Mobility", noun: "mobility" },
];

/** Every workout, newest first, grouped by month. */
export function Workouts({
  workouts,
  onOpen,
}: {
  workouts: Workout[];
  onOpen: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const filterDef = FILTERS.find((f) => f.id === filter)!;

  const groups = useMemo(
    () => groupByMonth(filter === "all" ? workouts : workouts.filter((w) => w.type === filter)),
    [workouts, filter],
  );

  return (
    <section className="screen">
      <header className="home-head">
        <h1 className="home-title">Workouts</h1>
      </header>

      {workouts.length === 0 ? (
        <EmptyState title="Nothing logged yet" body="Tap + to log a workout." />
      ) : (
        <>
          <div className="period-toggle wk-filter" role="group" aria-label="Filter by type">
            {FILTERS.map((f) => (
              <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>

          {groups.length === 0 ? (
            <div className="wk-group" key={filter}>
              <EmptyState title={`No ${filterDef.noun} workouts yet`} body="Tap + to log a workout." />
            </div>
          ) : (
            groups.map((g) => (
              <div className="wk-group" key={g.month}>
                <h2 className="eyebrow">{fmtMonth(g.month)}</h2>
                {g.items.map((w) => {
                  const d = fromISODate(w.date);
                  return (
                    <button key={w.id} className="earlier-row" onClick={() => onOpen(w.id)}>
                      <span className="earlier-icon" aria-hidden="true">
                        <WorkoutIcon workout={w} />
                      </span>
                      <span className="earlier-text">
                        <span className="name">{w.name}</span>
                        <span className="sub">
                          {WEEKDAYS[d.getDay()]} {d.getDate()}
                        </span>
                      </span>
                      <span className="wk-dur">{fmtMinutes(w.durationMin)}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </>
      )}
    </section>
  );
}

/** "November", with the year once it isn't this one. */
function fmtMonth(iso: string): string {
  const d = fromISODate(iso);
  const name = MONTHS_LONG[d.getMonth()];
  return d.getFullYear() === fromISODate(today()).getFullYear() ? name : `${name} ${d.getFullYear()}`;
}

function groupByMonth(ws: Workout[]) {
  const map = new Map<string, Workout[]>();
  for (const w of ws) {
    const k = startOfMonth(w.date);
    map.set(k, [...(map.get(k) ?? []), w]);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([month, items]) => ({ month, items }));
}
