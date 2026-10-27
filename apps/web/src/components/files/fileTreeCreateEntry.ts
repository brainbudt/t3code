import type { ProjectEntry } from "@t3tools/contracts";

/** The folder a new entry goes in: the clicked folder itself, or the clicked file's folder. */
export function createEntryParentPath(
  itemPath: string,
  itemKind: ProjectEntry["kind"] | undefined,
): string {
  const path = itemPath.replace(/\/$/, "");
  if (itemKind === "directory") return path;
  const slash = path.lastIndexOf("/");
  return slash === -1 ? "" : path.slice(0, slash);
}

/** Returns the workspace-relative path to create, or an error for the name field. */
export function resolveNewEntryPath(
  parentPath: string,
  name: string,
): { readonly relativePath: string } | { readonly error: string } {
  const trimmed = name.trim();
  if (trimmed.length === 0) return { error: "Enter a name." };
  if (/^([/\\]|[a-zA-Z]:)/.test(trimmed)) return { error: "Use a name inside this folder." };
  // Only `/` splits here; the server decides what `\` means on its host.
  const segments = trimmed.split("/");
  if (segments.some((segment) => segment === "." || segment === "..")) {
    return { error: "Use a name inside this folder." };
  }
  if (segments.includes("")) return { error: "Remove the extra '/'." };
  const relative = segments.join("/");
  return { relativePath: parentPath ? `${parentPath}/${relative}` : relative };
}
