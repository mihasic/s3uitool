import { realpathSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";

/** Resolve `fullPath` under `base`, or null if it escapes (traversal) or isn't a file. */
export function resolveStaticFile(base: string, fullPath: string): string | null {
  const baseResolved = realpath(resolve(base));
  const target = realpath(resolve(baseResolved, fullPath));

  const inside = target === baseResolved || target.startsWith(baseResolved + sep);
  if (inside && statSync(target, { throwIfNoEntry: false })?.isFile()) return target;
  return null;
}

/** Follow symlinks; fall back for paths that don't exist. */
function realpath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}
