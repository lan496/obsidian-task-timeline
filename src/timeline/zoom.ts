import { addDays, diffDays, parseDateOnly } from "./dateMath";

export type ZoomLevel = "month" | "quarter" | "year";
export type WeekStart = "mon" | "sun";

export const ZOOM_LEVELS: readonly ZoomLevel[] = ["month", "quarter", "year"];

export const DEFAULT_DAY_WIDTH: Record<ZoomLevel, number> = {
  month: 6,
  quarter: 2,
  year: 1,
};

export interface Tick {
  offsetDays: number;
  spanDays: number;
  label: string;
}

export interface Header {
  major: Tick[];
  minor: Tick[];
  // Optional finer ticks shown beneath the minor row at higher zoom
  // levels so the user can still see week / month / quarter boundaries
  // when zoomed out.
  sub?: Tick[];
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function toIso(d: Date): string {
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    String(d.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function startOfMonth(iso: string): string {
  return iso.slice(0, 7) + "-01";
}

function startOfYear(iso: string): string {
  return iso.slice(0, 4) + "-01-01";
}

function startOfQuarter(iso: string): string {
  const month = Number(iso.slice(5, 7));
  const qStart = month - ((month - 1) % 3);
  return `${iso.slice(0, 4)}-${String(qStart).padStart(2, "0")}-01`;
}

function startOfDecade(iso: string): string {
  const year = Number(iso.slice(0, 4));
  return `${year - (year % 10)}-01-01`;
}

function startOfWeek(iso: string, weekStart: WeekStart): string {
  const d = parseDateOnly(iso);
  const day = d.getUTCDay();
  const offset = weekStart === "mon" ? (day === 0 ? -6 : 1 - day) : -day;
  return addDays(iso, offset);
}

function addMonths(iso: string, n: number): string {
  const d = parseDateOnly(iso);
  d.setUTCMonth(d.getUTCMonth() + n, 1);
  return toIso(d);
}

function addYears(iso: string, n: number): string {
  const d = parseDateOnly(iso);
  d.setUTCFullYear(d.getUTCFullYear() + n, 0, 1);
  return toIso(d);
}

function clip(
  candidateStart: string,
  candidateEnd: string,
  start: string,
  end: string
): { offsetDays: number; spanDays: number } | null {
  const lower = candidateStart < start ? start : candidateStart;
  const upper = candidateEnd > end ? end : candidateEnd;
  if (lower > upper) {
    return null;
  }
  return {
    offsetDays: diffDays(start, lower),
    spanDays: diffDays(lower, upper) + 1,
  };
}

function buildTicks(
  start: string,
  end: string,
  firstStart: string,
  next: (iso: string) => string,
  label: (iso: string) => string
): Tick[] {
  const ticks: Tick[] = [];
  let cursor = firstStart;
  while (cursor <= end) {
    const nextCursor = next(cursor);
    const tickEnd = addDays(nextCursor, -1);
    const clipped = clip(cursor, tickEnd, start, end);
    if (clipped !== null) {
      ticks.push({ ...clipped, label: label(cursor) });
    }
    cursor = nextCursor;
  }
  return ticks;
}

function yearLabel(iso: string): string {
  return iso.slice(0, 4);
}

function decadeLabel(iso: string): string {
  return `${iso.slice(0, 3)}0s`;
}

function weekMinor(iso: string): string {
  return iso.slice(5);
}

function monthMinor(iso: string): string {
  return MONTH_LABELS[Number(iso.slice(5, 7)) - 1]!;
}

function quarterMinor(iso: string): string {
  const month = Number(iso.slice(5, 7));
  return `Q${Math.floor((month - 1) / 3) + 1}`;
}

function yearTicks(start: string, end: string): Tick[] {
  return buildTicks(
    start,
    end,
    startOfYear(start),
    (iso) => addYears(iso, 1),
    yearLabel
  );
}

function decadeTicks(start: string, end: string): Tick[] {
  return buildTicks(
    start,
    end,
    startOfDecade(start),
    (iso) => addYears(iso, 10),
    decadeLabel
  );
}

function weekTicks(
  start: string,
  end: string,
  weekStart: WeekStart
): Tick[] {
  return buildTicks(
    start,
    end,
    startOfWeek(start, weekStart),
    (iso) => addDays(iso, 7),
    weekMinor
  );
}

function monthMinorTicks(start: string, end: string): Tick[] {
  return buildTicks(
    start,
    end,
    startOfMonth(start),
    (iso) => addMonths(iso, 1),
    monthMinor
  );
}

function quarterShortTicks(start: string, end: string): Tick[] {
  return buildTicks(
    start,
    end,
    startOfQuarter(start),
    (iso) => addMonths(iso, 3),
    quarterMinor
  );
}

export function startOfPeriod(iso: string, level: ZoomLevel): string {
  if (level === "month") return startOfMonth(iso);
  if (level === "quarter") return startOfQuarter(iso);
  return startOfYear(iso);
}

export function addPeriods(iso: string, level: ZoomLevel, n: number): string {
  if (level === "month") return addMonths(iso, n);
  if (level === "quarter") return addMonths(iso, n * 3);
  return addYears(iso, n);
}

export function getHeader(
  start: string,
  end: string,
  level: ZoomLevel,
  weekStart: WeekStart = "mon"
): Header {
  switch (level) {
    case "month":
      return {
        major: yearTicks(start, end),
        minor: monthMinorTicks(start, end),
        sub: weekTicks(start, end, weekStart),
      };
    case "quarter":
      return {
        major: yearTicks(start, end),
        minor: quarterShortTicks(start, end),
        sub: monthMinorTicks(start, end),
      };
    case "year":
      return {
        major: decadeTicks(start, end),
        minor: yearTicks(start, end),
        sub: quarterShortTicks(start, end),
      };
  }
}
