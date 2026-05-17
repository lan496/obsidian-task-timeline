import { describe, expect, it } from "vitest";
import { parseFolderList, shouldIncludePath } from "./types";

describe("shouldIncludePath", () => {
  it("includes everything when both lists are empty", () => {
    expect(shouldIncludePath("Notes/x.md", [], [])).toBe(true);
  });

  it("requires the path to start with one include prefix", () => {
    expect(shouldIncludePath("Notes/x.md", ["Projects"], [])).toBe(false);
    expect(shouldIncludePath("Projects/x.md", ["Projects"], [])).toBe(true);
  });

  it("excludes paths matching any exclude prefix", () => {
    expect(shouldIncludePath("Archive/old.md", [], ["Archive"])).toBe(false);
    expect(shouldIncludePath("Templates/x.md", [], ["Archive"])).toBe(true);
  });

  it("combines include and exclude (exclude wins)", () => {
    expect(
      shouldIncludePath("Projects/Old/x.md", ["Projects"], ["Projects/Old"])
    ).toBe(false);
    expect(
      shouldIncludePath("Projects/Active/x.md", ["Projects"], ["Projects/Old"])
    ).toBe(true);
  });

  it("ignores empty-string exclude entries", () => {
    expect(shouldIncludePath("Notes/x.md", [], [""])).toBe(true);
  });
});

describe("parseFolderList", () => {
  it("splits on comma and trims whitespace", () => {
    expect(parseFolderList(" Projects , Notes/Plans ")).toEqual([
      "Projects",
      "Notes/Plans",
    ]);
  });

  it("drops empty entries", () => {
    expect(parseFolderList(",Projects,,")).toEqual(["Projects"]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseFolderList("")).toEqual([]);
    expect(parseFolderList("   ")).toEqual([]);
  });
});
