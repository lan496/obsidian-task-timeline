import { Plugin, TAbstractFile, TFile } from "obsidian";
import { TaskTimelineSettingsTab } from "./settings/SettingsTab";
import {
  DEFAULT_SETTINGS,
  shouldIncludePath,
  TaskTimelineSettings,
} from "./settings/types";
import { TaskStore } from "./store/TaskStore";
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

  private applyPathFilter(): void {
    const include = this.settings.includeFolders;
    const exclude = this.settings.excludeFolders;
    this.taskStore.setPathFilter((path) =>
      shouldIncludePath(path, include, exclude)
    );
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

    void this.app.workspace.revealLeaf(leaf);
  }
}
