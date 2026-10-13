import type { ObjectList } from "@api/schema/s3";
import type { TableItem, ViewMode } from "@/types/s3";

export function getParent(key: string): string {
  const trimmed = key.endsWith("/") ? key.slice(0, -1) : key;
  const lastSlash = trimmed.lastIndexOf("/");
  if (lastSlash === -1) return "";
  return `${trimmed.slice(0, lastSlash)}/`;
}

export function reachablePrefixes(root: string, expanded: ReadonlySet<string>): string[] {
  const isReachable = (folder: string) => {
    let current = folder;
    while (current !== root && current.length > root.length) {
      const parent = getParent(current);
      if (parent === root) return true;
      if (!expanded.has(parent)) return false;
      current = parent;
    }
    return true;
  };
  return [...expanded].filter((folder) => folder !== root && folder.startsWith(root) && isReachable(folder));
}

function fileItem(object: ObjectList["Objects"][number], name: string, depth: number): TableItem {
  return {
    key: object.Key,
    type: "file",
    name,
    depth,
    size: object.Size,
    lastModified: object.LastModified ?? undefined,
    etag: object.ETag,
  };
}

export function buildItems(
  root: string,
  viewMode: ViewMode,
  listings: ReadonlyMap<string, ObjectList>,
  expanded: ReadonlySet<string>,
): TableItem[] {
  if (viewMode === "flat") {
    return listings.get(root)?.Objects.map((object) => fileItem(object, object.Key, 0)) ?? [];
  }

  const flatten = (folder: string, depth: number): TableItem[] => {
    const content = listings.get(folder);
    if (!content) return [];
    const folders = content.CommonPrefixes.flatMap(({ Prefix }) => {
      const isExpanded = expanded.has(Prefix);
      const item: TableItem = {
        key: Prefix,
        type: "folder",
        name: Prefix.split("/").filter(Boolean).pop() || "",
        depth,
        isExpanded,
      };
      return isExpanded ? [item, ...flatten(Prefix, depth + 1)] : [item];
    });
    const files = content.Objects.map((object) => fileItem(object, object.Key.split("/").pop() || object.Key, depth));
    return [...folders, ...files];
  };

  return flatten(root, 0);
}
