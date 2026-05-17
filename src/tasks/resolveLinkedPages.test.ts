import { describe, expect, it } from "vitest";
import {
  PageProvider,
  ResolvedPage,
  resolveLinkedPages,
} from "./resolveLinkedPages";
import { ParsedTask } from "./types";

function staticProvider(
  pages: Record<string, ResolvedPage>
): PageProvider {
  return {
    resolve(linkText) {
      return pages[linkText] ?? null;
    },
  };
}

function linked(pagePath: string): ParsedTask {
  return {
    form: "linked-page",
    label: pagePath,
    hostPath: "Board.md",
    hostLine: 1,
    pagePath,
    done: false,
  };
}

describe("resolveLinkedPages", () => {
  it("fills due from page properties", () => {
    const provider = staticProvider({
      "Plan launch": {
        path: "Notes/Plan launch.md",
        properties: { due: "2025-05-20" },
      },
    });
    const [task] = resolveLinkedPages([linked("Plan launch")], provider);
    expect(task).toMatchObject({
      form: "linked-page",
      pagePath: "Notes/Plan launch.md",
      due: "2025-05-20",
      dueSource: "page-property",
    });
  });

  it("leaves due undefined when the linked page has no `due` property", () => {
    const provider = staticProvider({
      "Plan launch": {
        path: "Notes/Plan launch.md",
        properties: {},
      },
    });
    const [task] = resolveLinkedPages([linked("Plan launch")], provider);
    expect(task!.pagePath).toBe("Notes/Plan launch.md");
    expect(task!.due).toBeUndefined();
    expect(task!.dueSource).toBeUndefined();
  });

  it("ignores non-ISO date values in the `due` property", () => {
    const provider = staticProvider({
      "Plan launch": {
        path: "Plan launch.md",
        properties: { due: "next Friday" },
      },
    });
    const [task] = resolveLinkedPages([linked("Plan launch")], provider);
    expect(task!.due).toBeUndefined();
  });

  it("preserves the raw link text when the link cannot be resolved", () => {
    const provider = staticProvider({});
    const [task] = resolveLinkedPages([linked("Missing")], provider);
    // pagePath stays as the raw link so the reverse index in TaskStore
    // still has a key to find this task once the target page is created.
    expect(task!.pagePath).toBe("Missing");
    expect(task!.due).toBeUndefined();
    expect(task!.dueSource).toBeUndefined();
  });

  it("reads start when both start and due are valid ISO dates", () => {
    const provider = staticProvider({
      "Plan launch": {
        path: "Plan launch.md",
        properties: { due: "2025-05-20", start: "2025-05-15" },
      },
    });
    const [task] = resolveLinkedPages([linked("Plan launch")], provider);
    expect(task!.start).toBe("2025-05-15");
    expect(task!.due).toBe("2025-05-20");
  });

  it("drops start when start > due", () => {
    const provider = staticProvider({
      "Plan launch": {
        path: "Plan launch.md",
        properties: { due: "2025-05-15", start: "2025-05-20" },
      },
    });
    const [task] = resolveLinkedPages([linked("Plan launch")], provider);
    expect(task!.start).toBeUndefined();
    expect(task!.due).toBe("2025-05-15");
  });

  it("ignores start when due is missing", () => {
    const provider = staticProvider({
      "Plan launch": {
        path: "Plan launch.md",
        properties: { start: "2025-05-15" },
      },
    });
    const [task] = resolveLinkedPages([linked("Plan launch")], provider);
    expect(task!.start).toBeUndefined();
    expect(task!.due).toBeUndefined();
  });

  it("passes inline tasks through untouched", () => {
    const inline: ParsedTask = {
      form: "inline",
      label: "Ship v0.1",
      hostPath: "Note.md",
      hostLine: 3,
      done: false,
      due: "2025-05-20",
      dueSource: "reminder",
    };
    const [task] = resolveLinkedPages([inline], staticProvider({}));
    expect(task).toEqual(inline);
  });
});
