import { describe, expect, it } from "vitest";
import { hasDate, parseTasks } from "./parseTasks";
import { MarkdownDocument, ParsedTask } from "./types";

function doc(content: string): MarkdownDocument {
  return { path: "Note.md", content };
}

function only(tasks: ParsedTask[]): ParsedTask {
  expect(tasks).toHaveLength(1);
  return tasks[0]!;
}

describe("parseTasks: due-date markers", () => {
  it("parses reminder-native (@YYYY-MM-DD)", () => {
    const task = only(parseTasks(doc("- [ ] Ship v0.1 (@2025-05-20)")));
    expect(task).toMatchObject({
      form: "inline",
      label: "Ship v0.1",
      hostPath: "Note.md",
      hostLine: 1,
      done: false,
      due: "2025-05-20",
      dueSource: "reminder",
    });
  });

  it("parses reminder with a HH:mm component and discards the time", () => {
    const task = only(
      parseTasks(doc("- [ ] With time (@2025-05-20 09:00)"))
    );
    expect(task.due).toBe("2025-05-20");
    expect(task.dueSource).toBe("reminder");
    expect(task.label).toBe("With time");
  });

  it("parses Tasks-style due emoji", () => {
    const task = only(parseTasks(doc("- [ ] Plan launch \u{1F4C5} 2025-05-20")));
    expect(task).toMatchObject({
      label: "Plan launch",
      due: "2025-05-20",
      dueSource: "tasks",
    });
  });

  it("parses Kanban-style @{YYYY-MM-DD}", () => {
    const task = only(parseTasks(doc("- [ ] Review PR @{2025-05-20}")));
    expect(task).toMatchObject({
      label: "Review PR",
      due: "2025-05-20",
      dueSource: "kanban",
    });
  });

  it("marks completed tasks as done", () => {
    const task = only(parseTasks(doc("- [x] Done thing (@2025-05-20)")));
    expect(task.done).toBe(true);
  });

  it("treats [X] as done (case-insensitive)", () => {
    const task = only(parseTasks(doc("- [X] Capital X (@2025-05-20)")));
    expect(task.done).toBe(true);
  });

  it("returns the body as label when no marker is found", () => {
    const task = only(parseTasks(doc("- [ ] Free-form task with no date")));
    expect(task.label).toBe("Free-form task with no date");
    expect(task.due).toBeUndefined();
    expect(task.dueSource).toBeUndefined();
  });
});

describe("parseTasks: precedence", () => {
  it("prefers reminder over tasks-emoji", () => {
    const task = only(
      parseTasks(doc("- [ ] Mixed (@2025-05-20) \u{1F4C5} 2025-05-30"))
    );
    expect(task.due).toBe("2025-05-20");
    expect(task.dueSource).toBe("reminder");
  });

  it("prefers tasks-emoji over kanban", () => {
    const task = only(
      parseTasks(doc("- [ ] Mixed \u{1F4C5} 2025-05-20 @{2025-05-30}"))
    );
    expect(task.due).toBe("2025-05-20");
    expect(task.dueSource).toBe("tasks");
  });
});

describe("parseTasks: label stripping", () => {
  it("removes the marker substring and collapses whitespace", () => {
    const task = only(parseTasks(doc("- [ ] Hello (@2025-05-20) world")));
    expect(task.label).toBe("Hello world");
  });

  it("trims leading and trailing whitespace after stripping", () => {
    const task = only(parseTasks(doc("- [ ] (@2025-05-20) Suffix only")));
    expect(task.label).toBe("Suffix only");
  });
});

describe("parseTasks: multi-line documents", () => {
  it("returns one task per checkbox line", () => {
    const tasks = parseTasks(
      doc(
        [
          "# Heading",
          "- [ ] Task A (@2025-05-20)",
          "Some prose.",
          "- [x] Task B \u{1F4C5} 2025-05-21",
          "* [ ] Task C @{2025-05-22}",
        ].join("\n")
      )
    );
    expect(tasks).toHaveLength(3);
    expect(tasks.map((t) => t.label)).toEqual(["Task A", "Task B", "Task C"]);
    expect(tasks.map((t) => t.hostLine)).toEqual([2, 4, 5]);
  });

  it("skips non-task list items", () => {
    const tasks = parseTasks(
      doc("- a regular bullet\n- [ ] real task (@2025-05-20)")
    );
    expect(tasks).toHaveLength(1);
  });
});

describe("hasDate", () => {
  it("narrows tasks with due + dueSource", () => {
    const tasks = parseTasks(
      doc("- [ ] dated (@2025-05-20)\n- [ ] undated")
    );
    const dated = tasks.filter(hasDate);
    expect(dated).toHaveLength(1);
    expect(dated[0]!.due).toBe("2025-05-20");
  });
});

describe("parseTasks: dash ranges", () => {
  it("parses a reminder-form range", () => {
    const task = only(parseTasks(doc("- [ ] Ship (@2025-05-17 - 2025-05-20)")));
    expect(task.start).toBe("2025-05-17");
    expect(task.due).toBe("2025-05-20");
    expect(task.dueSource).toBe("reminder");
  });

  it("parses a reminder-form range with @ on both ends", () => {
    const task = only(
      parseTasks(doc("- [ ] Ship (@2025-05-17 - @2025-05-20)"))
    );
    expect(task.start).toBe("2025-05-17");
    expect(task.due).toBe("2025-05-20");
    expect(task.dueSource).toBe("reminder");
  });

  it("parses a tasks-emoji range", () => {
    const task = only(
      parseTasks(doc("- [ ] Plan \u{1F4C5} 2025-05-17 - 2025-05-20"))
    );
    expect(task.start).toBe("2025-05-17");
    expect(task.due).toBe("2025-05-20");
    expect(task.dueSource).toBe("tasks");
  });

  it("parses a kanban range", () => {
    const task = only(
      parseTasks(doc("- [ ] Review @{2025-05-17 - 2025-05-20}"))
    );
    expect(task.start).toBe("2025-05-17");
    expect(task.due).toBe("2025-05-20");
    expect(task.dueSource).toBe("kanban");
  });

  it("drops start when start > due (and keeps due as single-day)", () => {
    const task = only(parseTasks(doc("- [ ] Bad (@2025-05-20 - 2025-05-17)")));
    expect(task.start).toBeUndefined();
    expect(task.due).toBe("2025-05-17");
  });

  it("accepts start === due as a one-day range (start kept)", () => {
    const task = only(parseTasks(doc("- [ ] Same (@2025-05-20 - 2025-05-20)")));
    expect(task.start).toBe("2025-05-20");
    expect(task.due).toBe("2025-05-20");
  });

  it("requires whitespace around the dash separator", () => {
    const task = only(parseTasks(doc("- [ ] Bad (@2025-05-17-2025-05-20)")));
    expect(task.start).toBeUndefined();
    expect(task.due).toBeUndefined();
  });
});

describe("parseTasks: column tracking", () => {
  it("attaches the most recent heading as the task's column", () => {
    const tasks = parseTasks(
      doc(
        [
          "## Backlog",
          "- [ ] Plan launch (@2025-05-20)",
          "## Done",
          "- [x] Old task (@2025-05-15)",
        ].join("\n")
      )
    );
    expect(tasks.map((t) => t.column)).toEqual(["Backlog", "Done"]);
  });

  it("leaves column undefined for tasks before any heading", () => {
    const task = only(parseTasks(doc("- [ ] Free task (@2025-05-20)")));
    expect(task.column).toBeUndefined();
  });

  it("tracks heading switches in order", () => {
    const tasks = parseTasks(
      doc(
        [
          "# Top",
          "- [ ] A (@2025-05-20)",
          "## Sub",
          "- [ ] B (@2025-05-21)",
          "# Back",
          "- [ ] C (@2025-05-22)",
        ].join("\n")
      )
    );
    expect(tasks.map((t) => t.column)).toEqual(["Top", "Sub", "Back"]);
  });

  it("captures the column on linked-page tasks too", () => {
    const tasks = parseTasks(
      doc(["## Done", "- [ ] [[Page]]"].join("\n"))
    );
    expect(tasks[0]!.column).toBe("Done");
    expect(tasks[0]!.form).toBe("linked-page");
  });
});

describe("parseTasks: linked-page form", () => {
  it("detects a bare [[Page]] body", () => {
    const task = only(parseTasks(doc("- [ ] [[Plan launch]]")));
    expect(task).toMatchObject({
      form: "linked-page",
      label: "Plan launch",
      pagePath: "Plan launch",
    });
    expect(task.due).toBeUndefined();
    expect(task.dueSource).toBeUndefined();
  });

  it("uses alias when [[Page|Alias]] is given", () => {
    const task = only(parseTasks(doc("- [ ] [[Q3 roadmap|Roadmap]]")));
    expect(task).toMatchObject({
      form: "linked-page",
      label: "Roadmap",
      pagePath: "Q3 roadmap",
    });
  });

  it("falls back to inline when the body has link + extra text", () => {
    const task = only(
      parseTasks(doc("- [ ] [[Plan launch]] notes (@2025-05-20)"))
    );
    expect(task.form).toBe("inline");
    expect(task.label).toBe("[[Plan launch]] notes");
    expect(task.due).toBe("2025-05-20");
  });

  it("handles surrounding whitespace around the link", () => {
    const task = only(parseTasks(doc("- [ ]   [[Page]]  ")));
    expect(task.form).toBe("linked-page");
    expect(task.pagePath).toBe("Page");
  });
});

describe("parseTasks: loose date formats", () => {
  it("accepts unpadded month and day in reminder syntax", () => {
    const task = only(parseTasks(doc("- [ ] T (@2026-4-1)")));
    expect(task.due).toBe("2026-04-01");
    expect(task.start).toBeUndefined();
  });

  it("accepts unpadded month in tasks-emoji syntax", () => {
    const task = only(parseTasks(doc("- [ ] T \u{1F4C5} 2026-4-1")));
    expect(task.due).toBe("2026-04-01");
  });

  it("accepts unpadded month and day in kanban syntax", () => {
    const task = only(parseTasks(doc("- [ ] T @{2026-4-1}")));
    expect(task.due).toBe("2026-04-01");
  });

  it("expands a month-only single date into a month-long range", () => {
    const task = only(parseTasks(doc("- [ ] T @{2026-4}")));
    expect(task.start).toBe("2026-04-01");
    expect(task.due).toBe("2026-04-30");
  });

  it("expands a month-only range across two months", () => {
    const task = only(parseTasks(doc("- [ ] T @{2026-4 - 2026-5}")));
    expect(task.start).toBe("2026-04-01");
    expect(task.due).toBe("2026-05-31");
  });

  it("rejects invalid months", () => {
    const task = only(parseTasks(doc("- [ ] T @{2026-13-1}")));
    expect(task.due).toBeUndefined();
  });

  it("rejects invalid days for the month", () => {
    const task = only(parseTasks(doc("- [ ] T @{2026-2-30}")));
    expect(task.due).toBeUndefined();
  });
});

describe("parseTasks: twin @{} kanban range", () => {
  it("parses @{date} - @{date} as a range", () => {
    const task = only(
      parseTasks(doc("- [ ] Sprint @{2025-05-17} - @{2025-05-20}"))
    );
    expect(task.start).toBe("2025-05-17");
    expect(task.due).toBe("2025-05-20");
    expect(task.dueSource).toBe("kanban");
    expect(task.label).toBe("Sprint");
  });

  it("supports loose dates in twin form", () => {
    const task = only(
      parseTasks(doc("- [ ] Sprint @{2026-4} - @{2026-5-15}"))
    );
    expect(task.start).toBe("2026-04-01");
    expect(task.due).toBe("2026-05-15");
  });

  it("drops start when twin start > due", () => {
    const task = only(
      parseTasks(doc("- [ ] Bad @{2025-05-20} - @{2025-05-17}"))
    );
    expect(task.start).toBeUndefined();
    expect(task.due).toBe("2025-05-17");
  });
});

describe("parseTasks: tags", () => {
  it("extracts a single tag from the task body", () => {
    const task = only(parseTasks(doc("- [ ] Plan #work (@2025-05-20)")));
    expect(task.tags).toEqual(["work"]);
  });

  it("extracts multiple tags in source order, de-duped", () => {
    const task = only(
      parseTasks(doc("- [ ] T #alpha #beta #alpha (@2025-05-20)"))
    );
    expect(task.tags).toEqual(["alpha", "beta"]);
  });

  it("ignores `#` not preceded by whitespace (e.g. in URLs)", () => {
    const task = only(
      parseTasks(doc("- [ ] See https://example.com/page#section (@2025-05-20)"))
    );
    expect(task.tags).toBeUndefined();
  });

  it("ignores pure-numeric `#2025`", () => {
    const task = only(parseTasks(doc("- [ ] Issue #2025 (@2025-05-20)")));
    expect(task.tags).toBeUndefined();
  });

  it("supports nested tags via `/`", () => {
    const task = only(
      parseTasks(doc("- [ ] T #area/web (@2025-05-20)"))
    );
    expect(task.tags).toEqual(["area/web"]);
  });

  it("does not set tags when none are present", () => {
    const task = only(parseTasks(doc("- [ ] Plain (@2025-05-20)")));
    expect(task.tags).toBeUndefined();
  });
});
