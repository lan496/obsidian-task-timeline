import { DEFAULT_DAY_WIDTH, ZoomLevel } from "../timeline/zoom";

export type WeekStart = "mon" | "sun";

export interface TaskTimelineSettings {
  includeFolders: string[];
  excludeFolders: string[];
  defaultZoom: ZoomLevel;
  dayWidths: Record<ZoomLevel, number>;
  weekStart: WeekStart;
  ignoreColumns: string[];
  // Maximum number of level-units to show ahead of today, per zoom.
  // Tasks whose start is past `today + maxAhead[level]` are hidden so
  // a single far-future task doesn't stretch the whole timeline.
  maxAhead: Record<ZoomLevel, number>;
}

export const DEFAULT_SETTINGS: TaskTimelineSettings = {
  includeFolders: [],
  excludeFolders: [],
  defaultZoom: "month",
  dayWidths: { ...DEFAULT_DAY_WIDTH },
  weekStart: "mon",
  ignoreColumns: ["Done"],
  maxAhead: { month: 12, quarter: 8, year: 10 },
};

export function shouldIncludePath(
  path: string,
  include: string[],
  exclude: string[]
): boolean {
  if (
    include.length > 0 &&
    !include.some((prefix) => path.startsWith(prefix))
  ) {
    return false;
  }
  if (exclude.some((prefix) => prefix.length > 0 && path.startsWith(prefix))) {
    return false;
  }
  return true;
}

export function parseFolderList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
