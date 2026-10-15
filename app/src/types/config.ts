import type { AppConfig, PublicProfile } from "@api/schema/config";

export function findProfile(config: AppConfig, id: string | undefined): PublicProfile | undefined {
  return config.profiles.find((p) => p.id === id);
}

/** The profile a route should fall back to when its `$profile` param is missing or stale. */
export function activeProfile(config: AppConfig, id: string | undefined): PublicProfile {
  return findProfile(config, id) ?? findProfile(config, config.defaultProfile) ?? config.profiles[0];
}

export function defaultProfileId(config: AppConfig): string {
  return activeProfile(config, undefined).id;
}
