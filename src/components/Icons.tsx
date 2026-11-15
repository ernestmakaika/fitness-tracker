import {
  CalendarDays,
  ChartNoAxesColumn,
  Check,
  Clock,
  Flame,
  Gauge,
  Layers,
  Repeat,
  Route,
  ChevronLeft as LChevronLeft,
  ChevronRight as LChevronRight,
  Dumbbell,
  House,
  Keyboard,
  List,
  Mic,
  Plus,
  X,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import runUrl from "../assets/workout-icons/running.png";
import liftUrl from "../assets/workout-icons/weightlift.png";
import benchUrl from "../assets/workout-icons/bench-press.png";
import squatUrl from "../assets/workout-icons/squats.png";
import yogaUrl from "../assets/workout-icons/yoga.png";
import sprintUrl from "../assets/workout-icons/sprint.png";
import functionalUrl from "../assets/workout-icons/functional.png";
import walkUrl from "../assets/workout-icons/walking.png";
import type { Workout } from "../lib/types";

/** Interface icons come from Lucide, with one shared stroke weight. */
function wrap(Icon: LucideIcon, defaults: LucideProps = {}) {
  return function AppIcon(p: LucideProps) {
    return <Icon strokeWidth={1.75} {...defaults} {...p} />;
  };
}

export const MicIcon = wrap(Mic);
export const ListIcon = wrap(List);
export const CalendarIcon = wrap(CalendarDays);
export const HomeIcon = wrap(House);
/** Stats tab. */
export const ChartIcon = wrap(ChartNoAxesColumn);
/** The list side of the view toggle. */
export const MenuIcon = wrap(List);
export const DumbbellIcon = wrap(Dumbbell);
export const PlusIcon = wrap(Plus);
export const ChevronLeft = wrap(LChevronLeft);
export const ChevronRight = wrap(LChevronRight);
export const CloseIcon = wrap(X);
export const KeyboardIcon = wrap(Keyboard);
export const CheckIcon = wrap(Check);
export const ClockIcon = wrap(Clock);
export const FlameIcon = wrap(Flame);
export const SetsIcon = wrap(Layers);
export const RepsIcon = wrap(Repeat);
export const DistanceIcon = wrap(Route);
export const PaceIcon = wrap(Gauge);

/* ---------- workout types ---------- */

/* Filled activity figures in the Apple Fitness style, from Icons8 (iOS Glyph set).
   They're drawn as a mask, so each one takes the text colour of wherever it sits. */

const TYPE_GLYPHS: Record<NonNullable<Workout["type"]>, string> = {
  run: runUrl,
  lift: liftUrl,
  cardio: sprintUrl,
  mobility: yogaUrl,
  sport: functionalUrl,
  other: walkUrl,
};

function glyphFor(w: Pick<Workout, "type" | "name" | "exercises">): string {
  if (w.type === "lift") {
    const what = `${w.exercises?.[0]?.name ?? ""} ${w.name}`.toLowerCase();
    if (/bench|push|chest/.test(what)) return benchUrl;
    if (/squat|leg/.test(what)) return squatUrl;
  }
  return TYPE_GLYPHS[w.type ?? "other"];
}

/** Activity figure for a workout: by type, and for strength by the lift itself. */
export function WorkoutIcon({ workout }: { workout: Pick<Workout, "type" | "name" | "exercises"> }) {
  const mask = `url(${glyphFor(workout)})`;
  return <span className="glyph" aria-hidden="true" style={{ maskImage: mask, WebkitMaskImage: mask }} />;
}
