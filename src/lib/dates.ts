/** Date helpers. All dates are local-time ISO day strings: YYYY-MM-DD. */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function today(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function daysBetween(a: string, b: string): number {
  const ms = fromISODate(b).getTime() - fromISODate(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Monday-start week. */
export function startOfWeek(iso: string): string {
  const d = fromISODate(iso);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dow);
  return toISODate(d);
}

export function startOfMonth(iso: string): string {
  const d = fromISODate(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function addMonths(iso: string, n: number): string {
  const d = fromISODate(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth() + n, 1));
}

export function daysInMonth(iso: string): number {
  const d = fromISODate(iso);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function fmtShort(iso: string): string {
  const d = fromISODate(iso);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtLong(iso: string): string {
  const d = fromISODate(iso);
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
}

export function fmtMonthYear(iso: string): string {
  const d = fromISODate(iso);
  return `${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtWeekLabel(weekStart: string): string {
  const t = today();
  const thisWeek = startOfWeek(t);
  if (weekStart === thisWeek) return "This week";
  if (weekStart === addDays(thisWeek, -7)) return "Last week";
  const d = fromISODate(weekStart);
  return `Week of ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtRelative(iso: string): string {
  const n = daysBetween(iso, today());
  if (n === 0) return "Today";
  if (n === 1) return "Yesterday";
  if (n < 7) return WEEKDAYS_LONG[fromISODate(iso).getDay()];
  return fmtShort(iso);
}

export function fmtDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function weekdayIndex(name: string): number {
  const i = WEEKDAYS_LONG.findIndex((w) => w.toLowerCase().startsWith(name.toLowerCase().slice(0, 3)));
  return i;
}

/** "Friday, Nov 13" */
export function fmtDayTitle(iso: string): string {
  const d = fromISODate(iso);
  return `${WEEKDAYS_LONG[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "Nov 13" */
export function fmtMonthDay(iso: string): string {
  const d = fromISODate(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "Wed" inside the last week, "Nov 4" before that. */
export function fmtDayShort(iso: string): string {
  const n = daysBetween(iso, today());
  if (n === 0) return "Today";
  if (n > 0 && n < 7) return WEEKDAYS[fromISODate(iso).getDay()];
  return fmtMonthDay(iso);
}

/** "48 min", "1h 15m" */
export function fmtMinutes(min: number): string {
  return min < 60 ? `${min} min` : fmtDuration(min);
}

/* ---------- time of day, 24h "HH:MM" ---------- */

/** "18:12" -> "6:12 PM", or "6:12" without the period. */
export function fmtTime(hhmm: string, period = true): string {
  const [h, m] = hhmm.split(":").map(Number);
  const base = `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}`;
  return period ? `${base} ${h < 12 ? "AM" : "PM"}` : base;
}

/** Clamped to the same day. */
export function addMinutes(hhmm: string, n: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = Math.max(0, Math.min(23 * 60 + 59, h * 60 + m + n));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
