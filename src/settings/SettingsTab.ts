import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { DEFAULT_DAY_WIDTH, ZOOM_LEVELS, ZoomLevel } from "../timeline/zoom";
import { parseFolderList, TaskTimelineSettings, WeekStart } from "./types";

export interface SettingsHost extends Plugin {
  settings: TaskTimelineSettings;
  saveSettings(): Promise<void>;
  onSettingsChanged(): void;
}

export class TaskTimelineSettingsTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly host: SettingsHost
  ) {
    super(app, host);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Include folders")
      .setDesc(
        "Comma-separated folder paths. Only files under these paths appear on the timeline. Leave empty to scan the whole vault."
      )
      .addText((text) =>
        text
          .setPlaceholder("Projects, notes/plans")
          .setValue(this.host.settings.includeFolders.join(", "))
          .onChange(async (value) => {
            this.host.settings.includeFolders = parseFolderList(value);
            await this.host.saveSettings();
            this.host.onSettingsChanged();
          })
      );

    new Setting(containerEl)
      .setName("Exclude folders")
      .setDesc("Comma-separated folder paths to skip.")
      .addText((text) =>
        text
          .setPlaceholder("Archive, templates")
          .setValue(this.host.settings.excludeFolders.join(", "))
          .onChange(async (value) => {
            this.host.settings.excludeFolders = parseFolderList(value);
            await this.host.saveSettings();
            this.host.onSettingsChanged();
          })
      );

    new Setting(containerEl)
      .setName("Default zoom")
      .setDesc("Initial axis granularity when the view is opened.")
      .addDropdown((drop) => {
        for (const level of ZOOM_LEVELS) {
          drop.addOption(level, capitalize(level));
        }
        drop
          .setValue(this.host.settings.defaultZoom)
          .onChange(async (value) => {
            this.host.settings.defaultZoom = value as ZoomLevel;
            await this.host.saveSettings();
            this.host.onSettingsChanged();
          });
      });

    new Setting(containerEl)
      .setName("Start of week")
      .setDesc("Used when laying out the week-level axis.")
      .addDropdown((drop) =>
        drop
          .addOption("mon", "Monday")
          .addOption("sun", "Sunday")
          .setValue(this.host.settings.weekStart)
          .onChange(async (value) => {
            this.host.settings.weekStart = value as WeekStart;
            await this.host.saveSettings();
            this.host.onSettingsChanged();
          })
      );

    new Setting(containerEl).setName("Day width per zoom (px)").setHeading();

    for (const level of ZOOM_LEVELS) {
      new Setting(containerEl)
        .setName(capitalize(level))
        .setDesc(`Default: ${DEFAULT_DAY_WIDTH[level]} px`)
        .addText((text) =>
          text
            .setPlaceholder(String(DEFAULT_DAY_WIDTH[level]))
            .setValue(String(this.host.settings.dayWidths[level]))
            .onChange(async (value) => {
              const n = Number(value);
              if (!Number.isFinite(n) || n <= 0) {
                return;
              }
              this.host.settings.dayWidths[level] = n;
              await this.host.saveSettings();
              this.host.onSettingsChanged();
            })
        );
    }
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
