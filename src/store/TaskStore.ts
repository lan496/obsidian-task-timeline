import { App, TAbstractFile, TFile } from "obsidian";
import { parseTasks } from "../tasks/parseTasks";
import { makeObsidianPageProvider } from "../tasks/obsidianPageProvider";
import { PageProvider, resolveLinkedPages } from "../tasks/resolveLinkedPages";
import { ParsedTask } from "../tasks/types";

export type Unsubscribe = () => void;
export type PathFilter = (path: string) => boolean;

export class TaskStore {
  private tasksByHost = new Map<string, ParsedTask[]>();
  private hostsByPage = new Map<string, Set<string>>();
  private listeners = new Set<() => void>();
  private readonly pageProvider: PageProvider;
  private pathFilter: PathFilter = () => true;

  constructor(private readonly app: App) {
    this.pageProvider = makeObsidianPageProvider(app);
  }

  setPathFilter(filter: PathFilter): void {
    this.pathFilter = filter;
  }

  async initialize(): Promise<void> {
    this.tasksByHost.clear();
    this.hostsByPage.clear();
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (!this.pathFilter(file.path)) {
        continue;
      }
      await this.parseFile(file);
    }
    this.notify();
  }

  subscribe(listener: () => void): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getAll(): ParsedTask[] {
    const out: ParsedTask[] = [];
    for (const list of this.tasksByHost.values()) {
      for (const task of list) {
        out.push(task);
      }
    }
    return out;
  }

  async onFileModified(file: TFile): Promise<void> {
    let changed = false;
    if (this.tasksByHost.has(file.path)) {
      if (!this.pathFilter(file.path)) {
        if (this.dropHost(file.path)) {
          changed = true;
        }
      } else {
        await this.parseFile(file);
        changed = true;
      }
    } else if (this.pathFilter(file.path)) {
      await this.parseFile(file);
      if (this.tasksByHost.has(file.path)) {
        changed = true;
      }
    }
    const hosts = this.hostsByPage.get(file.path);
    if (hosts !== undefined && hosts.size > 0) {
      for (const hostPath of hosts) {
        const hostFile = this.app.vault.getAbstractFileByPath(hostPath);
        if (hostFile instanceof TFile) {
          await this.parseFile(hostFile);
          changed = true;
        }
      }
    }
    if (changed) {
      this.notify();
    }
  }

  async onFileCreated(file: TFile): Promise<void> {
    if (file.extension !== "md") {
      return;
    }
    if (!this.pathFilter(file.path)) {
      return;
    }
    await this.parseFile(file);
    this.notify();
  }

  onFileDeleted(file: TAbstractFile): void {
    if (!(file instanceof TFile) || file.extension !== "md") {
      return;
    }
    if (this.dropHost(file.path)) {
      this.notify();
    }
  }

  async onFileRenamed(file: TFile, oldPath: string): Promise<void> {
    if (file.extension !== "md") {
      return;
    }
    this.dropHost(oldPath);
    this.hostsByPage.delete(oldPath);
    await this.parseFile(file);
    this.notify();
  }

  private async parseFile(file: TFile): Promise<void> {
    const content = await this.app.vault.cachedRead(file);
    const raw = parseTasks({ path: file.path, content });
    const resolved = resolveLinkedPages(raw, this.pageProvider);
    this.dropHost(file.path);
    if (resolved.length > 0) {
      this.tasksByHost.set(file.path, resolved);
      for (const task of resolved) {
        if (task.pagePath === undefined) {
          continue;
        }
        let set = this.hostsByPage.get(task.pagePath);
        if (set === undefined) {
          set = new Set();
          this.hostsByPage.set(task.pagePath, set);
        }
        set.add(file.path);
      }
    }
  }

  private dropHost(hostPath: string): boolean {
    const existing = this.tasksByHost.get(hostPath);
    if (existing === undefined) {
      return false;
    }
    this.tasksByHost.delete(hostPath);
    for (const task of existing) {
      if (task.pagePath === undefined) {
        continue;
      }
      const hosts = this.hostsByPage.get(task.pagePath);
      if (hosts === undefined) {
        continue;
      }
      hosts.delete(hostPath);
      if (hosts.size === 0) {
        this.hostsByPage.delete(task.pagePath);
      }
    }
    return true;
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
