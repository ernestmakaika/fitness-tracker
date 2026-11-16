import { useEffect, useRef, useState } from "react";
import { GEMINI_API_KEY, extractWorkout, type DraftType } from "../lib/gemini";
import { useRecorder } from "../lib/useRecorder";
import { fmtPace, shortDescription } from "../lib/workout";
import { ChoiceSheet, TimeSheet } from "../components/TimeSheet";
import type { Feel, Workout, WorkoutType } from "../lib/types";
import { ALL_FEELS, FEEL_LABELS } from "../lib/types";
import { fmtDayShort, fmtDayTitle, fmtMinutes, fmtTime, today } from "../lib/dates";
import {
  CalendarIcon, CheckIcon, ChevronLeft, ChevronRight, ClockIcon, DistanceIcon, FlameIcon, PaceIcon, PlusIcon, RepsIcon, SetsIcon,
} from "../components/Icons";
import {
  DAY_END, NumInput, daysAgo, decimal, digits, nowMinutes, openPicker, points, toClock, toMinutes,
} from "./WorkoutDetail";

type Phase = "form" | "saved";

/** What the nav's round button should do/look like while on the Log tab. */
export type MicMode = "idle" | "listening" | "disabled";
export interface MicControl {
  mode: MicMode;
  onPress: () => void;
}

/** How long the "Workout saved" confirmation stays up before going home. */
const SAVED_MS = 1800;

/** The types on offer. Each opens its own rows. */
const KINDS: Array<{ id: WorkoutType; label: string }> = [
  { id: "run", label: "Running" },
  { id: "lift", label: "Lifting" },
  { id: "mobility", label: "Yoga" },
  { id: "walk", label: "Walking" },
];

/** Gemini's names for the types, and the ones this app stores. */
const DRAFT_TYPES: Record<DraftType, WorkoutType> = { running: "run", lifting: "lift", yoga: "mobility", walking: "walk" };

/** Numbers are held as text while typing, so a field can be emptied and retyped. */
interface SetDraft {
  kg: string;
  reps: string;
}
interface ExerciseDraft {
  name: string;
  sets: SetDraft[];
}
interface Form {
  name: string;
  description: string;
  /** Not chosen to begin with: picking it is what opens up the rest of the form. */
  type?: WorkoutType;
  date: string;
  startTime?: string;
  duration: string;
  distance: string;
  feel?: Feel;
  exercises: ExerciseDraft[];
}

const blankExercise = (): ExerciseDraft => ({ name: "", sets: [{ kg: "", reps: "" }] });
const blankForm = (): Form => ({
  name: "",
  description: "",
  date: today(),
  duration: "",
  distance: "",
  exercises: [blankExercise()],
});

/**
 * Log a workout by filling in the form, laid out like the edit screen. Voice is a
 * shortcut on top of it: the round button in the nav records, Gemini works out
 * what was said, and the fields fill in. The form stays on screen throughout.
 */
export function Log({
  onSave,
  onDone,
  registerMic,
}: {
  onSave: (w: Omit<Workout, "id">) => void;
  /** Called once the save has been confirmed on screen. */
  onDone: () => void;
  registerMic: (ctl: MicControl | null) => void;
}) {
  const [phase, setPhase] = useState<Phase>("form");
  const [form, setForm] = useState<Form>(blankForm);
  /** Extra detail Gemini picked up from the recording, kept with the workout. */
  const [heardNotes, setHeardNotes] = useState<string | null>(null);
  /** The recording is with Gemini. */
  const [filling, setFilling] = useState(false);
  /** The last thing voice had to say: that it worked, or why it didn't. */
  const [voice, setVoice] = useState<{ ok: boolean; text: string } | null>(null);
  const request = useRef<AbortController | null>(null);
  /** A finished recording, waiting for "Fill form from recording". */
  const [clip, setClip] = useState<Blob | null>(null);
  const recorder = useRecorder({ onAudio: setClip, onError: (text) => setVoice({ ok: false, text }) });
  const recording = recorder.status === "recording";
  /** While voice is at work the form stays on screen, but can't be typed into. */
  const busy = recorder.status !== "idle" || filling;
  /** Which wheels are open, if any, and the row they belong to. */
  const [picking, setPicking] = useState<"start" | "end" | "feel" | null>(null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const set = (patch: Partial<Form>) => setForm((prev) => ({ ...prev, ...patch }));

  function pick(which: "start" | "end" | "feel", e: React.MouseEvent<HTMLElement>) {
    setAnchor(e.currentTarget.closest<HTMLElement>(".prop"));
    setPicking(which);
  }

  const isRun = form.type === "run";
  /** Runs and walks both cover ground; only a run has to say how far. */
  const hasDistance = isRun || form.type === "walk";
  const isLift = form.type === "lift";
  const duration = Number(form.duration);
  const distance = Number(form.distance);
  const allSets = form.exercises.flatMap((ex) => ex.sets);
  const startMin = form.startTime ? toMinutes(form.startTime) : null;
  /** When it ended, in minutes from midnight; null until there's a start and a length. */
  const endMin = startMin !== null && duration > 0 ? Math.min(DAY_END, startMin + duration) : null;
  function setExercise(ei: number, patch: Partial<ExerciseDraft>) {
    set({ exercises: form.exercises.map((ex, i) => (i === ei ? { ...ex, ...patch } : ex)) });
  }

  function setCell(ei: number, si: number, patch: Partial<SetDraft>) {
    setExercise(ei, { sets: form.exercises[ei].sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) });
  }

  /** Start recording. Without a key there's nowhere to send it, so say so instead. */
  function beginListening() {
    setVoice(null);
    setClip(null);
    setPicking(null);
    if (!GEMINI_API_KEY) {
      setVoice({ ok: false, text: "Voice needs a Gemini API key. Add it to .env.local, then restart the dev server." });
      return;
    }
    recorder.start();
  }

  /** Send the recording to Gemini and fill in what it heard. Anything it missed is left as it was. */
  async function fillFrom(audio: Blob) {
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 60_000);
    setFilling(true);
    setVoice(null);
    try {
      const draft = await extractWorkout({ audio, localDate: today(), signal: controller.signal });
      if (request.current !== controller) return;
      setForm((prev) => ({
        ...prev,
        name: draft.name,
        type: DRAFT_TYPES[draft.type],
        date: draft.date ?? prev.date,
        startTime: draft.time ?? prev.startTime,
        duration: draft.durationMinutes !== null ? String(Math.round(draft.durationMinutes)) : prev.duration,
        distance: draft.distanceKm !== null ? String(draft.distanceKm) : prev.distance,
        feel: draft.feeling ?? prev.feel,
        description: draft.notes ? shortDescription(draft.notes) : prev.description,
        exercises: draft.exercises.length
          ? draft.exercises.map((ex) => ({
              name: ex.name,
              sets: ex.sets.length
                ? ex.sets.map((s) => ({ kg: s.weightKg !== null ? String(s.weightKg) : "", reps: s.reps !== null ? String(s.reps) : "" }))
                : [{ kg: "", reps: "" }],
            }))
          : prev.exercises,
      }));
      setHeardNotes(draft.notes);
      // The filled-in form is the confirmation; nothing more to say about it.
      setClip(null);
    } catch (cause) {
      if (request.current !== controller) return;
      setVoice({
        ok: false,
        text: controller.signal.aborted ? "That took too long. Try again." : cause instanceof Error ? cause.message : "Something went wrong. Try again.",
      });
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) {
        request.current = null;
        setFilling(false);
      }
    }
  }

  /** Stop listening or waiting, and leave the form as it is. */
  function cancelVoice() {
    recorder.cancel();
    request.current?.abort();
    request.current = null;
    setFilling(false);
  }

  // Leaving the screen drops any request still in flight.
  useEffect(() => () => request.current?.abort(), []);

  /** The first thing still needed before saving. */
  function missing(): string | null {
    if (!form.name.trim()) return "a workout name";
    if (!form.type) return "a type";
    if (!form.startTime) return "a start time";
    if (!(duration > 0)) return "a duration";
    if (!form.feel) return "how it felt";
    if (isRun && !(distance > 0)) return "a distance";
    if (isLift) {
      if (form.exercises.some((ex) => !ex.name.trim())) return "a name for each exercise";
      if (allSets.some((s) => !(Number(s.reps) >= 1) || s.kg === "")) return "weight and reps for every set";
    }
    return null;
  }
  const needs = missing();

  function save() {
    if (needs || !form.feel || !form.type) return;
    const description = form.description.trim() || undefined;
    const note = heardNotes ?? description;
    onSave({
      name: form.name.trim(),
      date: form.date,
      startTime: form.startTime,
      durationMin: Math.max(1, Math.round(duration)),
      feel: form.feel,
      type: form.type,
      ...(description ? { description } : {}),
      ...(note ? { note } : {}),
      ...(hasDistance && distance > 0 ? { distanceKm: distance } : {}),
      ...(isLift
        ? {
            exercises: form.exercises.map((ex) => ({
              name: ex.name.trim(),
              sets: ex.sets.map((s) => ({ kg: Number(s.kg) || 0, reps: Number(s.reps) })),
            })),
          }
        : {}),
    });
    setPhase("saved");
  }

  // Close the loop: confirm the save, then hand back to Home.
  useEffect(() => {
    if (phase !== "saved") return;
    const id = setTimeout(onDone, SAVED_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function reset() {
    cancelVoice();
    setClip(null);
    setForm(blankForm());
    setHeardNotes(null);
    setVoice(null);
    setPicking(null);
    setPhase("form");
  }

  // Hand the nav's round button a role that matches what voice is doing:
  // a mic to start, a tick to finish, and nothing to press while Gemini works.
  useEffect(() => {
    let ctl: MicControl;
    if (recording) ctl = { mode: "listening", onPress: recorder.stop };
    else if (phase === "saved" || busy) ctl = { mode: "disabled", onPress: () => {} };
    else ctl = { mode: "idle", onPress: beginListening };
    registerMic(ctl);
    return () => registerMic(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, recording, busy]);

  // ---------- render ----------

  if (phase === "saved") {
    return (
      <section className="screen log-screen">
        <div className="saved rise" role="status" aria-live="polite">
          <span className="saved-mark" aria-hidden="true">
            <CheckIcon />
          </span>
          <h1 className="home-title">Workout saved</h1>
          <p className="saved-sub">
            {form.name.trim()} · {fmtMinutes(Math.max(1, Math.round(duration)))} · {fmtDayShort(form.date)}
          </p>
        </div>
      </section>
    );
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(blankForm());

  return (
    <section className="screen log-screen edit">
      <div className="edit-bar">
        <button className="detail-back" aria-label="Back" onClick={onDone}>
          <ChevronLeft />
        </button>
        <h1 className="edit-bar-title">Log workout</h1>
        <button className="edit-save" disabled={needs !== null || busy} onClick={save}>
          Save
        </button>
      </div>

      {/* Voice at work, above the form it's filling in. The form stays where it is. */}
      {(busy || clip || voice) && (
        <div className="vc-said rise" role={voice && !voice.ok ? "alert" : "status"}>
          <div className="vc-said-top">
            <span className="vc-label">{recording ? "Listening" : busy ? "One moment" : clip ? "Recording ready" : "Voice"}</span>
            {busy ? (
              <button className="vc-rerecord" onClick={cancelVoice}>
                Cancel
              </button>
            ) : (
              clip && (
                <button className="vc-rerecord" onClick={() => setClip(null)}>
                  Discard
                </button>
              )
            )}
          </div>
          <p className="vc-quote">
            {recorder.status === "requesting"
              ? "Waiting for the microphone…"
              : recording
                ? "Say what you did, then tap the tick."
                : filling
                  ? "Filling in the form…"
                  : (voice?.text ?? "Your recording goes to Google Gemini to fill in the form.")}
          </p>
          {clip && !busy && (
            <div className="vc-actions">
              <button className="vc-save" onClick={() => fillFrom(clip)}>
                Fill form from recording
              </button>
            </div>
          )}
        </div>
      )}

      {/* The form itself. It can't be typed into while voice is at work. */}
      <div className={`log-fields ${busy ? "is-busy" : ""}`} inert={busy}>

      <input
        className="detail-title edit-name"
        value={form.name}
        onChange={(e) => set({ name: e.target.value })}
        placeholder="Workout name"
        aria-label="Workout name"
        autoComplete="off"
      />
      <input
        className="detail-desc edit-desc"
        value={form.description}
        maxLength={60}
        onChange={(e) => set({ description: e.target.value })}
        placeholder="Add a short description"
        aria-label="Short description"
        autoComplete="off"
      />

      <div className="period-toggle log-kind" role="group" aria-label="Type">
        {KINDS.map((k) => (
          <button key={k.id} aria-pressed={form.type === k.id} onClick={() => set({ type: k.id })}>
            {k.label}
          </button>
        ))}
      </div>

      {/* Everything else waits for the type, then shows only the rows that type needs. */}
      {form.type && (
        <div className="props rise">
          {/* The day. The whole row opens the date picker. */}
          <label className="prop">
            <CalendarIcon className="prop-icon" aria-hidden="true" />
            <span className="k">{fmtDayTitle(form.date)}</span>
            <span className="v">{daysAgo(form.date)}</span>
            <ChevronRight className="prop-chev" aria-hidden="true" />
            <input
              type="date"
              value={form.date}
              max={today()}
              onClick={openPicker}
              onChange={(e) => e.target.value && set({ date: e.target.value })}
              aria-label="Date"
            />
          </label>

          {/* The time frame: start and end each open their own wheels, and the length
              can be typed on the right. Each is changed on its own. */}
          <div className="prop prop-split">
            <ClockIcon className="prop-icon" aria-hidden="true" />
            <span className="k prop-times">
              <button
                className={`prop-time ${form.startTime ? "" : "is-empty"}`}
                aria-haspopup="dialog"
                aria-expanded={picking === "start"}
                aria-label={form.startTime ? `Start time, ${fmtTime(form.startTime)}` : "Add a start time"}
                onClick={(e) => pick("start", e)}
              >
                {form.startTime ? fmtTime(form.startTime) : "Add a start time"}
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
              <NumInput label="Duration in minutes" value={form.duration} unit="min" onChange={(v) => set({ duration: digits(v) })} />
            </label>
            <ChevronRight className="prop-chev" aria-hidden="true" />
          </div>

          {/* How it felt: the word on the left once chosen, its points on the right. */}
          <button className="prop" aria-haspopup="dialog" aria-expanded={picking === "feel"} onClick={(e) => pick("feel", e)}>
            <FlameIcon className="prop-icon" aria-hidden="true" />
            <span className={`k ${form.feel ? "" : "is-empty"}`}>{form.feel ? FEEL_LABELS[form.feel] : "How it felt"}</span>
            <span className="v">{form.feel ? points(form.feel) : ""}</span>
            <ChevronRight className="prop-chev" aria-hidden="true" />
          </button>

          {hasDistance && (
            <>
              <label className="prop">
                <DistanceIcon className="prop-icon" aria-hidden="true" />
                <span className="k">Distance</span>
                <span className="v">
                  <NumInput label="Distance in kilometres" value={form.distance} unit="km" onChange={(v) => set({ distance: decimal(v) })} />
                </span>
                <ChevronRight className="prop-chev" aria-hidden="true" />
              </label>
              <div className="prop">
                <PaceIcon className="prop-icon" aria-hidden="true" />
                <span className="k">Pace</span>
                <span className="v">{duration > 0 && distance > 0 ? fmtPace(duration, distance) : "–"}</span>
              </div>
            </>
          )}

          {/* Counted from the set table below. */}
          {isLift && (
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
          )}
        </div>
      )}

      {/* Strength: every exercise, set by set, in the same table as the edit screen. */}
      {isLift &&
        form.exercises.map((ex, ei) => (
          <div className="log-exercise" key={ei}>
            <table className="sets">
              <caption>
                <input
                  className="log-ex-name"
                  value={ex.name}
                  onChange={(e) => setExercise(ei, { name: e.target.value })}
                  placeholder="Exercise name"
                  aria-label={`Exercise ${ei + 1} name`}
                  autoComplete="off"
                />
              </caption>
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
                        label={`Exercise ${ei + 1}, set ${si + 1}, kilograms`}
                        value={s.kg}
                        onChange={(v) => setCell(ei, si, { kg: decimal(v) })}
                      />
                    </td>
                    <td>
                      <NumInput
                        label={`Exercise ${ei + 1}, set ${si + 1}, reps`}
                        value={s.reps}
                        onChange={(v) => setCell(ei, si, { reps: digits(v) })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="log-row-actions">
              {/* A new set starts as a copy of the last one: most sets repeat. */}
              <button className="vc-add" onClick={() => setExercise(ei, { sets: [...ex.sets, { ...ex.sets[ex.sets.length - 1] }] })}>
                <PlusIcon aria-hidden="true" />
                Add set
              </button>
              {ex.sets.length > 1 && (
                <button className="vc-add" onClick={() => setExercise(ei, { sets: ex.sets.slice(0, -1) })}>
                  Remove last set
                </button>
              )}
              {form.exercises.length > 1 && (
                <button className="vc-add" onClick={() => set({ exercises: form.exercises.filter((_, i) => i !== ei) })}>
                  Remove exercise
                </button>
              )}
            </div>
          </div>
        ))}
      {isLift && (
        <button className="vc-add log-add-exercise" onClick={() => set({ exercises: [...form.exercises, blankExercise()] })}>
          <PlusIcon aria-hidden="true" />
          Add exercise
        </button>
      )}

      </div>

      {/* One quiet line: how voice works to begin with, then what's still needed to save. */}
      <p className="log-hint log-status" role="status">
        {!dirty ? "Fill it in, or tap the mic and say what you did." : needs ? `Still needed: ${needs}.` : "Ready to save."}
      </p>

      <div style={{ flex: 1 }} />

      {dirty && (
        <div className="vc-actions">
          <button className="vc-discard" onClick={reset}>
            Discard
          </button>
        </div>
      )}

      {/* The start. Once there's an end it stays put, so a new start changes the length. */}
      {picking === "start" && (
        <TimeSheet
          title="Start time"
          anchor={anchor}
          value={startMin ?? Math.max(0, nowMinutes() - (duration > 0 ? Math.round(duration) : 0))}
          check={(m) =>
            startMin === null || endMin === null || m < endMin
              ? { ok: true, text: "" }
              : { ok: false, text: `Has to be before the ${fmtTime(toClock(endMin))} end` }
          }
          onDone={(m) => {
            set(
              startMin !== null && endMin !== null
                ? { startTime: toClock(m), duration: String(endMin - m) }
                : { startTime: toClock(m) },
            );
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
          index={ALL_FEELS.indexOf(form.feel ?? 3)}
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
