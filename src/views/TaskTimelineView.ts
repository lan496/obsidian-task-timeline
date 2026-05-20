import { debounce, ItemView, TFile, WorkspaceLeaf } from "obsidian";
import { TaskTimelineSettings } from "../settings/types";
import { TaskStore, Unsubscribe } from "../store/TaskStore";
import { hasDate } from "../tasks/parseTasks";
import { DatedTask } from "../tasks/types";
import { addDays, diffDays } from "../timeline/dateMath";
import {
  Header,
  Tick,
  ZoomLevel,
  ZOOM_LEVELS,
  addPeriods,
  getHeader,
  startOfPeriod,
} from "../timeline/zoom";

export const VIEW_TYPE_TASK_TIMELINE = "task-timeline-view";

const BAR_GAP_PX = 2;
const MIN_BAR_PX = 6;
const DRAG_THRESHOLD_PX = 4;
const ZOOM_STEP = 1.15;
const MIN_ZOOM_FACTOR = 0.25;
const MAX_ZOOM_FACTOR = 8;
// Rough average glyph width at the bar font-size. Used only to decide
// whether a label fits inside the bar; the worst case (overestimate) is
// the label falls back to rendering outside, which is still readable.
const INLINE_LABEL_CHAR_PX = 7;
const INLINE_LABEL_PADDING_PX = 16;

export interface SettingsView {
  settings: TaskTimelineSettings;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const TODAY_POLL_MS = 60_000;

export class TaskTimelineView extends ItemView {
  private unsubscribe: Unsubscribe | null = null;
  private currentLevel: ZoomLevel;
  private currentRange: { start: string; end: string } | null = null;
  private currentDayWidth = 0;
  private zoomFactor = 1;
  private lastRenderedToday = "";
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
    this.registerInterval(
      window.setInterval(() => {
        if (todayIso() !== this.lastRenderedToday) {
          this.scheduleRender();
        }
      }, TODAY_POLL_MS)
    );
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
    this.renderToolbar();

    const ignored = new Set(this.settingsView.settings.ignoreColumns);
    const periods = Math.max(
      1,
      this.settingsView.settings.maxAhead[this.currentLevel]
    );
    const today = todayIso();
    this.lastRenderedToday = today;
    const windowStart = startOfPeriod(today, this.currentLevel);
    const windowEnd = addDays(
      addPeriods(windowStart, this.currentLevel, periods),
      -1
    );

    const datedTasks = this.store
      .getAll()
      .filter(hasDate)
      .filter((t) => !t.done)
      .filter((t) => t.column === undefined || !ignored.has(t.column))
      .sort((a, b) => {
        const aStart = a.start ?? a.due;
        const bStart = b.start ?? b.due;
        const byStart = aStart.localeCompare(bStart);
        return byStart !== 0 ? byStart : a.due.localeCompare(b.due);
      });

    if (datedTasks.length === 0) {
      this.currentRange = null;
      this.contentEl.createEl("p", { text: "No dated tasks found." });
      return;
    }

    this.currentRange = { start: windowStart, end: windowEnd };
    this.renderTimeline(datedTasks, windowStart, windowEnd);
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
    main.style.setProperty("--task-timeline-width", `${timelineWidth}px`);
    this.attachPanAndZoom(main);
    this.renderHeader(main, header, dayWidth, timelineWidth);

    const body = main.createDiv({ cls: "task-timeline-body" });

    const today = todayIso();
    if (today >= start && today <= end) {
      const marker = body.createDiv({ cls: "task-timeline-today" });
      marker.style.setProperty(
        "--task-timeline-today-left",
        `${diffDays(start, today) * dayWidth}px`
      );
    }

    for (const task of tasks) {
      const row = body.createDiv({ cls: "task-timeline-row" });

      const barStart = task.start ?? task.due;
      const barDue = task.due;

      let overflow: "past" | "future" | null = null;
      let renderStart: string;
      let renderEnd: string;
      if (barDue < start) {
        overflow = "past";
        renderStart = start;
        renderEnd = start;
      } else if (barStart > end) {
        overflow = "future";
        renderStart = end;
        renderEnd = end;
      } else {
        renderStart = barStart < start ? start : barStart;
        renderEnd = barDue > end ? end : barDue;
      }

      const offsetDays = diffDays(start, renderStart);
      const durationDays = diffDays(renderStart, renderEnd) + 1;
      const width = Math.max(durationDays * dayWidth - BAR_GAP_PX, MIN_BAR_PX);
      // Keep edge-pinned bars inside the timeline regardless of MIN_BAR_PX
      // bumping their right edge past the viewport at very low day widths.
      const rawLeft = offsetDays * dayWidth;
      const left =
        rawLeft + width > timelineWidth ? timelineWidth - width : rawLeft;
      const tooltip = `${task.label} (${task.hostPath}:${task.hostLine})`;
      const baseText = barText(task);
      const text =
        overflow === "past"
          ? `‹ ${baseText}`
          : overflow === "future"
            ? `${baseText} ›`
            : baseText;
      const inlineFits =
        overflow === null &&
        width >= text.length * INLINE_LABEL_CHAR_PX + INLINE_LABEL_PADDING_PX;

      const barClasses = ["task-timeline-bar"];
      if (task.done) barClasses.push("is-done");
      if (overflow !== null) barClasses.push(`is-overflow-${overflow}`);
      const bar = row.createEl("div", { cls: barClasses.join(" ") });
      bar.style.setProperty("--task-timeline-bar-left", `${left}px`);
      bar.style.setProperty("--task-timeline-bar-width", `${width}px`);
      if (!task.done) {
        bar.style.setProperty("--task-timeline-bar-color", barColor(task));
      }
      bar.title = tooltip;
      bar.addEventListener("click", () => {
        void this.openTask(task);
      });

      if (inlineFits) {
        bar.createSpan({
          cls: task.done
            ? "task-timeline-bar-inline-label is-done"
            : "task-timeline-bar-inline-label",
          text,
        });
      } else {
        const labelClasses = ["task-timeline-bar-label"];
        if (task.done) labelClasses.push("is-done");
        labelClasses.push(
          overflow === "future" ? "is-anchor-right" : "is-anchor-left"
        );
        const label = row.createEl("div", {
          cls: labelClasses.join(" "),
          text,
        });
        if (overflow === "future") {
          label.style.setProperty(
            "--task-timeline-label-right",
            `${timelineWidth - left + 4}px`
          );
        } else {
          label.style.setProperty(
            "--task-timeline-label-left",
            `${left + width + 4}px`
          );
        }
        label.title = tooltip;
        label.addEventListener("click", () => {
          void this.openTask(task);
        });
      }
    }
  }

  private renderHeader(
    timeline: HTMLElement,
    header: Header,
    dayWidth: number,
    _timelineWidth: number
  ): void {
    const headerEl = timeline.createDiv({ cls: "task-timeline-header" });

    if (header.major.length > 0) {
      const major = headerEl.createDiv({
        cls: "task-timeline-header-row task-timeline-header-major",
      });
      renderTickRow(major, header.major, dayWidth);
    }

    const minor = headerEl.createDiv({
      cls: "task-timeline-header-row task-timeline-header-minor",
    });
    renderTickRow(minor, header.minor, dayWidth);

    if (header.sub !== undefined && header.sub.length > 0) {
      const sub = headerEl.createDiv({
        cls: "task-timeline-header-row task-timeline-header-sub",
      });
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
    cell.style.setProperty(
      "--task-timeline-cell-width",
      `${tick.spanDays * dayWidth}px`
    );
  }
}

// Group related tasks visually: same tag / column / page / host file -> same color.
function barColor(task: DatedTask): string {
  if (task.tags !== undefined && task.tags.length > 0 && task.tags[0] !== undefined) {
    return hashColor(`tag:${task.tags[0]}`);
  }
  if (task.dueSource === "kanban" && task.column !== undefined) {
    return hashColor(task.column);
  }
  if (task.form === "linked-page" && task.pagePath !== undefined) {
    return hashColor(task.pagePath);
  }
  return hashColor(task.hostPath);
}

function hashColor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) {
    h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  }
  const hue = ((h % 360) + 360) % 360;
  return `hsl(${hue}, 55%, 42%)`;
}

function barText(task: DatedTask): string {
  const prefix =
    task.dueSource === "kanban" && task.column !== undefined
      ? `[${task.column}] `
      : "";
  if (task.start !== undefined && task.start !== task.due) {
    return `${prefix}${task.label}  ${task.start} → ${task.due}`;
  }
  return `${prefix}${task.label}  ${task.due}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
