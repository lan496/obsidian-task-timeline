import { copyFileSync, mkdirSync } from "node:fs";

const pluginDir = "dev-vault/.obsidian/plugins/obsidian-task-timeline";

mkdirSync(pluginDir, { recursive: true });

copyFileSync("manifest.json", `${pluginDir}/manifest.json`);
copyFileSync("styles.css", `${pluginDir}/styles.css`);

console.log("Copied manifest.json and styles.css to the plugin directory.");
