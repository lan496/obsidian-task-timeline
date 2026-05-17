export type TaskDateKind = "tasks" | "reminder" | "kanban";

export interface MarkdownDocument {
  path: string;
  content: string;
}

export interface ParsedTask {
  text: string;
  path: string;
  line: number;
  done: boolean;
  date?: string;
  time?: string;
  dateKind?: TaskDateKind;
}

export interface DatedTask extends ParsedTask {
  date: string;
  dateKind: TaskDateKind;
}
