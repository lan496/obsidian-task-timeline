import { DEFAULT_DAY_WIDTH, ZoomLevel } from "../timeline/zoom";

export type WeekStart = "mon" | "sun";

export interface TaskTimelineSettings {
  includeFolders: string[];
  excludeFolders: string[];
  defaultZoom: ZoomLevel;
  dayWidths: Record<ZoomLevel, number>;
  weekStart: WeekStart;
}

export const DEFAULT_SETTINGS: TaskTimelineSettings = {
  includeFolders: [],
  excludeFolders: [],
  defaultZoom: "month",
  dayWidths: { ...DEFAULT_DAY_WIDTH },
  weekStart: "mon",
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
