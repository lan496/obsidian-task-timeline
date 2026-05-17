import { debounce, ItemView, TFile, WorkspaceLeaf } from "obsidian";
import { TaskTimelineSettings } from "../settings/types";
import { TaskStore, Unsubscribe } from "../store/TaskStore";
import { hasDate } from "../tasks/parseTasks";
import { DatedTask } from "../tasks/types";
import { addDays, diffDays, maxDate, minDate } from "../timeline/dateMath";
import {
  Header,
  Tick,
  ZoomLevel,
  ZOOM_LEVELS,
  getHeader,
} from "../timeline/zoom";

export const VIEW_TYPE_TASK_TIMELINE = "task-timeline-view";

const BAR_GAP_PX = 2;
const MIN_BAR_PX = 6;
const ROW_HEIGHT_PX = 32;

export interface SettingsView {
  settings: TaskTimelineSettings;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export class TaskTimelineView extends ItemView {
  private unsubscribe: Unsubscribe | null = null;
  private currentLevel: ZoomLevel;
  private currentRange: { start: string; end: string } | null = null;
  private readonly scheduleRender = debounce(
    () => {
      this.render();
    },
    150,
    true
  );

  constructor(
    leaf: WorkspaceLeaf,
    private readonly store: TaskStore,
    private readonly settingsView: SettingsView
  ) {
    super(leaf);
    this.currentLevel = settingsView.settings.defaultZoom;
  }

  getViewType(): string {
    return VIEW_TYPE_TASK_TIMELINE;
  }

  getDisplayText(): string {
    return "Task timeline";
  }

  async onOpen(): Promise<void> {
    this.unsubscribe = this.store.subscribe(this.scheduleRender);
    this.render();
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private setZoom(level: ZoomLevel): void {
    if (level === this.currentLevel) {
      return;
    }
    const midpoint = this.viewportMidpointDate();
    this.currentLevel = level;
    this.render();
    if (midpoint !== null) {
      this.scrollToDate(midpoint);
    }
  }

  private dayWidth(): number {
    return this.settingsView.settings.dayWidths[this.currentLevel];
  }

  private timelineScroller(): HTMLElement | null {
    return this.contentEl.querySelector<HTMLElement>(".task-timeline-main");
  }

  private viewportMidpointDate(): string | null {
    if (this.currentRange === null) {
      return null;
    }
    const main = this.timelineScroller();
    if (main === null) {
      return null;
    }
    const midpointPx = main.scrollLeft + main.clientWidth / 2;
    const dayOffset = Math.floor(midpointPx / this.dayWidth());
    return addDays(this.currentRange.start, dayOffset);
  }

  private scrollToDate(date: string): void {
    if (this.currentRange === null) {
      return;
    }
    const main = this.timelineScroller();
    if (main === null) {
      return;
    }
    const offset = diffDays(this.currentRange.start, date);
    main.scrollLeft = offset * this.dayWidth() - main.clientWidth / 2;
  }

  private render(): void {
    this.contentEl.empty();
    this.contentEl.addClass("task-timeline-page");
    this.contentEl.createEl("h2", { text: "Task timeline" });
    this.renderToolbar();

    const datedTasks = this.store
      .getAll()
      .filter(hasDate)
      .sort((a, b) => a.due.localeCompare(b.due));

    const start = minDate(datedTasks.map((t) => t.start ?? t.due));
    const end = maxDate(datedTasks.map((t) => t.due));

    if (start === null || end === null) {
      this.currentRange = null;
      this.contentEl.createEl("p", { text: "No dated tasks found." });
      return;
    }

    this.currentRange = { start, end };
    this.renderTimeline(datedTasks, start, end);
  }

  private renderToolbar(): void {
    const toolbar = this.contentEl.createDiv({ cls: "task-timeline-toolbar" });
    for (const level of ZOOM_LEVELS) {
      const btn = toolbar.createEl("button", {
        text: capitalize(level),
        cls:
          level === this.currentLevel
            ? "task-timeline-zoom-btn is-active"
            : "task-timeline-zoom-btn",
      });
      btn.addEventListener("click", () => this.setZoom(level));
    }
  }

  private renderTimeline(
    tasks: DatedTask[],
    start: string,
    end: string
  ): void {
    const dayWidth = this.dayWidth();
    const totalDays = diffDays(start, end) + 1;
    const timelineWidth = totalDays * dayWidth;
    const header = getHeader(
      start,
      end,
      this.currentLevel,
      this.settingsView.settings.weekStart
    );

    const main = this.contentEl.createDiv({ cls: "task-timeline-main" });
    this.renderHeader(main, header, dayWidth, timelineWidth);

    const body = main.createDiv({ cls: "task-timeline-body" });
    body.style.width = `${timelineWidth}px`;

    for (const task of tasks) {
      const row = body.createDiv({ cls: "task-timeline-row" });
      row.style.width = `${timelineWidth}px`;
      row.style.height = `${ROW_HEIGHT_PX}px`;

      const barStart = task.start ?? task.due;
      const offsetDays = diffDays(start, barStart);
      const durationDays = diffDays(barStart, task.due) + 1;
      const left = offsetDays * dayWidth;
      const width = Math.max(durationDays * dayWidth - BAR_GAP_PX, MIN_BAR_PX);

      const bar = row.createEl("div", {
        cls: task.done ? "task-timeline-bar is-done" : "task-timeline-bar",
        text: task.label,
      });
      bar.style.left = `${left}px`;
      bar.style.width = `${width}px`;
      bar.title = `${task.label} (${task.hostPath}:${task.hostLine})`;
      bar.addEventListener("click", () => {
        void this.openTask(task);
      });
    }
  }

  private renderHeader(
    timeline: HTMLElement,
    header: Header,
    dayWidth: number,
    timelineWidth: number
  ): void {
    const headerEl = timeline.createDiv({ cls: "task-timeline-header" });
    headerEl.style.width = `${timelineWidth}px`;

    if (header.major.length > 0) {
      const major = headerEl.createDiv({
        cls: "task-timeline-header-row task-timeline-header-major",
      });
      major.style.width = `${timelineWidth}px`;
      renderTickRow(major, header.major, dayWidth);
    }

    const minor = headerEl.createDiv({
      cls: "task-timeline-header-row task-timeline-header-minor",
    });
    minor.style.width = `${timelineWidth}px`;
    renderTickRow(minor, header.minor, dayWidth);
  }

  private async openTask(task: DatedTask): Promise<void> {
    if (task.form === "linked-page" && task.pagePath !== undefined) {
      const file = this.app.vault.getAbstractFileByPath(task.pagePath);
      if (file instanceof TFile) {
        await this.openFileAt(file, null);
        return;
      }
    }
    const host = this.app.vault.getAbstractFileByPath(task.hostPath);
    if (host instanceof TFile) {
      await this.openFileAt(host, task.hostLine);
    }
  }

  private async openFileAt(file: TFile, line: number | null): Promise<void> {
    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file);
    if (line !== null) {
      const editor = this.app.workspace.activeEditor?.editor;
      editor?.setCursor({ line: line - 1, ch: 0 });
    }
  }
}

function renderTickRow(
  rowEl: HTMLElement,
  ticks: Tick[],
  dayWidth: number
): void {
  for (const tick of ticks) {
    const cell = rowEl.createDiv({
      cls: "task-timeline-header-cell",
      text: tick.label,
    });
    cell.style.left = `${tick.offsetDays * dayWidth}px`;
    cell.style.width = `${tick.spanDays * dayWidth}px`;
  }
}
