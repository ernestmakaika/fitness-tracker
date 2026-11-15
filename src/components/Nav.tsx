import { ChartIcon, CheckIcon, DumbbellIcon, HomeIcon, MicIcon, PlusIcon } from "./Icons";
import type { MicControl } from "../screens/Log";

export type Tab = "home" | "workouts" | "log" | "stats";

const ITEMS = [
  { id: "home", label: "Home", Icon: HomeIcon },
  { id: "workouts", label: "Workouts", Icon: DumbbellIcon },
  { id: "stats", label: "Stats", Icon: ChartIcon },
] as const;

export function Nav({
  tab,
  onChange,
  mic,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
  /** Present only while the Log tab is mounted. */
  mic: MicControl | null;
}) {
  const onLog = tab === "log" && mic;
  const mode = onLog ? mic.mode : "idle";

  return (
    <nav className="nav" aria-label="Primary">
      <div className="nav-pill">
        {ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className="nav-item"
            aria-current={tab === id ? "page" : undefined}
            onClick={() => onChange(id)}
          >
            <Icon />
            {label}
          </button>
        ))}
      </div>
      <button
        className={`nav-log ${mode === "listening" ? "is-listening" : ""} ${mode === "disabled" ? "is-disabled" : ""}`}
        aria-label={
          mode === "listening" ? "Done listening" : tab === "log" ? "Start listening" : "Log a workout"
        }
        aria-current={tab === "log" ? "page" : undefined}
        disabled={mode === "disabled"}
        onClick={() => (onLog ? mic.onPress() : onChange("log"))}
      >
        {mode === "listening" ? <CheckIcon /> : <MicIcon />}
        {mode !== "listening" && (
          <span className="nav-log-badge" aria-hidden="true">
            <PlusIcon />
          </span>
        )}
      </button>
    </nav>
  );
}
