#!/usr/bin/env node
// Download a Task Timeline release from GitHub and drop the plugin
// files into a vault. Usage:
//
//   node scripts/install-release.mjs --vault <path> [--version <tag>]
//   node scripts/install-release.mjs --to <plugin-dir> [--version <tag>]
//
// With --vault, the script writes to
// `<vault>/.obsidian/plugins/obsidian-task-timeline/`. With --to, it
// writes to the given directory verbatim. Version defaults to the
// repository's latest GitHub release.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = "lan496/obsidian-task-timeline";
const PLUGIN_ID = "obsidian-task-timeline";
const ASSETS = ["main.js", "manifest.json", "styles.css"];

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const targetDir = resolveTargetDir(args);
const tag = await resolveTag(args.version);

console.log(`Installing ${REPO}@${tag} into ${targetDir}`);
mkdirSync(targetDir, { recursive: true });

for (const asset of ASSETS) {
  const url = `https://github.com/${REPO}/releases/download/${tag}/${asset}`;
  const bytes = await download(url);
  writeFileSync(`${targetDir}/${asset}`, bytes);
  console.log(`  ${asset} (${bytes.byteLength} bytes)`);
}

console.log("Done. Enable the plugin in Obsidian (Settings -> Community plugins).");

function parseArgs(argv) {
  const out = { vault: undefined, to: undefined, version: undefined, help: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      out.help = true;
    } else if (arg === "--vault") {
      out.vault = argv[++i];
    } else if (arg === "--to") {
      out.to = argv[++i];
    } else if (arg === "--version") {
      out.version = argv[++i];
    } else {
      die(`Unknown argument: ${arg}`);
    }
  }
  return out;
}

function resolveTargetDir(args) {
  if (args.to !== undefined && args.vault !== undefined) {
    die("Pass either --vault or --to, not both.");
  }
  if (args.to !== undefined) {
    return resolve(args.to);
  }
  if (args.vault !== undefined) {
    return resolve(args.vault, ".obsidian", "plugins", PLUGIN_ID);
  }
  die("Missing required argument: --vault <path> or --to <plugin-dir>");
}

async function resolveTag(version) {
  if (version !== undefined && version !== "latest") {
    return version;
  }
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/releases/latest`,
    { headers: { Accept: "application/vnd.github+json" } }
  );
  if (!res.ok) {
    die(`Failed to look up latest release: ${res.status} ${res.statusText}`);
  }
  const body = await res.json();
  if (typeof body.tag_name !== "string") {
    die("GitHub API response did not include a tag_name.");
  }
  return body.tag_name;
}

async function download(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    die(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

function printHelp() {
  console.log(
    [
      "Usage: node scripts/install-release.mjs [options]",
      "",
      "Options:",
      "  --vault <path>     Vault root; installs to <vault>/.obsidian/plugins/" + PLUGIN_ID,
      "  --to <plugin-dir>  Write asset files directly to this directory",
      "  --version <tag>    Release tag to install (default: latest)",
      "  -h, --help         Show this help",
    ].join("\n")
  );
}

function die(message) {
  console.error(message);
  process.exit(1);
}
