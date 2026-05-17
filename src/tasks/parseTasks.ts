import { DatedTask, MarkdownDocument, ParsedTask, TaskDateKind } from "./types";

function extractTaskDate(text: string): {
  date: string;
  time?: string;
  dateKind: TaskDateKind;
} | null {
  const tasksMatch = text.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
  if (tasksMatch !== null && tasksMatch[1] !== undefined) {
    return {
      date: tasksMatch[1],
      dateKind: "tasks",
    };
  }

  const reminderMatch = text.match(
    /\(@(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?\)/
  );
  if (reminderMatch !== null && reminderMatch[1] !== undefined) {
    return {
      date: reminderMatch[1],
      time: reminderMatch[2],
      dateKind: "reminder",
    };
  }

  const kanbanMatch = text.match(/@\{(\d{4}-\d{2}-\d{2})\}/);
  if (kanbanMatch !== null && kanbanMatch[1] !== undefined) {
    return {
      date: kanbanMatch[1],
      dateKind: "kanban",
    };
  }

  return null;
}

export function parseTasks(document: MarkdownDocument): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  const lines = document.content.split("\n");
  for (const [index, line] of lines.entries()) {
    // TODO: This regex is pretty basic and may not cover all edge cases. It can be improved to handle more complex task formats.
    const match = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/);

    if (match === null) {
      continue;
    }

    const doneMarker = match[1];
    const text = match[2];
    if (doneMarker === undefined || text === undefined) {
      continue;
    }

    const done = match[1]?.toLowerCase() === "x";
    const taskDate = extractTaskDate(text);

    tasks.push({
      text,
      path: document.path,
      line: index + 1,
      done,
      ...taskDate,
    });
  }
  return tasks;
}

export function hasDate(task: ParsedTask): task is DatedTask {
  return task.date !== undefined && task.dateKind !== undefined;
}
