import { useState } from "react";
import type { Feel, Workout } from "../lib/types";
import { ALL_FEELS, FEEL_LABELS } from "../lib/types";
import { fmtDayTitle, fmtMonthDay, fmtTime, fromISODate, today } from "../lib/dates";
import {
  CalendarIcon, ChevronLeft, ChevronRight, ClockIcon, DistanceIcon, FlameIcon, PaceIcon, RepsIcon, SetsIcon,
} from "../components/Icons";
import { FeelScore, WorkoutStats } from "../components/WorkoutStats";
import { ChoiceSheet, TimeSheet } from "../components/TimeSheet";
import { describe, fmtPace } from "../lib/workout";

export function WorkoutDetail({
  workout,
  onBack,
  onUpdate,
  onDelete,
}: {
  workout: Workout;
  onBack: () => void;
  onUpdate: (patch: Partial<Workout>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const desc = describe(workout);

  if (editing) {
    return (
      <EditWorkout
        workout={workout}
        onCancel={() => setEditing(false)}
        onSave={(patch) => {
          onUpdate(patch);
          setEditing(false);
        }}
        onDelete={onDelete}
      />
    );
  }

  return (
    <section className="screen detail">
      <div className="detail-head">
        <button className="detail-back" aria-label="Back" onClick={onBack}>
          <ChevronLeft />
        </button>
        <button className="detail-edit" onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>

      <div className="detail-top rise">
        <h1 className="detail-title">{workout.name}</h1>
        <p className="detail-when">{fmtWhen(workout.date, workout.startTime)}</p>
      </div>
      <div className="desc-row rise">
        {desc && <p className="detail-desc">{desc}</p>}
        <FeelScore workout={workout} explain />
      </div>

      <WorkoutStats workout={workout} />

      {/* Strength: every exercise, set by set. Runs and yoga have nothing more to list. */}
      {workout.exercises?.map((ex) => (
        <table className="sets rise" key={ex.name}>
          <caption>{ex.name}</caption>
          <thead>
            <tr>
              <th scope="col">Set</th>
              <th scope="col">Kg</th>
              <th scope="col">Reps</th>
            </tr>
          </thead>
          <tbody>
            {ex.sets.map((set, i) => (
              <tr key={i}>
                <th scope="row">{i + 1}</th>
                <td>{set.kg}</td>
                <td>{set.reps}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}

      {workout.note && workout.note !== desc && (
        <div className="detail-note rise">
          <span className="eyebrow">You said</span>
          <p>“{workout.note}”</p>
        </div>
      )}
    </section>
  );
}

/** "Nov 15, 6:12 PM" */
function fmtWhen(date: string, startTime?: string): string {
  return startTime ? `${fmtMonthDay(date)}, ${fmtTime(startTime)}` : fmtMonthDay(date);
}

export const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export const toClock = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
export const DAY_END = 23 * 60 + 59;

/** "1 point", "4 points" */
export const points = (feel: Feel) => `${feel} ${feel === 1 ? "point" : "points"}`;

/** Right now, in minutes from midnight. */
export function nowMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

/** "Today", "Yesterday", "3 days ago". */
export function daysAgo(iso: string): string {
  const n = Math.round((fromISODate(today()).getTime() - fromISODate(iso).getTime()) / 86_400_000);
  return n <= 0 ? "Today" : n === 1 ? "Yesterday" : `${n} days ago`;
}

/* ---------- edit ---------- */

/** Numbers are held as text while typing, so a field can be emptied and retyped. */
interface Draft {
  name: string;
  description: string;
  duration: string;
  distance: string;
  sets: string;
  reps: string;
  date: string;
  startTime?: string;
  feel: Feel;
  exercises: Array<{ name: string; sets: Array<{ kg: string; reps: string }> }>;
}

/** Open the native date picker on click, where the browser lets us (desktop needs the nudge). */
export function openPicker(e: React.MouseEvent<HTMLInputElement>) {
  try {
    e.currentTarget.showPicker?.();
  } catch {
    /* not allowed here: the field still works by focus */
  }
}

export const digits = (v: string) => v.replace(/\D/g, "");
export const decimal = (v: string) => v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");

/**
 * The detail screen, made editable in place: the same title, stats and set tables,
 * with every value you can change shown in the accent colour.
 */
function EditWorkout({
  workout,
  onCancel,
  onSave,
  onDelete,
}: {
  workout: Workout;
  onCancel: () => void;
  onSave: (patch: Partial<Workout>) => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** Which time the wheels are open for, if any. */
  const [picking, setPicking] = useState<"start" | "end" | "feel" | null>(null);
  /** The row that picker belongs to, so it can open just under it. */
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  function pick(which: "start" | "end" | "feel", e: React.MouseEvent<HTMLElement>) {
    setAnchor(e.currentTarget.closest<HTMLElement>(".prop"));
    setPicking(which);
  }
  const [d, setD] = useState<Draft>(() => ({
    name: workout.name,
    description: describe(workout) ?? "",
    duration: String(workout.durationMin),
    distance: workout.distanceKm ? String(workout.distanceKm) : "",
    sets: workout.sets ? String(workout.sets) : "",
    reps: workout.reps ? String(workout.reps) : "",
    date: workout.date,
    startTime: workout.startTime,
    feel: workout.feel,
    exercises: (workout.exercises ?? []).map((ex) => ({
      name: ex.name,
      sets: ex.sets.map((s) => ({ kg: String(s.kg), reps: String(s.reps) })),
    })),
  }));
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));

  const hasExercises = d.exercises.length > 0;
  const isRun = workout.type === "run" || !!workout.distanceKm;
  const duration = Number(d.duration);
  const distance = Number(d.distance);
  const allSets = d.exercises.flatMap((ex) => ex.sets);
  /** When it ended, in minutes from midnight; null until there's a start time. */
  const startMin = d.startTime ? toMinutes(d.startTime) : null;
  const endMin = startMin !== null ? Math.min(DAY_END, startMin + (duration > 0 ? duration : 0)) : null;

  function setCell(ei: number, si: number, patch: { kg?: string; reps?: string }) {
    set({
      exercises: d.exercises.map((ex, i) =>
        i !== ei ? ex : { ...ex, sets: ex.sets.map((s, j) => (j !== si ? s : { ...s, ...patch })) },
      ),
    });
  }

  function save() {
    onSave({
      name: d.name.trim() || workout.name,
      description: d.description.trim() || undefined,
      durationMin: duration > 0 ? Math.round(duration) : workout.durationMin,
      date: d.date || workout.date,
      startTime: d.startTime,
      feel: d.feel,
      ...(isRun ? { distanceKm: distance > 0 ? distance : undefined } : {}),
      ...(hasExercises
        ? {
            exercises: d.exercises.map((ex) => ({
              name: ex.name,
              sets: ex.sets.map((s) => ({ kg: Number(s.kg) || 0, reps: Number(s.reps) || 0 })),
            })),
          }
        : isRun
          ? {}
          : { sets: Number(d.sets) || undefined, reps: Number(d.reps) || undefined }),
    });
  }

  return (
    <section className="screen detail edit">
      <div className="edit-bar">
        <button className="detail-back" aria-label="Cancel" onClick={onCancel}>
          <ChevronLeft />
        </button>
        <h1 className="edit-bar-title">Edit workout</h1>
        <button className="edit-save" onClick={save}>
          Save
        </button>
      </div>

      <input
        className="detail-title edit-name"
        value={d.name}
        onChange={(e) => set({ name: e.target.value })}
        placeholder="Workout name"
        aria-label="Workout name"
        autoComplete="off"
      />
      <input
        className="detail-desc edit-desc"
        value={d.description}
        maxLength={60}
        onChange={(e) => set({ description: e.target.value })}
        placeholder="Add a short description"
        aria-label="Short description"
        autoComplete="off"
      />

      {/* What you can change about the session itself: one row each, value on the right. */}
      <div className="props">
        {/* The day. The whole row opens the date picker. */}
        <label className="prop">
          <CalendarIcon className="prop-icon" aria-hidden="true" />
          <span className="k">{fmtDayTitle(d.date)}</span>
          <span className="v">{daysAgo(d.date)}</span>
          <ChevronRight className="prop-chev" aria-hidden="true" />
          <input
            type="date"
            value={d.date}
            max={today()}
            onClick={openPicker}
            onChange={(e) => e.target.value && set({ date: e.target.value })}
            aria-label="Date"
          />
        </label>

        {/* The time frame: start and end each open their own time wheels, on a 12-hour
            clock. Each is changed on its own: editing one never moves the other. */}
        <div className="prop prop-split">
          <ClockIcon className="prop-icon" aria-hidden="true" />
          <span className="k prop-times">
            <button
              className="prop-time"
              aria-haspopup="dialog"
              aria-expanded={picking === "start"}
              aria-label={d.startTime ? `Start time, ${fmtTime(d.startTime)}` : "Add a start time"}
              onClick={(e) => pick("start", e)}
            >
              {d.startTime ? fmtTime(d.startTime) : "Add a start time"}
            </button>
            {endMin !== null && (
              <>
                <span aria-hidden="true">–</span>
                <button
                  className="prop-time"
                  aria-haspopup="dialog"
                  aria-expanded={picking === "end"}
                  aria-label={`End time, ${fmtTime(toClock(endMin))}`}
                  onClick={(e) => pick("end", e)}
                >
                  {fmtTime(toClock(endMin))}
                </button>
              </>
            )}
          </span>
          <label className="v">
            <NumInput label="Duration in minutes" value={d.duration} unit="min" onChange={(v) => set({ duration: digits(v) })} />
          </label>
          <ChevronRight className="prop-chev" aria-hidden="true" />
        </div>

        {/* How it felt: the word on the left, its points on the right. The row opens
            the same wheels as the times, with just the points on it. */}
        <button className="prop" aria-haspopup="dialog" aria-expanded={picking === "feel"} onClick={(e) => pick("feel", e)}>
          <FlameIcon className="prop-icon" aria-hidden="true" />
          <span className="k">{FEEL_LABELS[d.feel]}</span>
          <span className="v">{points(d.feel)}</span>
          <ChevronRight className="prop-chev" aria-hidden="true" />
        </button>

        {/* The rest of the numbers. With a set table they're counted from it, so they
            read as plain values here: no accent, no chevron. */}
        {hasExercises ? (
          <>
            <div className="prop">
              <SetsIcon className="prop-icon" aria-hidden="true" />
              <span className="k">Sets</span>
              <span className="v">{allSets.length}</span>
            </div>
            <div className="prop">
              <RepsIcon className="prop-icon" aria-hidden="true" />
              <span className="k">Reps</span>
              <span className="v">{allSets.reduce((n, s) => n + (Number(s.reps) || 0), 0)}</span>
            </div>
          </>
        ) : isRun ? (
          <>
            <label className="prop">
              <DistanceIcon className="prop-icon" aria-hidden="true" />
              <span className="k">Distance</span>
              <span className="v">
                <NumInput label="Distance in kilometres" value={d.distance} unit="km" onChange={(v) => set({ distance: decimal(v) })} />
              </span>
              <ChevronRight className="prop-chev" aria-hidden="true" />
            </label>
            <div className="prop">
              <PaceIcon className="prop-icon" aria-hidden="true" />
              <span className="k">Pace</span>
              <span className="v">{duration > 0 && distance > 0 ? fmtPace(duration, distance) : "–"}</span>
            </div>
          </>
        ) : (
          <>
            <label className="prop">
              <SetsIcon className="prop-icon" aria-hidden="true" />
              <span className="k">Sets</span>
              <span className="v">
                <NumInput label="Sets" value={d.sets} onChange={(v) => set({ sets: digits(v) })} />
              </span>
              <ChevronRight className="prop-chev" aria-hidden="true" />
            </label>
            <label className="prop">
              <RepsIcon className="prop-icon" aria-hidden="true" />
              <span className="k">Reps</span>
              <span className="v">
                <NumInput label="Reps" value={d.reps} onChange={(v) => set({ reps: digits(v) })} />
              </span>
              <ChevronRight className="prop-chev" aria-hidden="true" />
            </label>
          </>
        )}
      </div>

      {d.exercises.map((ex, ei) => (
        <table className="sets" key={ex.name}>
          <caption>{ex.name}</caption>
          <thead>
            <tr>
              <th scope="col">Set</th>
              <th scope="col">Kg</th>
              <th scope="col">Reps</th>
            </tr>
          </thead>
          <tbody>
            {ex.sets.map((s, si) => (
              <tr key={si}>
                <th scope="row">{si + 1}</th>
                <td>
                  <NumInput
                    label={`${ex.name}, set ${si + 1}, kilograms`}
                    value={s.kg}
                    onChange={(v) => setCell(ei, si, { kg: decimal(v) })}
                  />
                </td>
                <td>
                  <NumInput
                    label={`${ex.name}, set ${si + 1}, reps`}
                    value={s.reps}
                    onChange={(v) => setCell(ei, si, { reps: digits(v) })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}

      <div style={{ flex: 1 }} />

      <div className="vc-actions">
        {confirmDelete ? (
          <>
            <p className="log-hint">Delete this workout? This can’t be undone.</p>
            <button className="vc-save" onClick={onDelete}>
              Delete workout
            </button>
            <button className="vc-discard" onClick={() => setConfirmDelete(false)}>
              Keep it
            </button>
          </>
        ) : (
          <button className="vc-discard" onClick={() => setConfirmDelete(true)}>
            Delete workout
          </button>
        )}
      </div>

      {/* The start. The end stays where it is, so a new start changes how long it ran. */}
      {picking === "start" && (
        <TimeSheet
          title="Start time"
          anchor={anchor}
          value={startMin ?? nowMinutes()}
          check={(m) =>
            endMin === null || m < endMin
              ? { ok: true, text: "" }
              : { ok: false, text: `Has to be before the ${fmtTime(toClock(endMin))} end` }
          }
          onDone={(m) => {
            set(endMin !== null ? { startTime: toClock(m), duration: String(endMin - m) } : { startTime: toClock(m) });
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}

      {/* The end. The start stays where it is. */}
      {picking === "end" && startMin !== null && endMin !== null && (
        <TimeSheet
          title="End time"
          anchor={anchor}
          value={endMin}
          check={(m) =>
            m > startMin
              ? { ok: true, text: "" }
              : { ok: false, text: `Has to be after the ${fmtTime(toClock(startMin))} start` }
          }
          onDone={(m) => {
            set({ duration: String(m - startMin) });
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}

      {picking === "feel" && (
        <ChoiceSheet
          title="How it felt"
          anchor={anchor}
          items={ALL_FEELS.map(points)}
          index={ALL_FEELS.indexOf(d.feel)}
          note={(i) => FEEL_LABELS[ALL_FEELS[i]]}
          onDone={(i) => {
            set({ feel: ALL_FEELS[i] });
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </section>
  );
}

/** A number you can type over, sized to its content so it sits in a line of text. */
export function NumInput({
  value,
  unit,
  label,
  onChange,
}: {
  value: string;
  unit?: string;
  label: string;
  onChange: (v: string) => void;
}) {
  return (
    <span className="edit-num is-editable">
      <input
        inputMode="decimal"
        value={value}
        placeholder="0"
        aria-label={label}
        style={{ width: `${Math.max(1, value.length)}ch` }}
        onChange={(e) => onChange(e.target.value)}
      />
      {unit && <span aria-hidden="true"> {unit}</span>}
    </span>
  );
}
