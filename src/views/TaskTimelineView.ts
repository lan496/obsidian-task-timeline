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
const DRAG_THRESHOLD_PX = 4;
const ZOOM_STEP = 1.15;
const MIN_ZOOM_FACTOR = 0.25;
const MAX_ZOOM_FACTOR = 8;

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
  private currentDayWidth = 0;
  private zoomFactor = 1;
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
    this.zoomFactor = 1;
    this.render();
    if (midpoint !== null) {
      this.scrollToDate(midpoint);
    }
  }

  private dayWidth(): number {
    return this.settingsView.settings.dayWidths[this.currentLevel];
  }

  // Stretch days to fill the visible width when the natural timeline is
  // shorter than the container, then multiply by the user's wheel-zoom
  // factor. The configured `dayWidth` acts as a lower bound for the
  // pre-zoom scale.
  private effectiveDayWidth(totalDays: number): number {
    const base = this.dayWidth();
    if (totalDays <= 0) {
      return base * this.zoomFactor;
    }
    const available = this.contentEl.clientWidth - 24;
    const stretched =
      available > 0 ? Math.max(base, available / totalDays) : base;
    return stretched * this.zoomFactor;
  }

  private timelineScroller(): HTMLElement | null {
    return this.contentEl.querySelector<HTMLElement>(".task-timeline-main");
  }

  private viewportMidpointDate(): string | null {
    if (this.currentRange === null || this.currentDayWidth <= 0) {
      return null;
    }
    const main = this.timelineScroller();
    if (main === null) {
      return null;
    }
    const midpointPx = main.scrollLeft + main.clientWidth / 2;
    const dayOffset = Math.floor(midpointPx / this.currentDayWidth);
    return addDays(this.currentRange.start, dayOffset);
  }

  private scrollToDate(date: string): void {
    if (this.currentRange === null || this.currentDayWidth <= 0) {
      return;
    }
    const main = this.timelineScroller();
    if (main === null) {
      return;
    }
    const offset = diffDays(this.currentRange.start, date);
    main.scrollLeft = offset * this.currentDayWidth - main.clientWidth / 2;
  }

  private render(): void {
    this.contentEl.empty();
    this.contentEl.addClass("task-timeline-page");
    this.contentEl.createEl("h2", { text: "Task timeline" });
    this.renderToolbar();

    const ignored = new Set(this.settingsView.settings.ignoreColumns);
    const datedTasks = this.store
      .getAll()
      .filter(hasDate)
      .filter((t) => t.column === undefined || !ignored.has(t.column))
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
    const totalDays = diffDays(start, end) + 1;
    const dayWidth = this.effectiveDayWidth(totalDays);
    this.currentDayWidth = dayWidth;
    const timelineWidth = totalDays * dayWidth;
    const header = getHeader(
      start,
      end,
      this.currentLevel,
      this.settingsView.settings.weekStart
    );

    const main = this.contentEl.createDiv({ cls: "task-timeline-main" });
    this.attachPanAndZoom(main);
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
      const tooltip = `${task.label} (${task.hostPath}:${task.hostLine})`;

      const bar = row.createEl("div", {
        cls: task.done ? "task-timeline-bar is-done" : "task-timeline-bar",
      });
      bar.style.left = `${left}px`;
      bar.style.width = `${width}px`;
      bar.title = tooltip;
      bar.addEventListener("click", () => {
        void this.openTask(task);
      });

      const label = row.createEl("div", {
        cls: task.done
          ? "task-timeline-bar-label is-done"
          : "task-timeline-bar-label",
        text: barText(task),
      });
      label.style.left = `${left + width + 4}px`;
      label.title = tooltip;
      label.addEventListener("click", () => {
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

    if (header.sub !== undefined && header.sub.length > 0) {
      const sub = headerEl.createDiv({
        cls: "task-timeline-header-row task-timeline-header-sub",
      });
      sub.style.width = `${timelineWidth}px`;
      renderTickRow(sub, header.sub, dayWidth);
    }
  }

  private attachPanAndZoom(main: HTMLElement): void {
    main.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) {
        return;
      }
      const startX = e.clientX;
      const startScroll = main.scrollLeft;
      let dragging = false;

      const move = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        if (!dragging && Math.abs(dx) > DRAG_THRESHOLD_PX) {
          dragging = true;
          main.classList.add("is-dragging");
          try {
            main.setPointerCapture(ev.pointerId);
          } catch {
            // Some environments may not allow capture; harmless.
          }
        }
        if (dragging) {
          main.scrollLeft = startScroll - dx;
          ev.preventDefault();
        }
      };

      const finish = () => {
        main.removeEventListener("pointermove", move);
        main.removeEventListener("pointerup", finish);
        main.removeEventListener("pointercancel", finish);
        if (!dragging) {
          return;
        }
        main.classList.remove("is-dragging");
        // Swallow the click that would otherwise fire on whatever bar
        // the drag passed over.
        const blockClick = (ev: Event) => {
          ev.stopPropagation();
          ev.preventDefault();
          main.removeEventListener("click", blockClick, true);
        };
        main.addEventListener("click", blockClick, true);
      };

      main.addEventListener("pointermove", move);
      main.addEventListener("pointerup", finish);
      main.addEventListener("pointercancel", finish);
    });

    main.addEventListener(
      "wheel",
      (e) => {
        if (!(e.ctrlKey || e.metaKey)) {
          return;
        }
        e.preventDefault();
        if (this.currentDayWidth <= 0) {
          return;
        }
        const rect = main.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const dateOffset =
          (cursorX + main.scrollLeft) / this.currentDayWidth;
        const factor = e.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
        const next = this.zoomFactor * factor;
        const clamped = Math.max(
          MIN_ZOOM_FACTOR,
          Math.min(MAX_ZOOM_FACTOR, next)
        );
        if (clamped === this.zoomFactor) {
          return;
        }
        this.zoomFactor = clamped;
        this.render();
        const restored = this.timelineScroller();
        if (restored !== null) {
          restored.scrollLeft =
            dateOffset * this.currentDayWidth - cursorX;
        }
      },
      { passive: false }
    );
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
    cell.style.width = `${tick.spanDays * dayWidth}px`;
  }
}

function barText(task: DatedTask): string {
  if (task.start !== undefined && task.start !== task.due) {
    return `${task.label}  ${task.start} → ${task.due}`;
  }
  return `${task.label}  ${task.due}`;
}
