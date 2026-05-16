import { Notice, Plugin, ItemView, WorkspaceLeaf } from "obsidian";

const VIEW_TYPE_TASK_TIMELINE = "task-timeline-view";

class TaskTimelineView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
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
    this.contentEl.createEl("p", { text: "Timeline view is working." });
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
      (leaf) => new TaskTimelineView(leaf)
    );

    this.addCommand({
      id: "open-task-timeline-view",
      name: "Open Task Timeline View",
      callback: async () => {
        // TODO:
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
      new Notice("Could not open Task Timeline view");
      return;
    }

    await leaf.setViewState({
      type: VIEW_TYPE_TASK_TIMELINE,
      active: true,
    });

    this.app.workspace.revealLeaf(leaf);
  }
}
