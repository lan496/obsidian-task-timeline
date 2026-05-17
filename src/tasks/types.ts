export type TaskForm = "inline" | "linked-page";

export type DueDateSource =
  | "page-property"
  | "reminder"
  | "tasks"
  | "kanban";

export interface MarkdownDocument {
  path: string;
  content: string;
}

export interface ParsedTask {
  form: TaskForm;
  label: string;
  hostPath: string;
  hostLine: number;
  pagePath?: string;
  // Most recent markdown heading (any level) above the checkbox.
  // Used to filter out tasks under columns like "Done" in kanban-style
  // notes.
  column?: string;
  done: boolean;
  due?: string;
  start?: string;
  dueSource?: DueDateSource;
}

export interface DatedTask extends ParsedTask {
  due: string;
  dueSource: DueDateSource;
}
