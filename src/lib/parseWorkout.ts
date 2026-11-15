import type { Feel, WorkoutType } from "./types";
import { addDays, startOfWeek, today, weekdayIndex, fromISODate } from "./dates";

export interface ParsedWorkout {
  name: string;
  date: string;
  durationMin?: number;
  feel?: Feel;
  type?: WorkoutType;
  note: string;
  /** Which fields were actually found in the text (vs defaulted). */
  found: { duration: boolean; date: boolean; feel: boolean; type: boolean; name: boolean };
}

// ---------- number words ----------

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/** Replace spelled-out numbers ("forty-five", "an hour and a half") with digits. */
export function normalizeNumbers(input: string): string {
  let s = input.toLowerCase().replace(/[.,!?]/g, " ").replace(/\s+/g, " ").trim();
  // "forty-five" / "forty five"
  s = s.replace(
    new RegExp(`\\b(${Object.keys(TENS).join("|")})[ -](${Object.keys(ONES).join("|")})\\b`, "g"),
    (_, t, o) => String(TENS[t] + ONES[o]),
  );
  s = s.replace(new RegExp(`\\b(${Object.keys(TENS).join("|")})\\b`, "g"), (_, t) => String(TENS[t]));
  s = s.replace(new RegExp(`\\b(${Object.keys(ONES).join("|")})\\b`, "g"), (_, o) => String(ONES[o]));
  s = s.replace(/\ba hundred\b/g, "100").replace(/\b(\d+) hundred\b/g, (_, n) => String(Number(n) * 100));
  return s;
}

// ---------- duration ----------

export function parseDuration(s: string): number | undefined {
  // "1h 20", "1h20m", "1:20"
  let m = s.match(/\b(\d{1,2})\s*h(?:ours?|rs?)?\s*(?:and\s*)?(\d{1,2})\s*(?:m(?:in(?:ute)?s?)?)?\b/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = s.match(/\b(\d{1,2}):(\d{2})\b/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);

  // "an hour and a half", "1.5 hours", "hour and a half"
  if (/\b(?:an?|1|one)?\s*hour and a half\b/.test(s) || /\b1\.5\s*h(?:ours?|rs?)?\b/.test(s)) return 90;
  if (/\bhalf an hour\b|\bhalf hour\b|\b30 min/.test(s) && !/\b\d+\s*h(?:ours?|rs?)\b/.test(s)) {
    if (/\bhalf an hour\b|\bhalf hour\b/.test(s)) return 30;
  }
  // "two and a half hours"
  m = s.match(/\b(\d{1,2}) and a half hours?\b/);
  if (m) return Number(m[1]) * 60 + 30;
  // "2 hours", "2h", "2 hrs", "an hour", "1 hour"
  m = s.match(/\b(\d{1,2}(?:\.\d+)?)\s*h(?:ours?|rs?)?\b/);
  if (m) return Math.round(Number(m[1]) * 60);
  if (/\ban hour\b|\bone hour\b|\bthe hour\b/.test(s)) return 60;
  // "45 minutes", "45 min", "45m", "45-minute"
  m = s.match(/\b(\d{1,3})[ -]?(?:m|min|mins|minute|minutes)\b/);
  if (m) return Number(m[1]);
  // "a quarter hour"
  if (/\bquarter (?:of an )?hour\b/.test(s)) return 15;
  return undefined;
}

// ---------- date ----------

export function parseDate(s: string, base: string = today()): { date: string; found: boolean } {
  if (/\byesterday\b/.test(s)) return { date: addDays(base, -1), found: true };
  if (/\bday before yesterday\b/.test(s)) return { date: addDays(base, -2), found: true };
  if (/\btoday\b|\bthis (?:morning|afternoon|evening)\b|\btonight\b|\bjust now\b|\bearlier\b/.test(s)) {
    return { date: base, found: true };
  }
  const wd = s.match(/\b(?:on |last )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)\b/);
  if (wd) {
    const target = weekdayIndex(wd[1]);
    const baseDow = fromISODate(base).getDay();
    let diff = (baseDow - target + 7) % 7;
    if (diff === 0 && /\blast\b/.test(wd[0])) diff = 7;
    return { date: addDays(base, -diff), found: true };
  }
  if (/\bstart of the week\b/.test(s)) return { date: startOfWeek(base), found: true };
  return { date: base, found: false };
}

// ---------- feel ----------

const FEEL_WORDS: Array<[RegExp, Feel]> = [
  [/\b(wrecked|destroyed|dead|drained|exhausted|awful|terrible|nothing left|cooked|fried|gassed)\b/, 1],
  [/\b(heavy|rough|sluggish|tired|meh|struggled|hard going|not great|so-so|sore|slow)\b/, 2],
  [/\b(steady|fine|okay|ok|alright|normal|average|decent|solid|got it done)\b/, 3],
  [/\b(good|pretty good|nice|smooth|happy|fresh|better than expected|strong-ish)\b/, 4],
  [/\b(strong|great|amazing|unstoppable|crushed|killed it|fantastic|incredible|best|on fire|flying|excellent)\b/, 5],
];

export function parseFeel(s: string): Feel | undefined {
  // explicit numbers: "felt like a 4", "feel 3", "a 5 out of 5", "4/5"
  let m = s.match(/\b(?:felt|feel|feeling|rate|rating)\s+(?:like\s+)?(?:a|an|it)?\s*(\d)\b/);
  if (!m) m = s.match(/\b(\d)\s*(?:\/|out of)\s*5\b/);
  if (m) {
    const n = Number(m[1]);
    if (n >= 1 && n <= 5) return n as Feel;
  }
  // "felt strong", "pretty good", etc. Check 5 → 1 so "strong" beats "good" in "good and strong".
  // But "not great" is a 2 — guard negations first.
  if (/\bnot (?:great|good|strong|amazing)\b/.test(s)) return 2;
  for (const [re, f] of [...FEEL_WORDS].reverse()) {
    if (re.test(s)) return f;
  }
  return undefined;
}

// ---------- type + name ----------

const TYPE_KEYWORDS: Array<[WorkoutType, RegExp]> = [
  ["run", /\b(run|ran|running|jog|jogged|jogging|tempo|intervals?|track|5k|10k|half marathon|marathon|long run|easy run|trail)\b/],
  ["lift", /\b(lift|lifted|lifting|weights?|gym|push day|pull day|leg day|push|pull|bench|squat|squats|deadlift|deadlifts|upper body|lower body|full body|arms|chest|back day|shoulders|strength)\b/],
  ["cardio", /\b(bike|biked|biking|cycle|cycling|ride|rode|spin|swim|swam|swimming|row|rowed|rowing|elliptical|stairmaster|stairs|hiit|cardio|jump rope|skipping|hike|hiked|hiking|walk|walked|walking)\b/],
  ["mobility", /\b(yoga|stretch|stretched|stretching|mobility|pilates|foam roll|foam rolling|recovery|flow)\b/],
  ["sport", /\b(basketball|pickup|soccer|football|tennis|pickleball|padel|climbing|bouldering|boxing|sparring|volleyball|hockey|golf|badminton|squash|surf|surfing|ski|skiing|skate|skating|martial arts|jiu jitsu|bjj|muay thai|game|match)\b/],
];

export function parseType(s: string): WorkoutType | undefined {
  for (const [t, re] of TYPE_KEYWORDS) if (re.test(s)) return t;
  return undefined;
}

/** Canonical names for common phrases, so "ran" and "running" don't fragment stats. */
const NAME_RULES: Array<[RegExp, string]> = [
  [/\bstrength day\b/, "Strength day"],
  [/\bmorning run\b/, "Morning run"],
  [/\bpush day\b|\bpush\b/, "Push day"],
  [/\bpull day\b|\bpull\b/, "Pull day"],
  [/\bleg day\b/, "Leg day"],
  [/\bupper body\b/, "Upper body"],
  [/\blower body\b/, "Lower body"],
  [/\bfull body\b/, "Full body"],
  [/\bchest\b/, "Chest"],
  [/\bback day\b/, "Back day"],
  [/\bshoulders\b/, "Shoulders"],
  [/\barms\b/, "Arms"],
  [/\bbench\b/, "Bench"],
  [/\bsquats?\b/, "Squats"],
  [/\bdeadlifts?\b/, "Deadlifts"],
  [/\blong run\b/, "Long run"],
  [/\btempo\b/, "Tempo run"],
  [/\bintervals?\b/, "Intervals"],
  [/\beasy run\b|\beasy\b.*\b(run|ran|jog)\b|\b(run|ran|jog)\b.*\beasy\b/, "Easy run"],
  [/\btrail\b/, "Trail run"],
  [/\b(5k|10k|half marathon|marathon)\b/, (() => "Race")() ],
  [/\brun\b|\bran\b|\brunning\b|\bjog\b|\bjogged\b|\bjogging\b/, "Run"],
  [/\bbike\b|\bbiked\b|\bbiking\b|\bcycl(?:e|ed|ing)\b|\bride\b|\brode\b|\bspin\b/, "Bike"],
  [/\bswim\b|\bswam\b|\bswimming\b/, "Swim"],
  [/\brow\b|\browed\b|\browing\b/, "Row"],
  [/\bhike\b|\bhiked\b|\bhiking\b/, "Hike"],
  [/\bwalk\b|\bwalked\b|\bwalking\b/, "Walk"],
  [/\bhiit\b/, "HIIT"],
  [/\belliptical\b|\bstairmaster\b|\bstairs\b|\bcardio\b/, "Cardio"],
  [/\byoga\b|\bflow\b/, "Yoga"],
  [/\bpilates\b/, "Pilates"],
  [/\bstretch(?:ed|ing)?\b|\bmobility\b|\bfoam roll(?:ing)?\b|\brecovery\b/, "Mobility"],
  [/\bbasketball\b|\bpickup\b/, "Basketball"],
  [/\bsoccer\b|\bfootball\b/, "Soccer"],
  [/\btennis\b/, "Tennis"],
  [/\bpickleball\b/, "Pickleball"],
  [/\bpadel\b/, "Padel"],
  [/\bclimbing\b|\bbouldering\b/, "Climbing"],
  [/\bboxing\b|\bsparring\b/, "Boxing"],
  [/\bvolleyball\b/, "Volleyball"],
  [/\bjiu jitsu\b|\bbjj\b/, "Jiu jitsu"],
  [/\bmuay thai\b/, "Muay Thai"],
  [/\bsurf(?:ing)?\b/, "Surf"],
  [/\bski(?:ing)?\b/, "Ski"],
  [/\bgym\b|\blift(?:ed|ing)?\b|\bweights?\b|\bstrength\b/, "Lift"],
];

export function parseName(s: string): string | undefined {
  for (const [re, name] of NAME_RULES) if (re.test(s)) return name;
  return undefined;
}

// ---------- main ----------

export function parseWorkout(raw: string, base: string = today()): ParsedWorkout {
  const note = raw.trim();
  const s = normalizeNumbers(raw);
  const durationMin = parseDuration(s);
  const { date, found: dateFound } = parseDate(s, base);
  const feel = parseFeel(s);
  const type = parseType(s);
  const name = parseName(s);

  return {
    name: name ?? (type ? capitalize(type) : "Workout"),
    date,
    durationMin,
    feel,
    type,
    note,
    found: {
      duration: durationMin !== undefined,
      date: dateFound,
      feel: feel !== undefined,
      type: type !== undefined,
      name: name !== undefined,
    },
  };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
