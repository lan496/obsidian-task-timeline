import { App, ItemView, WorkspaceLeaf } from "obsidian";
import { groupTasksByDate } from "../timeline/groupTasksByDate";
import { hasDate, parseTasks } from "../tasks/parseTasks";
import { ParsedTask } from "../tasks/types";
import { readMarkdownDocuments } from "../tasks/readMarkdownDocuments";

export const VIEW_TYPE_TASK_TIMELINE = "task-timeline-view";

export class TaskTimelineView extends ItemView {
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
    const groupedTasks = groupTasksByDate(datedTasks);

    for (const [date, tasksOnDate] of groupedTasks) {
      this.contentEl.createEl("h3", { text: date });

      const list = this.contentEl.createEl("ul");

      for (const task of tasksOnDate) {
        const status = task.done ? "done" : "todo";
        const timeLabel = task.time === undefined ? "" : ` ${task.time}`;
        list.createEl("li", {
          text: `[${status}]${timeLabel} [${task.dateKind}]: ${task.text} (${task.path}:${task.line})`,
        });
      }
    }
  }

  async onClose(): Promise<void> {
    // Nothing to clean up yet.
  }
}
