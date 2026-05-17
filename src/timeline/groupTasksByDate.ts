import { DatedTask } from "../tasks/types";

export function groupTasksByDate(tasks: DatedTask[]): Map<string, DatedTask[]> {
  const grouped = new Map<string, DatedTask[]>();

  for (const task of tasks) {
    const existing = grouped.get(task.due);
    if (existing === undefined) {
      grouped.set(task.due, [task]);
    } else {
      existing.push(task);
    }
  }

  return grouped;
}
