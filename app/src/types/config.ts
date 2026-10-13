import type { AppConfig, PublicProfile } from "@api/schema/config";

export function findProfile(config: AppConfig | null, id: string | undefined): PublicProfile | undefined {
  if (!config) return undefined;
  return config.profiles.find((p) => p.id === id);
}

/** The profile a route should fall back to when its `$profile` param is missing or stale. */
export function activeProfile(config: AppConfig | null, id: string | undefined): PublicProfile | undefined {
  if (!config) return undefined;
  return findProfile(config, id) ?? findProfile(config, config.defaultProfile) ?? config.profiles[0];
}
