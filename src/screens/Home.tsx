import { useEffect, useMemo, useState } from "react";
import type { Workout } from "../lib/types";
import {
  MONTHS, MONTHS_LONG, WEEKDAYS, addDays, addMinutes, daysInMonth, fmtDayShort, fmtDayTitle,
  fmtMinutes, fmtMonthDay, fmtShort, fmtTime, fromISODate, startOfMonth, startOfWeek, today, toISODate,
} from "../lib/dates";
import {
  CalendarIcon, ChevronLeft, ChevronRight, CloseIcon, MenuIcon, WorkoutIcon,
} from "../components/Icons";
import { EmptyState } from "../components/EmptyState";
import { FeelScore, WorkoutStats } from "../components/WorkoutStats";
import { describe } from "../lib/workout";

type View = "list" | "calendar";
type ByDay = Map<string, Workout[]>;

export function Home({
  workouts,
  onOpen,
  onAll,
}: {
  workouts: Workout[];
  onOpen: (id: string) => void;
  onAll: () => void;
}) {
  const t = today();
  const [view, setView] = useState<View>("list");
  const [picked, setPicked] = useState(t);
  const [sheetOpen, setSheetOpen] = useState(false);

  // The list is always today; the calendar browses any day.
  const day = view === "list" ? t : picked;

  const byDay = useMemo(() => {
    const m: ByDay = new Map();
    for (const w of workouts) m.set(w.date, [...(m.get(w.date) ?? []), w]);
    return m;
  }, [workouts]);

  const dayWorkouts = useMemo(
    () =>
      [...(byDay.get(day) ?? [])].sort((a, b) =>
        (a.startTime ?? "99").localeCompare(b.startTime ?? "99"),
      ),
    [byDay, day],
  );

  const earlier = useMemo(() => workouts.filter((w) => w.date < t).slice(0, 4), [workouts, t]);
  const d = fromISODate(day);

  return (
    <section className="screen home">
      <header className="home-head">
        {view === "list" ? (
          <h1 className="home-title">{fmtDayTitle(day)}</h1>
        ) : (
          <h1 className="home-title">
            <button
              className="home-title-btn"
              onClick={() => setSheetOpen(true)}
              aria-haspopup="dialog"
              aria-label={`${fmtMonthDay(day)}, ${d.getFullYear()}. Choose a date`}
            >
              {fmtMonthDay(day)}, <span className="yr">{d.getFullYear()}</span>
              <ChevronRight aria-hidden="true" />
            </button>
          </h1>
        )}
        <div className="view-toggle" role="tablist" aria-label="View">
          <button
            role="tab"
            aria-label="Today"
            title="Today"
            aria-selected={view === "list"}
            onClick={() => setView("list")}
          >
            <MenuIcon />
          </button>
          <button
            role="tab"
            aria-label="Calendar"
            title="Calendar"
            aria-selected={view === "calendar"}
            onClick={() => setView("calendar")}
          >
            <CalendarIcon />
          </button>
        </div>
      </header>

      {view === "calendar" && <WeekStrip day={day} byDay={byDay} onPick={setPicked} />}

      {workouts.length === 0 ? (
        <EmptyState title="Nothing logged yet" body="Tap the mic and say what you did." />
      ) : dayWorkouts.length === 0 ? (
        <EmptyState
          key={day}
          title={day === t ? "Nothing logged today" : "Nothing logged"}
          body={day === t ? "Tap the mic and say what you did." : `${fmtShort(day)} was a rest day.`}
        />
      ) : dayWorkouts.length === 1 ? (
        <DayCard key={day} workout={dayWorkouts[0]} onOpen={onOpen} />
      ) : (
        <Timeline key={day} items={dayWorkouts} onOpen={onOpen} />
      )}

      {view === "list" && earlier.length > 0 && (
        <div className="earlier">
          <div className="earlier-head">
            <span className="eyebrow">Earlier</span>
            <button className="earlier-all" onClick={onAll}>
              All workouts →
            </button>
          </div>
          {earlier.map((w) => (
            <button key={w.id} className="earlier-row" onClick={() => onOpen(w.id)}>
              <span className="earlier-icon" aria-hidden="true">
                <WorkoutIcon workout={w} />
              </span>
              <span className="earlier-text">
                <span className="name">{w.name}</span>
                <span className="sub">
                  {fmtDayShort(w.date)} · {fmtMinutes(w.durationMin)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {sheetOpen && (
        <MonthSheet
          day={day}
          byDay={byDay}
          onPick={(iso) => {
            setPicked(iso);
            setSheetOpen(false);
          }}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </section>
  );
}

/* ---------- one workout ---------- */

function DayCard({ workout: w, onOpen }: { workout: Workout; onOpen: (id: string) => void }) {
  const desc = describe(w);
  return (
    <button className="day-card rise" onClick={() => onOpen(w.id)}>
      <span className="day-card-title">{w.name}</span>
      {w.startTime && <span className="day-card-when">{fmtTime(w.startTime)}</span>}
      <span className="desc-row">
        {desc && <span className="day-card-desc">{desc}</span>}
        <FeelScore workout={w} />
      </span>
      <WorkoutStats workout={w} />
    </button>
  );
}

/* ---------- several in a day ---------- */

/** A spine of the day's workouts. One is opened up; tapping another opens that one instead. */
function Timeline({ items, onOpen }: { items: Workout[]; onOpen: (id: string) => void }) {
  const lastId = items[items.length - 1].id;
  const [openId, setOpenId] = useState(lastId);
  const active = items.some((w) => w.id === openId) ? openId : lastId;

  return (
    <ol className="tl rise">
      {items.map((w) => {
        const on = w.id === active;
        const desc = describe(w);
        const brief = [fmtMinutes(w.durationMin), w.distanceKm ? `${w.distanceKm} km` : null]
          .filter(Boolean)
          .join(" · ");
        return (
          <li key={w.id} className={on ? "is-on" : undefined}>
            <button
              className="tl-item"
              aria-expanded={on}
              onClick={() => (on ? onOpen(w.id) : setOpenId(w.id))}
            >
              <span className="tl-times">
                {w.startTime && (
                  <>
                    <span>{fmtTime(w.startTime, false)}</span>
                    <span>{fmtTime(addMinutes(w.startTime, w.durationMin), false)}</span>
                  </>
                )}
              </span>
              <span className="tl-node" aria-hidden="true">
                <WorkoutIcon workout={w} />
              </span>
              {on ? (
                <span className="tl-body">
                  <span className="tl-main">
                    <span className="tl-title">{w.name}</span>
                    <span className="desc-row">
                      {desc && <span className="tl-desc">{desc}</span>}
                      <FeelScore workout={w} />
                    </span>
                    <WorkoutStats workout={w} />
                  </span>
                </span>
              ) : (
                <span className="tl-body">
                  <span className="tl-main">
                    <span className="tl-title">{w.name}</span>
                    <span className="tl-desc">{brief}</span>
                  </span>
                </span>
              )}
            </button>
            <span className="tl-link" aria-hidden="true" />
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- calendar: week strip ---------- */

function WeekStrip({ day, byDay, onPick }: { day: string; byDay: ByDay; onPick: (iso: string) => void }) {
  const t = today();
  const start = startOfWeek(day);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="week" role="group" aria-label="Week">
      {days.map((iso) => {
        const date = fromISODate(iso);
        const n = byDay.get(iso)?.length ?? 0;
        return (
          <button
            key={iso}
            className={[
              "week-day",
              iso === day ? "is-selected" : "",
              iso === t ? "is-today" : "",
            ].join(" ")}
            disabled={iso > t}
            aria-pressed={iso === day}
            aria-label={`${fmtShort(iso)}${n ? `, ${n} workout${n > 1 ? "s" : ""}` : ""}`}
            onClick={() => onPick(iso)}
          >
            <span className="dow">{WEEKDAYS[date.getDay()]}</span>
            <span className="n">{date.getDate()}</span>
            <span className={`dot ${n ? "" : "is-none"}`} />
          </button>
        );
      })}
    </div>
  );
}

/* ---------- calendar: month sheet ---------- */

function MonthSheet({
  day,
  byDay,
  onPick,
  onClose,
}: {
  day: string;
  byDay: ByDay;
  onPick: (iso: string) => void;
  onClose: () => void;
}) {
  const t = today();
  const [month, setMonth] = useState(() => startOfMonth(day));
  /** Tapping the title swaps the day grid for a month-and-year picker. */
  const [jumping, setJumping] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const first = fromISODate(month);
  const year = first.getFullYear();
  const nowYear = fromISODate(t).getFullYear();
  const cells: Array<string | null> = [
    ...Array<null>(first.getDay()).fill(null), // Sunday start
    ...Array.from({ length: daysInMonth(month) }, (_, i) => toISODate(new Date(year, first.getMonth(), i + 1))),
  ];

  return (
    <div className="sheet-layer">
      <div className="sheet-scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Choose a date">
        <span className="sheet-grab" aria-hidden="true" />
        <div className="sheet-head">
          <button
            className={`sheet-title ${jumping ? "is-open" : ""}`}
            aria-expanded={jumping}
            aria-label={`${MONTHS_LONG[first.getMonth()]} ${year}. Change month`}
            onClick={() => setJumping(!jumping)}
          >
            {MONTHS_LONG[first.getMonth()]} <span className="yr">{year}</span>
            <ChevronRight aria-hidden="true" />
          </button>
          <button className="sheet-close" aria-label="Close" onClick={onClose} autoFocus>
            <CloseIcon />
          </button>
        </div>

        {jumping ? (
          <div className="jump">
            <div className="jump-year">
              <button
                className="icon-btn"
                aria-label="Previous year"
                onClick={() => setMonth(toISODate(new Date(year - 1, first.getMonth(), 1)))}
              >
                <ChevronLeft />
              </button>
              <span>{year}</span>
              <button
                className="icon-btn"
                aria-label="Next year"
                disabled={year >= nowYear}
                onClick={() => {
                  const next = toISODate(new Date(year + 1, first.getMonth(), 1));
                  setMonth(next > startOfMonth(t) ? startOfMonth(t) : next);
                }}
              >
                <ChevronRight />
              </button>
            </div>
            <div className="jump-grid">
              {MONTHS.map((name, i) => {
                const iso = toISODate(new Date(year, i, 1));
                return (
                  <button
                    key={name}
                    className={iso === month ? "is-selected" : undefined}
                    aria-pressed={iso === month}
                    disabled={iso > startOfMonth(t)}
                    onClick={() => {
                      setMonth(iso);
                      setJumping(false);
                    }}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="month-grid">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((n) => (
              <span key={n} className="dow" aria-hidden="true">
                {n}
              </span>
            ))}
            {cells.map((iso, i) => {
              if (!iso) return <span key={`p${i}`} />;
              const n = byDay.get(iso)?.length ?? 0;
              return (
                <button
                  key={iso}
                  className={`month-day ${iso === day ? "is-selected" : ""}`}
                  disabled={iso > t}
                  aria-pressed={iso === day}
                  aria-label={`${fmtShort(iso)}${n ? `, ${n} workout${n > 1 ? "s" : ""}` : ""}`}
                  onClick={() => onPick(iso)}
                >
                  <span className="n">{fromISODate(iso).getDate()}</span>
                  <span className={`dot ${n ? "" : "is-none"}`} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
