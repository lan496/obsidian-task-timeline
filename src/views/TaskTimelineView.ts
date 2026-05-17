import { App, ItemView, WorkspaceLeaf } from "obsidian";
import { groupTasksByDate } from "../timeline/groupTasksByDate";
import { hasDate, parseTasks } from "../tasks/parseTasks";
import { ParsedTask } from "../tasks/types";
import { readMarkdownDocuments } from "../tasks/readMarkdownDocuments";
import {
  diffDays,
  maxDate,
  minDate,
  enumerateDates,
} from "../timeline/dateMath";

export const VIEW_TYPE_TASK_TIMELINE = "task-timeline-view";

const DAY_WIDTH_PX = 96;

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
    const datedTasks = tasks
      .filter(hasDate)
      .sort((a, b) => a.date.localeCompare(b.date));

    const timelineStart = minDate(datedTasks.map((task) => task.date));
    const timelineEnd = maxDate(datedTasks.map((task) => task.date));

    if (timelineStart === null || timelineEnd === null) {
      this.contentEl.createEl("p", { text: "No dated tasks found." });
      return;
    }

    const totalDays = diffDays(timelineStart, timelineEnd) + 1;
    const timelineWidth = totalDays * DAY_WIDTH_PX;

    const root = this.contentEl.createDiv({ cls: "task-timeline-root" });
    const sidebar = root.createDiv({ cls: "task-timelne-sidebar" });
    const timeline = root.createDiv({ cls: "task-timeline-main" });

    sidebar.createEl("div", {
      cls: "task-timeline-sidebar-header",
      text: "Tasks",
    });

    const timelineHeader = timeline.createDiv({
      cls: "task-timeline-header",
    });
    timelineHeader.style.width = `${timelineWidth}px`;
    for (const date of enumerateDates(timelineStart, timelineEnd)) {
      const cell = timelineHeader.createDiv({
        cls: "task-timeline-header-cell",
        text: date,
      });
      cell.style.width = `${DAY_WIDTH_PX}px`;
    }

    for (const task of datedTasks) {
      const sidebarRow = sidebar.createDiv({
        cls: "task-timeline-sidebar-row",
      });
      sidebarRow.createEl("span", { text: task.text });

      const timelineRow = timeline.createDiv({ cls: "task-timeline-row" });
      timelineRow.style.width = `${timelineWidth}px`;

      const offsetDays = diffDays(timelineStart, task.date);
      const left = offsetDays * DAY_WIDTH_PX;

      const bar = timelineRow.createEl("div", {
        cls: "task-timeline-bar",
        text: task.text,
      });
      bar.style.left = `${left}px`;
      bar.style.width = `${DAY_WIDTH_PX * 0.8}px`;
    }
  }

  async onClose(): Promise<void> {
    // Nothing to clean up yet.
  }
}
