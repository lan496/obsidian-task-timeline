import { DatedTask } from "../tasks/types";

export function groupTasksByDate(tasks: DatedTask[]): Map<string, DatedTask[]> {
  const grouped = new Map<string, DatedTask[]>();

  for (const task of tasks) {
    const existing = grouped.get(task.date);
    if (existing === undefined) {
      grouped.set(task.date, [task]);
    } else {
      existing.push(task);
    }
  }

  return grouped;
}
