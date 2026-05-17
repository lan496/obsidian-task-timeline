import { Plugin, TAbstractFile, TFile } from "obsidian";
import { TaskTimelineSettingsTab } from "./settings/SettingsTab";
import {
  DEFAULT_SETTINGS,
  shouldIncludePath,
  TaskTimelineSettings,
} from "./settings/types";
import { TaskStore } from "./store/TaskStore";
import {
  DEFAULT_DAY_WIDTH,
  ZOOM_LEVELS,
  ZoomLevel,
} from "./timeline/zoom";
import {
  TaskTimelineView,
  VIEW_TYPE_TASK_TIMELINE,
} from "./views/TaskTimelineView";

export default class TaskTimelinePlugin extends Plugin {
  settings!: TaskTimelineSettings;
  private taskStore!: TaskStore;

  async onload() {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...((await this.loadData()) as Partial<TaskTimelineSettings> | null),
    };
    this.migrateLegacySettings();
    this.taskStore = new TaskStore(this.app);
    this.applyPathFilter();

    this.registerView(
      VIEW_TYPE_TASK_TIMELINE,
      (leaf) => new TaskTimelineView(leaf, this.taskStore, this)
    );

    this.addCommand({
      id: "open-task-timeline-view",
      name: "Open view",
      callback: async () => {
        await this.activateView();
      },
    });

    this.addSettingTab(new TaskTimelineSettingsTab(this.app, this));

    this.app.workspace.onLayoutReady(() => {
      void this.taskStore.initialize();
    });

    this.registerEvent(
      this.app.vault.on("modify", (file: TAbstractFile) => {
        if (file instanceof TFile) {
          void this.taskStore.onFileModified(file);
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("create", (file: TAbstractFile) => {
        if (file instanceof TFile) {
          void this.taskStore.onFileCreated(file);
        }
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", (file: TAbstractFile) => {
        void this.taskStore.onFileDeleted(file);
      })
    );
    this.registerEvent(
      this.app.vault.on(
        "rename",
        (file: TAbstractFile, oldPath: string) => {
          if (file instanceof TFile) {
            void this.taskStore.onFileRenamed(file, oldPath);
          }
        }
      )
    );
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  onSettingsChanged(): void {
    this.applyPathFilter();
    void this.taskStore.initialize();
  }

  // Earlier builds supported "day" / "week" zoom levels. Coerce any
  // persisted value that's no longer in `ZOOM_LEVELS` to a sensible
  // default and trim stale per-level day-width overrides.
  private migrateLegacySettings(): void {
    const validLevels = new Set<string>(ZOOM_LEVELS);
    if (!validLevels.has(this.settings.defaultZoom)) {
      this.settings.defaultZoom = DEFAULT_SETTINGS.defaultZoom;
    }
    const widths: Record<string, number> = {};
    for (const level of ZOOM_LEVELS) {
      const value =
        (this.settings.dayWidths as Record<string, number | undefined>)[
          level
        ] ?? DEFAULT_DAY_WIDTH[level];
      widths[level] = value;
    }
    this.settings.dayWidths = widths as Record<ZoomLevel, number>;
  }

  private applyPathFilter(): void {
    const include = this.settings.includeFolders;
    const exclude = this.settings.excludeFolders;
    this.taskStore.setPathFilter((path) =>
      shouldIncludePath(path, include, exclude)
    );
  }

  async activateView() {
    const existing = this.app.workspace.getLeavesOfType(
      VIEW_TYPE_TASK_TIMELINE
    );
    const leaf =
      existing.length > 0 ? existing[0]! : this.app.workspace.getLeaf("tab");

    await leaf.setViewState({
      type: VIEW_TYPE_TASK_TIMELINE,
      active: true,
    });

    void this.app.workspace.revealLeaf(leaf);
  }
}
