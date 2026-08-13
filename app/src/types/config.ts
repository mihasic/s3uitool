export type ProfileSource = "env" | "ambient" | "ini";

export interface Profile {
  id: string;
  label: string;
  source: ProfileSource;
  region?: string;
  s3: boolean;
  sqs: boolean;
}

export interface AppConfig {
  defaultProfile: string;
  profiles: Profile[];
}

export interface Identity {
  available: boolean;
  accountId: string | null;
  arn: string | null;
  userId: string | null;
  reason?: string;
}

export function findProfile(config: AppConfig | null, id: string | undefined): Profile | undefined {
  if (!config) return undefined;
  return config.profiles.find((p) => p.id === id);
}

/** The profile a route should fall back to when its `$profile` param is missing or stale. */
export function activeProfile(config: AppConfig | null, id: string | undefined): Profile | undefined {
  if (!config) return undefined;
  return findProfile(config, id) ?? findProfile(config, config.defaultProfile) ?? config.profiles[0];
}
