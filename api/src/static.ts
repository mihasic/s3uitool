import { realpathSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";

/**
 * Resolve `fullPath` under `base`, or null if it escapes or isn't a file.
 *
 * Guards against path traversal (e.g. URL-encoded `..`) by requiring the
 * resolved target to stay within `base`.
 */
export function resolveStaticFile(base: string, fullPath: string): string | null {
  const baseResolved = realpath(resolve(base));
  const target = realpath(resolve(baseResolved, fullPath));

  const inside = target === baseResolved || target.startsWith(baseResolved + sep);
  if (inside && statSync(target, { throwIfNoEntry: false })?.isFile()) return target;
  return null;
}

/** `Path.resolve()` in Python also follows symlinks; fall back for missing paths. */
function realpath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}
