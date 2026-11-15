import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CheckIcon, CloseIcon } from "./Icons";

/** Height of one row on a wheel, in px. Five rows show at a time. Keep in step with the CSS. */
const ROW = 40;

const HOURS = ["12", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const PERIODS = ["AM", "PM"];

/**
 * Pick a time of day on three wheels (hour, minute, AM/PM), in a panel under its row.
 * Nothing changes until it's confirmed; closing the panel leaves the time as it was.
 */
export function TimeSheet({
  title,
  anchor,
  value,
  check,
  onDone,
  onClose,
}: {
  title: string;
  /** The row being edited; the picker opens just under it. */
  anchor: HTMLElement | null;
  /** Minutes from midnight to start the wheels on. */
  value: number;
  /** Whether a time can be chosen and, when it can't, the reason shown under the wheels. */
  check: (minutes: number) => { ok: boolean; text: string };
  onDone: (minutes: number) => void;
  onClose: () => void;
}) {
  const [hour, setHour] = useState(Math.floor(value / 60) % 12);
  const [minute, setMinute] = useState(value % 60);
  const [period, setPeriod] = useState(value >= 720 ? 1 : 0);

  const minutes = (hour + period * 12) * 60 + minute;
  const { ok, text } = check(minutes);

  return (
    <WheelSheet title={title} anchor={anchor} ok={ok} note={text} onDone={() => onDone(minutes)} onClose={onClose}>
      <Wheel label="Hour" items={HOURS} index={hour} onChange={setHour} />
      <Wheel label="Minute" items={MINUTES} index={minute} onChange={setMinute} />
      <Wheel label="AM or PM" items={PERIODS} index={period} onChange={setPeriod} />
    </WheelSheet>
  );
}

/**
 * Pick one value from a short list on a single wheel, in the same panel as the time.
 * `note` is the label under the wheel for whichever row is in the middle.
 */
export function ChoiceSheet({
  title,
  anchor,
  items,
  index: initial,
  note,
  onDone,
  onClose,
}: {
  title: string;
  anchor: HTMLElement | null;
  items: string[];
  index: number;
  note: (index: number) => string;
  onDone: (index: number) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initial);
  return (
    <WheelSheet title={title} anchor={anchor} ok note={note(index)} onDone={() => onDone(index)} onClose={onClose}>
      <Wheel label={title} items={items} index={index} onChange={setIndex} />
    </WheelSheet>
  );
}

/** The panel every wheel lives in: cancel, title, confirm, then the wheels. */
function WheelSheet({
  title,
  anchor,
  ok,
  note,
  onDone,
  onClose,
  children,
}: {
  title: string;
  anchor: HTMLElement | null;
  ok: boolean;
  /** The line under the wheels: a label for the choice, or why it can't be confirmed. */
  note?: string;
  onDone: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Sit just under the row that opened it, and scroll into view if that runs off the screen.
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.offsetParent;
    if (!el || !parent || !anchor) return;
    el.style.top = `${anchor.getBoundingClientRect().bottom - parent.getBoundingClientRect().top + 8}px`;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "nearest", behavior: still ? "auto" : "smooth" });
  }, [anchor]);

  return (
    <>
      <div className="picker-scrim" onClick={onClose} />
      <div ref={ref} className="picker" role="dialog" aria-modal="true" aria-label={title}>
        <div className="time-head">
          <button className="sheet-close" aria-label="Cancel" onClick={onClose} autoFocus>
            <CloseIcon />
          </button>
          <h2 className="edit-bar-title">{title}</h2>
          <button className="sheet-close time-done" aria-label="Done" disabled={!ok} onClick={onDone}>
            <CheckIcon />
          </button>
        </div>

        <div className="wheels">
          <span className="wheels-band" aria-hidden="true" />
          {children}
        </div>

        <p className="time-note" role="status">
          {note}
        </p>
      </div>
    </>
  );
}

/** One scrolling column. Whatever row rests in the middle is the value. */
function Wheel({
  items,
  index,
  label,
  onChange,
}: {
  items: string[];
  index: number;
  label: string;
  onChange: (index: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  // Bring the chosen row to the middle: at once on opening, gliding after a tap or key.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const glide = mounted.current && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    mounted.current = true;
    if (Math.round(el.scrollTop / ROW) !== index) {
      el.scrollTo({ top: index * ROW, behavior: glide ? "smooth" : "auto" });
    }
  }, [index]);

  const clamp = (i: number) => Math.max(0, Math.min(items.length - 1, i));

  return (
    <div
      ref={ref}
      className="wheel"
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={index}
      aria-valuemin={0}
      aria-valuemax={items.length - 1}
      aria-valuetext={items[index]}
      onScroll={(e) => {
        const i = clamp(Math.round(e.currentTarget.scrollTop / ROW));
        if (i !== index) onChange(i);
      }}
      onKeyDown={(e) => {
        const to =
          e.key === "ArrowDown" ? index + 1
          : e.key === "ArrowUp" ? index - 1
          : e.key === "Home" ? 0
          : e.key === "End" ? items.length - 1
          : null;
        if (to === null) return;
        e.preventDefault();
        onChange(clamp(to));
      }}
    >
      {items.map((item, i) => (
        <span key={item} className={`wheel-row ${i === index ? "is-on" : ""}`} aria-hidden="true" onClick={() => onChange(i)}>
          {item}
        </span>
      ))}
    </div>
  );
}
