import { useEffect, useRef, useState } from "react";
import { parseWorkout, type ParsedWorkout } from "../lib/parseWorkout";
import { shortDescription } from "../lib/workout";
import { FeelPicker } from "../components/WorkoutStats";
import { useSpeech } from "../lib/useSpeech";
import type { Workout } from "../lib/types";
import { addMinutes, fmtDayShort, fmtMinutes, fmtRelative, fmtTime, nowTime, today } from "../lib/dates";
import { CheckIcon, ChevronLeft, MicIcon, PlusIcon } from "../components/Icons";

type Phase = "idle" | "listening" | "preview" | "typing" | "saved";

/** What the nav's centre button should do/look like while on the Log tab. */
export type MicMode = "idle" | "listening" | "disabled";
export interface MicControl {
  mode: MicMode;
  onPress: () => void;
}

const EXAMPLES = [
  "Forty-five minute push day, felt pretty good",
  "Thirty minute morning run, felt steady",
  "Hour of yoga yesterday, felt strong",
  "Strength day, squats for fifty minutes, pretty heavy",
];

/** How long the "Workout saved" confirmation stays up before going home. */
const SAVED_MS = 1800;

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
  const speech = useSpeech();
  const [phase, setPhase] = useState<Phase>("idle");
  const [parsed, setParsed] = useState<ParsedWorkout | null>(null);
  const [typed, setTyped] = useState("");
  const [showSets, setShowSets] = useState(false);
  const [sets, setSets] = useState("");
  const [reps, setReps] = useState("");
  const [exampleIdx, setExampleIdx] = useState(0);
  const [exampleFading, setExampleFading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (phase !== "idle") return;
    setExampleFading(false);
    let swap: ReturnType<typeof setTimeout>;
    const id = setInterval(() => {
      setExampleFading(true);
      swap = setTimeout(() => {
        setExampleIdx((i) => (i + 1) % EXAMPLES.length);
        setExampleFading(false);
      }, 260);
    }, 3600);
    return () => {
      clearInterval(id);
      clearTimeout(swap);
    };
  }, [phase]);

  useEffect(() => {
    if (phase === "typing") inputRef.current?.focus();
  }, [phase]);

  const liveText = (speech.finalText + " " + speech.interim).trim();

  function beginListening() {
    setPhase("listening");
    speech.start((text) => {
      if (!text) {
        setPhase("idle");
        return;
      }
      setParsed(parseWorkout(text));
      setPhase("preview");
    });
  }

  function submitTyped() {
    const t = typed.trim();
    if (!t) return;
    setParsed(parseWorkout(t));
    setPhase("preview");
  }

  function save() {
    if (!parsed || !parsed.feel || !parsed.durationMin) return;
    onSave({
      name: parsed.name,
      date: parsed.date,
      durationMin: parsed.durationMin,
      feel: parsed.feel,
      type: parsed.type,
      note: parsed.note,
      description: shortDescription(parsed.note),
      ...(Number(sets) > 0 ? { sets: Number(sets) } : {}),
      ...(Number(reps) > 0 ? { reps: Number(reps) } : {}),
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
    speech.stop();
    setShowSets(false);
    setSets("");
    setReps("");
    setParsed(null);
    setTyped("");
    setPhase("idle");
  }

  // Hand the nav's centre button a role that matches the current phase.
  const blocked = speech.status === "unsupported" || speech.status === "denied";
  useEffect(() => {
    let ctl: MicControl;
    if (phase === "listening") ctl = { mode: "listening", onPress: () => speech.stop() };
    else if (phase === "saved" || blocked) ctl = { mode: "disabled", onPress: () => {} };
    else
      ctl = {
        mode: "idle",
        onPress: () => {
          setParsed(null);
          setTyped("");
          beginListening();
        },
      };
    registerMic(ctl);
    return () => registerMic(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, blocked]);

  // ---------- render ----------

  if (phase === "saved" && parsed) {
    return (
      <section className="screen log-screen">
        <div className="saved rise" role="status" aria-live="polite">
          <span className="saved-mark" aria-hidden="true">
            <CheckIcon />
          </span>
          <h1 className="home-title">Workout saved</h1>
          <p className="saved-sub">
            {parsed.name}
            {parsed.durationMin ? ` · ${fmtMinutes(parsed.durationMin)}` : ""} · {fmtDayShort(parsed.date)}
          </p>
        </div>
      </section>
    );
  }

  if (phase === "preview" && parsed) {
    const canSave = !!parsed.feel && !!parsed.durationMin;
    const isToday = parsed.date === today();
    const when =
      isToday && parsed.durationMin
        ? `Today, ${fmtTime(addMinutes(nowTime(), -parsed.durationMin))}`
        : fmtRelative(parsed.date);
    return (
      <section className="screen log-screen vc">
        <header className="vc-head">
          <button className="vc-back" onClick={reset} aria-label="Back">
            <ChevronLeft />
          </button>
          <h1 className="vc-title">Confirm workout</h1>
        </header>

        <div className="vc-said rise">
          <div className="vc-said-top">
            <span className="vc-label">You said</span>
            <button
              className="vc-rerecord"
              onClick={() => {
                setParsed(null);
                setTyped("");
                beginListening();
              }}
            >
              <MicIcon aria-hidden="true" />
              Re-record
            </button>
          </div>
          <p className="vc-quote">“{parsed.note}”</p>
        </div>

        <div className="vc-form rise" style={{ animationDelay: "60ms" }}>
          <div className="vc-field">
            <label className="vc-label" htmlFor="w-name">Workout</label>
            <input
              id="w-name"
              value={parsed.name}
              onChange={(e) => setParsed({ ...parsed, name: e.target.value })}
              autoComplete="off"
            />
          </div>

          <div className="vc-pair">
            <div className="vc-field">
              <label className="vc-label" htmlFor="w-duration">Duration</label>
              <div className="vc-suffix">
                <input
                  id="w-duration"
                  inputMode="numeric"
                  placeholder="0"
                  value={parsed.durationMin ? String(parsed.durationMin) : ""}
                  onChange={(e) => {
                    const n = parseInt(e.target.value.replace(/\D/g, ""), 10);
                    setParsed({ ...parsed, durationMin: Number.isFinite(n) && n > 0 ? n : undefined });
                  }}
                />
                <span aria-hidden="true">min</span>
              </div>
            </div>
            <div className="vc-field">
              <label className="vc-label" htmlFor="w-date">When</label>
              <div className="vc-date">
                <span>{when}</span>
                <input
                  id="w-date"
                  type="date"
                  value={parsed.date}
                  max={today()}
                  onChange={(e) => setParsed({ ...parsed, date: e.target.value || today() })}
                  aria-label="When"
                />
              </div>
            </div>
          </div>

          <div className="vc-field">
            <span className="vc-label" id="feel-label">How did it feel?</span>
            <FeelPicker labelledBy="feel-label" value={parsed.feel} onChange={(feel) => setParsed({ ...parsed, feel })} />
          </div>

          {showSets ? (
            <div className="vc-pair">
              <div className="vc-field">
                <label className="vc-label" htmlFor="w-sets">Sets</label>
                <input id="w-sets" inputMode="numeric" placeholder="0" value={sets}
                  onChange={(e) => setSets(e.target.value.replace(/\D/g, ""))} />
              </div>
              <div className="vc-field">
                <label className="vc-label" htmlFor="w-reps">Reps</label>
                <input id="w-reps" inputMode="numeric" placeholder="0" value={reps}
                  onChange={(e) => setReps(e.target.value.replace(/\D/g, ""))} />
              </div>
            </div>
          ) : (
            <button className="vc-add" onClick={() => setShowSets(true)}>
              <PlusIcon aria-hidden="true" />
              Add sets and reps
            </button>
          )}
        </div>

        <div style={{ flex: 1 }} />

        <div className="vc-actions">
          <button className="vc-save" disabled={!canSave} onClick={save}>
            {canSave ? "Save workout" : !parsed.durationMin ? "Add a duration" : "Pick how it felt"}
          </button>
          <button className="vc-discard" onClick={reset}>Discard</button>
        </div>
      </section>
    );
  }

  if (phase === "typing") {
    return (
      <section className="screen log-screen vc">
        <header className="vc-head">
          <button className="vc-back" onClick={reset} aria-label="Back">
            <ChevronLeft />
          </button>
          <h1 className="vc-title">Type a workout</h1>
        </header>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitTyped();
          }}
          className="vc-form log-typed rise"
        >
          <div className="vc-field">
            <label className="vc-label" htmlFor="w-typed">What did you do?</label>
            <textarea
              id="w-typed"
              ref={inputRef}
              value={typed}
              rows={3}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitTyped();
                }
              }}
              placeholder={EXAMPLES[exampleIdx]}
              autoComplete="off"
            />
          </div>
          <p className="log-hint">Same as speaking: say what, how long, and how it felt.</p>
          <div style={{ flex: 1 }} />
          <div className="vc-actions">
            <button className="vc-save" type="submit" disabled={!typed.trim()}>
              Continue
            </button>
          </div>
        </form>
      </section>
    );
  }

  // idle or listening
  const listening = phase === "listening";

  return (
    <section className="screen log-screen">
      <header className="home-head">
        <h1 className="home-title">{listening ? "Listening" : "Log a workout"}</h1>
      </header>

      {blocked && !listening ? (
        <div className="panel rise">
          <h2 className="panel-title">
            {speech.status === "denied" ? "Microphone is off." : "This browser can’t listen."}
          </h2>
          <p className="panel-sub">
            {speech.status === "denied"
              ? "Allow microphone access in your browser settings, or type instead."
              : "Voice works in Chrome and Safari. You can still type your workout."}
          </p>
        </div>
      ) : (
        <div className="vc-said">
          <span className="vc-label">{listening ? "You’re saying" : "Try saying"}</span>
          {listening ? (
            <p className="vc-quote" aria-live="polite">
              {liveText ? `“${liveText}”` : "Say what you did…"}
            </p>
          ) : (
            <p className={`vc-quote log-example ${exampleFading ? "is-fading" : ""}`} aria-hidden="true">
              “{EXAMPLES[exampleIdx]}”
            </p>
          )}
        </div>
      )}

      {speech.status === "error" && !listening ? (
        <p className="log-hint" role="alert">
          Didn’t catch that. Tap the mic to try again, or type it.
        </p>
      ) : listening ? (
        <p className="log-hint">Tap the tick when you’re done.</p>
      ) : blocked ? null : (
        <p className="log-hint">Tap the mic and say what you did.</p>
      )}

      <div style={{ flex: 1 }} />

      <div className="vc-actions">
        {listening ? (
          <button className="vc-discard" onClick={reset}>
            Cancel
          </button>
        ) : blocked ? (
          <button className="vc-save" onClick={() => setPhase("typing")}>
            Type a workout
          </button>
        ) : (
          <button className="vc-discard" onClick={() => setPhase("typing")}>
            Type it instead
          </button>
        )}
      </div>
    </section>
  );
}
