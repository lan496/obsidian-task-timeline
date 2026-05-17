const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function parseDateOnly(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function diffDays(from: string, to: string): number {
  const fromTime = parseDateOnly(from).getTime();
  const toTime = parseDateOnly(to).getTime();
  return Math.round((toTime - fromTime) / MS_PER_DAY);
}

export function minDate(dates: string[]): string | null {
  if (dates.length === 0) {
    return null;
  }
  return [...dates].sort()[0] ?? null;
}

export function maxDate(dates: string[]): string | null {
  if (dates.length === 0) {
    return null;
  }
  return [...dates].sort().reverse()[0] ?? null;
}

export function addDays(date: string, days: number): string {
  const parsed = parseDateOnly(date);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function validateStart(
  start: string | undefined,
  due: string
): string | undefined {
  return start !== undefined && start <= due ? start : undefined;
}

export function enumerateDates(start: string, end: string): string[] {
  const days = diffDays(start, end);
  const dates: string[] = [];
  for (let offset = 0; offset <= days; offset++) {
    dates.push(addDays(start, offset));
  }
  return dates;
}
