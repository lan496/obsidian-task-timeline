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
  done: boolean;
  due?: string;
  start?: string;
  dueSource?: DueDateSource;
}

export interface DatedTask extends ParsedTask {
  due: string;
  dueSource: DueDateSource;
}
