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

    new Setting(containerEl).setName("Kanban").setHeading();

    new Setting(containerEl)
      .setName("Ignore columns")
      .setDesc(
        "Comma-separated heading names; tasks under any of these are hidden, useful for skipping kanban-style done columns."
      )
      .addText((text) =>
        text
          .setPlaceholder("Done, archive")
          .setValue(this.host.settings.ignoreColumns.join(", "))
          .onChange(async (value) => {
            this.host.settings.ignoreColumns = parseFolderList(value);
            await this.host.saveSettings();
            this.host.onSettingsChanged();
          })
      );

    new Setting(containerEl)
      .setName("Window size per zoom")
      .setHeading();

    for (const level of ZOOM_LEVELS) {
      const unit =
        level === "month" ? "months" : level === "quarter" ? "quarters" : "years";
      new Setting(containerEl)
        .setName(capitalize(level))
        .setDesc(
          `Number of ${unit} the timeline spans, starting at the current ${level}. Earlier tasks pin to the left edge; later tasks pin to the right.`
        )
        .addText((text) =>
          text
            .setPlaceholder(String(this.host.settings.maxAhead[level]))
            .setValue(String(this.host.settings.maxAhead[level]))
            .onChange(async (value) => {
              const n = Number(value);
              if (!Number.isFinite(n) || n < 0) {
                return;
              }
              this.host.settings.maxAhead[level] = Math.floor(n);
              await this.host.saveSettings();
              this.host.onSettingsChanged();
            })
        );
    }

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
