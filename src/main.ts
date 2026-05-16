import { Notice, Plugin } from "obsidian";

export default class TaskTimelinePlugin extends Plugin {
  async onload() {
    console.log("Task Timeline plugin loaded");

    this.addCommand({
      id: "show-task-timeline-notice",
      name: "Show Task Timeline Notice",
      callback: () => {
        new Notice("Task Timeline command works");
      },
    });
  }

  onunload() {
    console.log("Task Timeline plugin unloaded");
  }
}
