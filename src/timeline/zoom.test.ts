import { describe, expect, it } from "vitest";
import { getHeader } from "./zoom";

describe("getHeader", () => {
  it("returns day-level minor ticks for each day in range", () => {
    const header = getHeader("2025-05-17", "2025-05-20", "day");
    expect(header.minor).toHaveLength(4);
    expect(header.minor.map((t) => t.label)).toEqual([
      "05-17",
      "05-18",
      "05-19",
      "05-20",
    ]);
    expect(header.major.map((t) => t.label)).toEqual(["May 2025"]);
    expect(header.major[0]!.offsetDays).toBe(0);
    expect(header.major[0]!.spanDays).toBe(4);
  });

  it("returns month-level minor ticks for each month in range", () => {
    const header = getHeader("2025-01-15", "2025-04-10", "month");
    expect(header.minor.map((t) => t.label)).toEqual([
      "Jan",
      "Feb",
      "Mar",
      "Apr",
    ]);
    expect(header.major.map((t) => t.label)).toEqual(["2025"]);
  });

  it("returns quarter ticks aligned to calendar quarters", () => {
    const header = getHeader("2025-02-10", "2025-11-20", "quarter");
    expect(header.minor.map((t) => t.label)).toEqual(["Q1", "Q2", "Q3", "Q4"]);
    expect(header.major.map((t) => t.label)).toEqual(["2025"]);
    expect(header.sub).toBeDefined();
    expect(header.sub!.length).toBeGreaterThan(0);
  });

  it("returns year ticks with decade as major", () => {
    const header = getHeader("2023-06-01", "2025-06-30", "year");
    expect(header.minor.map((t) => t.label)).toEqual([
      "2023",
      "2024",
      "2025",
    ]);
    expect(header.major.map((t) => t.label)).toEqual(["2020s"]);
  });

  it("returns week-level minor ticks starting on Monday", () => {
    const header = getHeader("2025-05-19", "2025-06-01", "week");
    expect(header.minor.length).toBeGreaterThan(0);
    expect(header.minor[0]!.label).toBe("05-19");
  });

  it("includes week sub-ticks at Month zoom", () => {
    const header = getHeader("2025-05-01", "2025-05-31", "month");
    expect(header.sub).toBeDefined();
    expect(header.sub!.length).toBeGreaterThanOrEqual(4);
  });

  it("includes quarter sub-ticks at Year zoom", () => {
    const header = getHeader("2025-01-01", "2025-12-31", "year");
    expect(header.sub).toBeDefined();
    expect(header.sub!.map((t) => t.label)).toEqual(["Q1", "Q2", "Q3", "Q4"]);
  });
});
