import { validateStart } from "../timeline/dateMath";
import { ParsedTask } from "./types";

export interface ResolvedPage {
  path: string;
  properties: Record<string, unknown>;
}

export interface PageProvider {
  resolve(linkText: string, hostPath: string): ResolvedPage | null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function readDateProperty(
  properties: Record<string, unknown>,
  key: string
): string | undefined {
  const value = properties[key];
  if (typeof value === "string" && ISO_DATE.test(value)) {
    return value;
  }
  return undefined;
}

export function resolveLinkedPages(
  tasks: ParsedTask[],
  pages: PageProvider
): ParsedTask[] {
  return tasks.map((task) => {
    if (task.form !== "linked-page" || task.pagePath === undefined) {
      return task;
    }
    const resolved = pages.resolve(task.pagePath, task.hostPath);
    if (resolved === null) {
      return { ...task, pagePath: undefined };
    }
    const due = readDateProperty(resolved.properties, "due");
    const start = readDateProperty(resolved.properties, "start");
    const validStart =
      due !== undefined ? validateStart(start, due) : undefined;
    return {
      ...task,
      pagePath: resolved.path,
      ...(due !== undefined
        ? { due, dueSource: "page-property" as const }
        : {}),
      ...(validStart !== undefined ? { start: validStart } : {}),
    };
  });
}
