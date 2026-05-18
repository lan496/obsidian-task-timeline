import { validateStart } from "../timeline/dateMath";
import {
  DatedTask,
  DueDateSource,
  MarkdownDocument,
  ParsedTask,
} from "./types";

const TASK_LINE = /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/;
const SINGLE_WIKILINK_BODY = /^\s*\[\[([^\]|]+)(?:\|([^\]]+))?\]\]\s*$/;
const HEADING_LINE = /^#+\s+(.+)$/;
// Obsidian-style tag: `#` preceded by start-of-string or whitespace, then
// at least one letter so pure-numeric `#2025` is not picked up. Allows
// nested tags via `/`.
const TAG_PATTERN = /(?:^|\s)#([A-Za-z][\w/-]*)/g;

interface DueMatch {
  due: string;
  start?: string;
  dueSource: DueDateSource;
  span: { start: number; end: number };
}

// Loose ISO-ish date: year is always 4 digits, month/day may omit the
// leading zero, day is optional. `2026-4`, `2026-4-1`, and `2026-04-01`
// all match.
const DATE = "\\d{4}-\\d{1,2}(?:-\\d{1,2})?";
// Reminder syntax allows an optional `HH:mm` after each date. The plugin
// only renders at day resolution so the time component is matched and
// discarded — but without this the closing `)` no longer follows the
// date and the whole marker stops matching.
const TIME_OPT = "(?:\\s+\\d{1,2}:\\d{2})?";
const REMINDER_DATE = `(${DATE})${TIME_OPT}`;
const REMINDER_RANGE = `${REMINDER_DATE}(?:\\s+-\\s+${REMINDER_DATE})?`;
const PLAIN_RANGE = `(${DATE})(?:\\s+-\\s+(${DATE}))?`;
// Two separate `@{date}` markers joined by ` - `. The single-marker
// kanban pattern below would otherwise greedily match only the first
// `@{date}` and drop the end of the range.
const KANBAN_TWIN = `@\\{(${DATE})\\}\\s+-\\s+@\\{(${DATE})\\}`;

const DATE_MARKERS: ReadonlyArray<{
  source: DueDateSource;
  pattern: RegExp;
}> = [
  { source: "reminder", pattern: new RegExp(`\\(@${REMINDER_RANGE}\\)`) },
  { source: "tasks", pattern: new RegExp(`\\u{1F4C5}\\s*${PLAIN_RANGE}`, "u") },
  { source: "kanban", pattern: new RegExp(KANBAN_TWIN) },
  { source: "kanban", pattern: new RegExp(`@\\{${PLAIN_RANGE}\\}`) },
];

interface LooseDate {
  start: string;
  end: string;
  exact: boolean;
}

function parseLooseDate(raw: string): LooseDate | null {
  const m = raw.match(/^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?$/);
  if (m === null) {
    return null;
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) {
    return null;
  }
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (m[3] !== undefined) {
    const day = Number(m[3]);
    if (day < 1 || day > lastDay) {
      return null;
    }
    const iso = `${m[1]}-${mm}-${String(day).padStart(2, "0")}`;
    return { start: iso, end: iso, exact: true };
  }
  return {
    start: `${m[1]}-${mm}-01`,
    end: `${m[1]}-${mm}-${String(lastDay).padStart(2, "0")}`,
    exact: false,
  };
}

function findDueMatch(text: string): DueMatch | null {
  for (const { source, pattern } of DATE_MARKERS) {
    const match = text.match(pattern);
    if (
      match === null ||
      match.index === undefined ||
      match[1] === undefined
    ) {
      continue;
    }
    const first = parseLooseDate(match[1]);
    if (first === null) {
      continue;
    }
    const secondRaw = match[2];
    let due: string;
    let start: string | undefined;
    if (secondRaw !== undefined) {
      const second = parseLooseDate(secondRaw);
      if (second === null) {
        continue;
      }
      start = first.start;
      due = second.end;
    } else if (first.exact) {
      due = first.start;
    } else {
      start = first.start;
      due = first.end;
    }
    return {
      due,
      ...(start !== undefined ? { start } : {}),
      dueSource: source,
      span: { start: match.index, end: match.index + match[0].length },
    };
  }
  return null;
}

function stripSpan(text: string, span: { start: number; end: number }): string {
  return (text.slice(0, span.start) + text.slice(span.end))
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractTags(text: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const m of text.matchAll(TAG_PATTERN)) {
    const tag = m[1];
    if (tag === undefined || seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

export function parseTasks(document: MarkdownDocument): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  const lines = document.content.split("\n");
  let currentColumn: string | undefined = undefined;
  for (const [index, line] of lines.entries()) {
    const headingMatch = line.match(HEADING_LINE);
    if (headingMatch !== null && headingMatch[1] !== undefined) {
      currentColumn = headingMatch[1].trim();
      continue;
    }

    const match = line.match(TASK_LINE);
    if (match === null) {
      continue;
    }

    const doneMarker = match[1];
    const body = match[2];
    if (doneMarker === undefined || body === undefined) {
      continue;
    }

    const done = doneMarker.toLowerCase() === "x";
    const linkMatch = body.match(SINGLE_WIKILINK_BODY);
    const columnField =
      currentColumn !== undefined ? { column: currentColumn } : {};

    if (linkMatch !== null && linkMatch[1] !== undefined) {
      const target = linkMatch[1].trim();
      const alias = linkMatch[2]?.trim();
      tasks.push({
        form: "linked-page",
        label: alias ?? target,
        hostPath: document.path,
        hostLine: index + 1,
        pagePath: target,
        done,
        ...columnField,
      });
      continue;
    }

    const dueMatch = findDueMatch(body);
    const label =
      dueMatch === null ? body.trim() : stripSpan(body, dueMatch.span);
    const tags = extractTags(body);

    const validStart =
      dueMatch !== null ? validateStart(dueMatch.start, dueMatch.due) : undefined;
    const range = validStart !== undefined ? { start: validStart } : {};

    tasks.push({
      form: "inline",
      label,
      hostPath: document.path,
      hostLine: index + 1,
      done,
      ...(dueMatch !== null
        ? { due: dueMatch.due, dueSource: dueMatch.dueSource }
        : {}),
      ...range,
      ...columnField,
      ...(tags.length > 0 ? { tags } : {}),
    });
  }
  return tasks;
}

export function hasDate(task: ParsedTask): task is DatedTask {
  return task.due !== undefined && task.dueSource !== undefined;
}
