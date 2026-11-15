import { useId, useState } from "react";
import { Flame } from "lucide-react";
import type { Feel, Workout } from "../lib/types";
import { ALL_FEELS, FEEL_LABELS } from "../lib/types";
import { statsOf } from "../lib/workout";

/** Up to three headline numbers: big label, small value. */
export function WorkoutStats({ workout }: { workout: Workout }) {
  return (
    <span className="day-stats">
      {statsOf(workout).map((s) => (
        <span key={s.k}>
          <span className="k">{s.k}</span>
          <span className="v">{s.v}</span>
        </span>
      ))}
    </span>
  );
}

/**
 * How it felt: overlapping flames with the 1–5 score beside them.
 * With `explain`, tapping (or hovering) it says what the number means.
 */
export function FeelScore({ workout, explain = false }: { workout: Workout; explain?: boolean }) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  const felt = FEEL_LABELS[workout.feel].toLowerCase();
  const score = (
    <>
      <span className="flames" aria-hidden="true">
        <Flame className="back" strokeWidth={2} />
        <Flame className="front" strokeWidth={2} />
      </span>
      <span className="n" aria-hidden="true">{workout.feel}</span>
    </>
  );

  if (!explain) {
    return (
      <span className="feel-score" role="img" aria-label={`Felt ${felt}, ${workout.feel} of 5`} title={`Felt ${felt}`}>
        {score}
      </span>
    );
  }

  return (
    <span className={`feel-tip-wrap${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="feel-score"
        aria-label={`Felt ${felt}, ${workout.feel} of 5. What does this mean?`}
        aria-describedby={tipId}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      >
        {score}
      </button>
      <span className="feel-tip" role="tooltip" id={tipId}>
        Felt {felt}
      </span>
    </span>
  );
}

/** Choosing how it felt: five flames, lit up to the one you tap. 1 is low, 5 is max. */
export function FeelPicker({
  value,
  onChange,
  labelledBy,
}: {
  /** Unset until the user (or what they said) picks one. */
  value?: Feel;
  onChange: (f: Feel) => void;
  labelledBy: string;
}) {
  return (
    <div className="feel-pick" role="radiogroup" aria-labelledby={labelledBy}>
      {ALL_FEELS.map((f) => (
        <button
          key={f}
          type="button"
          role="radio"
          aria-checked={value === f}
          aria-label={`${f} of 5, ${FEEL_LABELS[f].toLowerCase()}`}
          className={value && f <= value ? "is-lit" : undefined}
          onClick={() => onChange(f)}
        >
          <Flame strokeWidth={1.75} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
