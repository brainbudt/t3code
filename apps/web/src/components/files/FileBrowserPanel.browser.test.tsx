import { EnvironmentId, type ProjectEntry } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { COMPOSER_MENTION_DRAG_TYPE } from "~/components/chat/composerMentionDrag";
import { render } from "../../../test/render";
import FileBrowserPanel from "./FileBrowserPanel";

const entries: readonly ProjectEntry[] = [
  { path: "src", kind: "directory" },
  { path: "README.md", kind: "file" },
];
const loadingDirectories: ReadonlySet<string> = new Set();
const directory = {
  entries,
  load: () => Promise.resolve(),
  refresh: () => {},
  ready: true,
  error: null,
  isPending: false,
  loadingDirectories,
};
const pathSearch = {
  entries: [],
  isPending: false,
  error: null,
  truncated: false,
  refresh: () => {},
};

const mocks = vi.hoisted(() => ({
  showContextMenu: vi.fn<(items: readonly { id: string }[]) => Promise<string | null>>(),
  createEntry:
    vi.fn<
      (request: {
        environmentId: string;
        input: { cwd: string; relativePath: string; kind: string };
      }) => Promise<{ _tag: "Success"; value: { relativePath: string } }>
    >(),
}));

function setup() {
  mocks.showContextMenu.mockReset().mockResolvedValue(null);
  mocks.createEntry.mockReset().mockImplementation(async ({ input }) => ({
    _tag: "Success",
    value: { relativePath: input.relativePath },
  }));
}

vi.mock(import("~/localApi"), async (original) => ({
  ...(await original()),
  readLocalApi: (() => ({ contextMenu: { show: mocks.showContextMenu } })) as never,
}));
vi.mock(import("~/state/session"), async (original) => ({
  ...(await original()),
  useEnvironmentScope: () => true,
}));
vi.mock(import("~/state/use-atom-command"), async (original) => ({
  ...(await original()),
  useAtomCommand: (() => mocks.createEntry) as never,
}));
vi.mock("./useDirectoryEntries", () => ({ useDirectoryEntries: () => directory }));
vi.mock("~/state/queries", () => ({ useProjectPathSearch: () => pathSearch }));
vi.mock("~/fileContextMenu", () => ({
  useFileContextMenu: () => ({ buildItems: () => [], activate: () => Promise.resolve() }),
}));
vi.mock("~/hooks/useWorkspaceMutationRefresh", () => ({ useWorkspaceMutationRefresh: () => {} }));

function findTreeRow(path: string): HTMLElement | null {
  for (const host of document.querySelectorAll("*")) {
    const row = host.shadowRoot?.querySelector<HTMLElement>(`[data-item-path="${path}"]`);
    if (row) return row;
  }
  return null;
}

describe("FileBrowserPanel", () => {
  it("creates a file inside the right-clicked folder and opens it", async () => {
    setup();
    mocks.showContextMenu.mockResolvedValueOnce("new-file");
    const onOpenFile = vi.fn();
    await using _screen = await render(
      <FileBrowserPanel
        environmentId={EnvironmentId.make("env-files")}
        cwd="/repo"
        projectName="repo"
        selectedPath={null}
        selectedPathRevealId={0}
        onOpenFile={onOpenFile}
        workspaceMutationId={null}
      />,
    );
    await vi.waitFor(() => expect(findTreeRow("src/")).not.toBeNull());

    findTreeRow("src/")!.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, composed: true }),
    );
    await vi.waitFor(() => expect(mocks.showContextMenu).toHaveBeenCalledTimes(1));
    expect(mocks.showContextMenu.mock.calls[0]![0].map((item) => item.id)).toEqual(
      expect.arrayContaining(["new-file", "new-folder"]),
    );
    await expect.element(page.getByText("In repo/src")).toBeVisible();

    await userEvent.type(page.getByRole("textbox", { name: "File name" }), "notes.md{Enter}");

    await vi.waitFor(() => expect(onOpenFile).toHaveBeenCalledWith("src/notes.md"));
    expect(mocks.createEntry).toHaveBeenCalledWith({
      environmentId: EnvironmentId.make("env-files"),
      input: { cwd: "/repo", relativePath: "src/notes.md", kind: "file" },
    });
  });

  it("dragging a file row carries a composer mention without opening it, and dragend releases it", async () => {
    const onOpenFile = vi.fn();
    await using _screen = await render(
      <FileBrowserPanel
        environmentId={EnvironmentId.make("env-files")}
        cwd="/repo"
        projectName="repo"
        selectedPath={null}
        selectedPathRevealId={0}
        onOpenFile={onOpenFile}
        workspaceMutationId={null}
      />,
    );
    await vi.waitFor(() => expect(findTreeRow("README.md")).not.toBeNull());
    const row = findTreeRow("README.md")!;

    const dataTransfer = new DataTransfer();
    row.dispatchEvent(
      new DragEvent("dragstart", { bubbles: true, cancelable: true, composed: true, dataTransfer }),
    );
    // The tree selects the row the drag picked up; mid-drag that must not open it.
    row.click();
    await vi.waitFor(() => expect(row.getAttribute("aria-selected")).toBe("true"));

    expect(dataTransfer.getData(COMPOSER_MENTION_DRAG_TYPE)).toContain("README.md");
    expect(onOpenFile).not.toHaveBeenCalled();

    row.dispatchEvent(new DragEvent("dragend", { bubbles: true, composed: true, dataTransfer }));
    await vi.waitFor(() => expect(row.getAttribute("aria-selected")).not.toBe("true"));

    row.click();
    await vi.waitFor(() => expect(onOpenFile).toHaveBeenCalledTimes(1));
  });
});
