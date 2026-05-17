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

    const root = this.contentEl.createDiv({ cls: "task-timeline-root" });
    const sidebar = root.createDiv({ cls: "task-timelne-sidebar" });
    const timeline = root.createDiv({ cls: "task-timeline-main" });

    sidebar.createEl("div", {
      cls: "task-timeline-sidebar-header",
      text: "Tasks",
    });
    timeline.createEl("div", {
      cls: "task-timeline-header",
      text: "Timeline",
    });

    for (const task of datedTasks) {
      const sidebarRow = sidebar.createDiv({
        cls: "task-timeline-sidebar-row",
      });
      sidebarRow.createEl("span", { text: task.text });

      const timelineRow = timeline.createDiv({ cls: "task-timeline-row" });
      timelineRow.createEl("div", {
        cls: "task-timeline-bar",
        text: task.time === undefined ? task.date : `${task.date} ${task.time}`,
      });
    }
  }

  async onClose(): Promise<void> {
    // Nothing to clean up yet.
  }
}
