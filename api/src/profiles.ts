import { readdirSync } from "node:fs";
import type { S3ClientConfig } from "@aws-sdk/client-s3";
import { fromIni, fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { loadSharedConfigFiles } from "@smithy/shared-ini-file-loader";

export type ProfileSource = "env" | "ambient" | "ini";

type Credentials = NonNullable<S3ClientConfig["credentials"]>;

export interface Profile {
  id: string;
  label: string;
  source: ProfileSource;
  region?: string;
  s3Endpoint?: string;
  sqsEndpoint?: string;
  s3: boolean;
  sqs: boolean;
  credentials?: Credentials;
  /** Changes whenever the resolved shape changes, so cached clients can be evicted. */
  fingerprint: string;
}

/** The profile shape sent to the frontend — no credentials, no endpoints. */
export interface PublicProfile {
  id: string;
  label: string;
  source: ProfileSource;
  region?: string;
  s3: boolean;
  sqs: boolean;
}

export interface Registry {
  profiles: Profile[];
  defaultId: string;
}

/** `ENABLE_S3=0`, `=false`, `=no` and `=off` all disable a feature; anything else enables it. */
export function flag(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  return !/^(0|false|no|off)$/i.test(value.trim());
}

const ENV_KEYS = [
  "LABEL",
  "REGION",
  "ENDPOINT_URL",
  "S3_ENDPOINT_URL",
  "SQS_ENDPOINT_URL",
  "ACCESS_KEY_ID",
  "SECRET_ACCESS_KEY",
  "SESSION_TOKEN",
  "AWS_PROFILE",
  "ENABLE_S3",
  "ENABLE_SQS",
] as const;

type EnvKey = (typeof ENV_KEYS)[number];

// Non-greedy id so `PROFILE_local_S3_ENDPOINT_URL` splits as `local` + `S3_ENDPOINT_URL`.
const ENV_GROUP = new RegExp(`^PROFILE_(.+?)_(${ENV_KEYS.join("|")})$`);

/** Ids that would be shadowed by an API route or a static asset under `/:profile/...`. */
const RESERVED_IDS = ["api", "config", "health", "s3", "sqs", "index.html", "favicon.ico"];

function staticEntries(): string[] {
  try {
    return readdirSync(process.env.STATIC_DIR ?? "/app/static");
  } catch {
    return [];
  }
}

function slug(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "profile";
}

function claimId(preferred: string, taken: Set<string>, prefixOnCollision?: string): string {
  let candidate = slug(preferred);
  if (taken.has(candidate) && prefixOnCollision) candidate = slug(`${prefixOnCollision}-${preferred}`);
  let unique = candidate;
  for (let n = 2; taken.has(unique); n += 1) unique = `${candidate}-${n}`;
  if (unique !== slug(preferred)) console.warn(`Profile "${preferred}" renamed to "${unique}" to avoid a collision.`);
  taken.add(unique);
  return unique;
}

function fingerprintOf(parts: Record<string, unknown>): string {
  return JSON.stringify(parts);
}

function staticCredentials(accessKeyId?: string, secretAccessKey?: string, sessionToken?: string) {
  if (!accessKeyId || !secretAccessKey) return undefined;
  // An empty token would be sent as a blank x-amz-security-token header.
  return { accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) };
}

function envProfile(id: string, label: string, read: (key: EnvKey) => string | undefined): Profile {
  const shared = read("ENDPOINT_URL");
  const s3Endpoint = read("S3_ENDPOINT_URL") || shared;
  const sqsEndpoint = read("SQS_ENDPOINT_URL") || shared;
  const iniProfile = read("AWS_PROFILE");
  const accessKeyId = read("ACCESS_KEY_ID");
  const secretAccessKey = read("SECRET_ACCESS_KEY");
  const staticCreds = staticCredentials(accessKeyId, secretAccessKey, read("SESSION_TOKEN"));

  return {
    id,
    label,
    source: "env",
    region: read("REGION"),
    s3Endpoint,
    sqsEndpoint,
    s3: flag(read("ENABLE_S3"), flag(process.env.ENABLE_S3, true)),
    sqs: flag(read("ENABLE_SQS"), flag(process.env.ENABLE_SQS, true)),
    credentials: staticCreds ?? (iniProfile ? fromIni({ profile: iniProfile }) : undefined),
    fingerprint: fingerprintOf({
      source: "env",
      region: read("REGION"),
      s3Endpoint,
      sqsEndpoint,
      iniProfile,
      accessKeyId,
      hasSecret: Boolean(secretAccessKey),
      sessionToken: read("SESSION_TOKEN"),
    }),
  };
}

function defaultProfile(taken: Set<string>): Profile {
  const id = claimId(process.env.DEFAULT_PROFILE_ID || "default", taken);
  const label = process.env.DEFAULT_PROFILE_LABEL || "Default";
  return envProfile(id, label, (key) => {
    if (key === "LABEL") return undefined;
    if (key === "REGION") return process.env.AWS_DEFAULT_REGION;
    if (key === "ENABLE_S3" || key === "ENABLE_SQS") return process.env[key];
    if (key === "AWS_PROFILE") return undefined;
    return process.env[`AWS_${key}`];
  });
}

function declaredProfiles(taken: Set<string>): Profile[] {
  const groups = new Map<string, Partial<Record<EnvKey, string>>>();
  for (const [name, value] of Object.entries(process.env)) {
    const match = ENV_GROUP.exec(name);
    if (!match || !value) continue;
    const [, rawId, key] = match as unknown as [string, string, EnvKey];
    const group = groups.get(rawId) ?? {};
    group[key] = value;
    groups.set(rawId, group);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([rawId, group]) => envProfile(claimId(rawId, taken), group.LABEL || rawId, (key) => group[key]));
}

function isPinned(profile: Profile): boolean {
  return Boolean(profile.credentials || profile.s3Endpoint || profile.sqsEndpoint);
}

async function sharedConfig(): Promise<{ names: string[]; regionOf: (name: string) => string | undefined }> {
  const allowlist = process.env.AWS_CONFIG_PROFILES?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    const { configFile, credentialsFile } = await loadSharedConfigFiles();
    const names = [...new Set([...Object.keys(configFile), ...Object.keys(credentialsFile)])]
      .filter((name) => !allowlist || allowlist.includes(name))
      .sort();
    return { names, regionOf: (name) => configFile[name]?.region ?? credentialsFile[name]?.region };
  } catch (e) {
    console.warn(`Could not read the shared AWS config: ${e}`);
    return { names: [], regionOf: () => undefined };
  }
}

async function discover(): Promise<Registry> {
  const taken = new Set<string>([...RESERVED_IDS, ...staticEntries()]);
  const fallback = defaultProfile(taken);
  const profiles = [fallback, ...declaredProfiles(taken)];

  if (flag(process.env.ENABLE_PROFILE_DISCOVERY, true)) {
    const { names, regionOf } = await sharedConfig();
    const globalEnableS3 = flag(process.env.ENABLE_S3, true);
    const globalEnableSqs = flag(process.env.ENABLE_SQS, true);

    for (const name of names) {
      const region = regionOf(name) ?? process.env.AWS_REGION ?? "us-east-1";
      profiles.push({
        id: claimId(name, taken, "aws"),
        label: name,
        source: "ini",
        region,
        s3: globalEnableS3,
        sqs: globalEnableSqs,
        // `fromNodeProviderChain({ profile })` would still prefer ambient env keys,
        // which on this app are usually the emulator's.
        credentials: fromIni({ profile: name }),
        fingerprint: fingerprintOf({ source: "ini", name, region }),
      });
    }

    // With no shared config there is nothing to name, but a container may still have an
    // ambient identity distinct from the pinned default. Requiring one of these markers
    // keeps a dead "Local AWS session" entry out of the plain docker-compose setup.
    const hasContainerIdentity = Boolean(
      process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
        process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI ||
        process.env.AWS_WEB_IDENTITY_TOKEN_FILE,
    );
    if (names.length === 0 && hasContainerIdentity && isPinned(fallback) && !process.env.AWS_PROFILE) {
      const region = process.env.AWS_REGION;
      profiles.push({
        id: claimId("local-session", taken),
        label: "Local AWS session",
        source: "ambient",
        region,
        s3: globalEnableS3,
        sqs: globalEnableSqs,
        credentials: fromNodeProviderChain(),
        fingerprint: fingerprintOf({ source: "ambient", region }),
      });
    }
  }

  return { profiles, defaultId: fallback.id };
}

const CACHE_TTL_MS = 10_000;
let cached: { at: number; registry: Registry } | undefined;

export async function getRegistry(force = false): Promise<Registry> {
  if (!force && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.registry;
  const registry = await discover();
  cached = { at: Date.now(), registry };
  return registry;
}

export function resetRegistry(): void {
  cached = undefined;
}

export async function findProfile(id: string): Promise<Profile | undefined> {
  const { profiles } = await getRegistry();
  return profiles.find((p) => p.id === id);
}

export function toPublicProfile(profile: Profile): PublicProfile {
  const { id, label, source, region, s3, sqs } = profile;
  return { id, label, source, region, s3, sqs };
}
