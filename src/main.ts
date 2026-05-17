import { Plugin } from "obsidian";
import {
  TaskTimelineView,
  VIEW_TYPE_TASK_TIMELINE,
} from "./views/TaskTimelineView";

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
