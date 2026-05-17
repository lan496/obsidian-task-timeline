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

interface DueMatch {
  due: string;
  start?: string;
  dueSource: DueDateSource;
  span: { start: number; end: number };
}

const DATE = "\\d{4}-\\d{2}-\\d{2}";
// Reminder syntax allows an optional `HH:mm` after each date. The plugin
// only renders at day resolution so the time component is matched and
// discarded — but without this the closing `)` no longer follows the
// date and the whole marker stops matching.
const TIME_OPT = "(?:\\s+\\d{1,2}:\\d{2})?";
const REMINDER_DATE = `(${DATE})${TIME_OPT}`;
const REMINDER_RANGE = `${REMINDER_DATE}(?:\\s+-\\s+${REMINDER_DATE})?`;
const PLAIN_RANGE = `(${DATE})(?:\\s+-\\s+(${DATE}))?`;

const DATE_MARKERS: ReadonlyArray<{
  source: DueDateSource;
  pattern: RegExp;
}> = [
  { source: "reminder", pattern: new RegExp(`\\(@${REMINDER_RANGE}\\)`) },
  { source: "tasks", pattern: new RegExp(`\\u{1F4C5}\\s*${PLAIN_RANGE}`, "u") },
  { source: "kanban", pattern: new RegExp(`@\\{${PLAIN_RANGE}\\}`) },
];

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
    const first = match[1];
    const second = match[2];
    const isRange = second !== undefined;
    return {
      due: isRange ? second : first,
      ...(isRange ? { start: first } : {}),
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
    });
  }
  return tasks;
}

export function hasDate(task: ParsedTask): task is DatedTask {
  return task.due !== undefined && task.dueSource !== undefined;
}
