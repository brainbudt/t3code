import { describe, expect, it } from "vite-plus/test";

import {
  createEntryParentPath,
  foldersToRefresh,
  resolveNewEntryPath,
} from "./fileTreeCreateEntry";

describe("createEntryParentPath", () => {
  it("creates inside a folder, beside a file, and at the root for top-level files", () => {
    expect(createEntryParentPath("src/components/", "directory")).toBe("src/components");
    expect(createEntryParentPath("src/components/Button.tsx", "file")).toBe("src/components");
    expect(createEntryParentPath("README.md", "file")).toBe("");
  });
});

describe("resolveNewEntryPath", () => {
  it("joins the name to the folder and allows nested names", () => {
    expect(resolveNewEntryPath("src", " notes.md ")).toEqual({ relativePath: "src/notes.md" });
    expect(resolveNewEntryPath("", "docs/guide/intro.md")).toEqual({
      relativePath: "docs/guide/intro.md",
    });
  });

  it("rejects empty names, absolute paths, and names that leave the folder", () => {
    for (const name of [
      "",
      "   ",
      "/etc/passwd",
      "\\\\host\\share",
      "C:\\temp",
      "../up",
      "a//b",
      ".",
    ]) {
      expect(resolveNewEntryPath("src", name)).toHaveProperty("error");
    }
  });
});

describe("foldersToRefresh", () => {
  it("re-reads every folder from the chosen one down to the new entry's folder", () => {
    expect(foldersToRefresh("", "README.md")).toEqual([""]);
    expect(foldersToRefresh("src", "src/notes.md")).toEqual(["src"]);
    // `src` may already be loaded and cached when creating from the root.
    expect(foldersToRefresh("", "src/assets")).toEqual(["", "src"]);
    expect(foldersToRefresh("src", "src/components/ui/Card.tsx")).toEqual([
      "src",
      "src/components",
      "src/components/ui",
    ]);
  });
});
