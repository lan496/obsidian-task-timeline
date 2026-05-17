import { App, Plugin, ItemView, WorkspaceLeaf } from "obsidian";

interface MarkdownDocument {
  path: string;
  content: string;
}

async function readMarkdownDocuments(app: App): Promise<MarkdownDocument[]> {
  const files = app.vault.getMarkdownFiles();

  const documents: MarkdownDocument[] = [];
  for (const file of files) {
    const content = await app.vault.cachedRead(file);
    documents.push({
      path: file.path,
      content,
    });
  }

  return documents;
}

type TaskDateKind = "tasks" | "reminder" | "kanban";

interface ParsedTask {
  text: string;
  path: string;
  line: number;
  done: boolean;
  date?: string;
  time?: string;
  dateKind?: TaskDateKind;
}

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

interface DatedTask extends ParsedTask {
  date: string;
  dateKind: TaskDateKind;
}

function hasDate(task: ParsedTask): task is DatedTask {
  return task.date !== undefined && task.dateKind !== undefined;
}

function parseTasks(document: MarkdownDocument): ParsedTask[] {
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

const VIEW_TYPE_TASK_TIMELINE = "task-timeline-view";

class TaskTimelineView extends ItemView {
  constructor(
    leaf: WorkspaceLeaf,
    private readonly appRef: App
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_TASK_TIMELINE;
  }

  getDisplayText(): string {
    return "Task Timeline";
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();

    this.contentEl.createEl("h2", { text: "Task Timeline" });

    const documents = await readMarkdownDocuments(this.appRef);
    const tasks = documents.flatMap(parseTasks);
    const datedTasks = tasks.filter(hasDate).sort((a, b) => {
      const aKey = `${a.date} ${a.time ?? ""}`;
      const bKey = `${b.date} ${b.time ?? ""}`;
      return aKey.localeCompare(bKey);
    });

    const list = this.contentEl.createEl("ul");
    for (const task of datedTasks) {
      const status = task.done ? "done" : "todo";
      const timeLabel = task.time === undefined ? "" : ` ${task.time}`;
      list.createEl("li", {
        text: `[${status}] ${task.date}${timeLabel} [${task.dateKind}]: ${task.text} (${task.path}:${task.line})`,
      });
    }
  }

  async onClose(): Promise<void> {
    // Nothing to clean up yet.
  }
}

export default class TaskTimelinePlugin extends Plugin {
  async onload() {
    console.log("Task Timeline plugin loaded");

    this.registerView(
      VIEW_TYPE_TASK_TIMELINE,
      (leaf) => new TaskTimelineView(leaf, this.app)
    );

    this.addCommand({
      id: "open-task-timeline-view",
      name: "Open Task Timeline View",
      callback: async () => {
        await this.activateView();
      },
    });
  }

  onunload() {
    console.log("Task Timeline plugin unloaded");
  }

  async activateView() {
    const leaf = this.app.workspace.getRightLeaf(false);

    if (!leaf) {
      return;
    }

    await leaf.setViewState({
      type: VIEW_TYPE_TASK_TIMELINE,
      active: true,
    });

    this.app.workspace.revealLeaf(leaf);
  }
}
