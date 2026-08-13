import { afterEach, describe, expect, test } from "bun:test";
import { getRegistry, resetRegistry } from "../src/profiles";

/** Snapshot-and-restore, since the registry reads `process.env` on every rebuild. */
async function withEnv(overrides: Record<string, string | undefined>) {
  const added = Object.keys(overrides);
  const before = new Map(added.map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    resetRegistry();
    return await getRegistry(true);
  } finally {
    for (const [k, v] of before) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    resetRegistry();
  }
}

afterEach(() => {
  resetRegistry();
});

describe("profile registry", () => {
  test("derives the default profile from the global AWS_* env", async () => {
    const { profiles, defaultId } = await getRegistry(true);
    const fallback = profiles.find((p) => p.id === defaultId);
    expect(defaultId).toBe("default");
    expect(fallback).toMatchObject({
      label: "Default",
      source: "env",
      region: process.env.AWS_DEFAULT_REGION,
      s3Endpoint: process.env.AWS_S3_ENDPOINT_URL,
      sqsEndpoint: process.env.AWS_SQS_ENDPOINT_URL,
      s3: true,
      sqs: true,
    });
    expect(fallback?.credentials).toMatchObject({ accessKeyId: process.env.AWS_ACCESS_KEY_ID as string });
  });

  test("renames the default profile on request", async () => {
    const { defaultId, profiles } = await withEnv({ DEFAULT_PROFILE_ID: "RustFS Local", DEFAULT_PROFILE_LABEL: "Emu" });
    expect(defaultId).toBe("rustfs-local");
    expect(profiles[0]?.label).toBe("Emu");
  });

  test("parses PROFILE_<id>_* groups, splitting service keys correctly", async () => {
    const { profiles } = await withEnv({
      PROFILE_staging_LABEL: "Staging",
      PROFILE_staging_S3_ENDPOINT_URL: "http://s3.example",
      PROFILE_staging_ENDPOINT_URL: "http://shared.example",
      PROFILE_staging_REGION: "us-west-2",
      PROFILE_staging_ACCESS_KEY_ID: "AKIA",
      PROFILE_staging_SECRET_ACCESS_KEY: "shh",
      PROFILE_staging_ENABLE_SQS: "off",
    });

    expect(profiles.find((p) => p.id === "staging")).toMatchObject({
      label: "Staging",
      source: "env",
      region: "us-west-2",
      // Service-specific wins; the shared value covers the other service.
      s3Endpoint: "http://s3.example",
      sqsEndpoint: "http://shared.example",
      s3: true,
      sqs: false,
      credentials: { accessKeyId: "AKIA", secretAccessKey: "shh" },
    });
  });

  test("inherits the global feature flags when a group does not override them", async () => {
    const { profiles } = await withEnv({
      ENABLE_SQS: "0",
      PROFILE_x_ACCESS_KEY_ID: "a",
      PROFILE_x_SECRET_ACCESS_KEY: "b",
    });
    for (const profile of profiles) {
      expect(profile.sqs).toBe(false);
      expect(profile.s3).toBe(true);
    }
  });

  test("slugifies ids and steps around reserved ones", async () => {
    const { profiles } = await withEnv({
      PROFILE_s3_ACCESS_KEY_ID: "a",
      PROFILE_s3_SECRET_ACCESS_KEY: "b",
      "PROFILE_My Prod Acct_ACCESS_KEY_ID": "a",
      "PROFILE_My Prod Acct_SECRET_ACCESS_KEY": "b",
    });
    const ids = profiles.map((p) => p.id);
    // `s3` would be shadowed by the legacy /api/s3 routes.
    expect(ids).not.toContain("s3");
    expect(ids).toContain("s3-2");
    expect(ids).toContain("my-prod-acct");
  });

  test("does not shadow a static asset path", async () => {
    const { profiles } = await withEnv({ PROFILE_assets_ACCESS_KEY_ID: "a", PROFILE_assets_SECRET_ACCESS_KEY: "b" });
    expect(profiles.map((p) => p.id)).not.toContain("assets");
  });

  test("skips shared-config discovery when disabled", async () => {
    const { profiles } = await withEnv({ ENABLE_PROFILE_DISCOVERY: "0" });
    expect(profiles.every((p) => p.source === "env")).toBe(true);
  });

  test("omits the ambient profile without a container identity", async () => {
    const { profiles } = await withEnv({ ENABLE_PROFILE_DISCOVERY: "1", AWS_CONFIG_PROFILES: "__none__" });
    expect(profiles.some((p) => p.source === "ambient")).toBe(false);
  });
});
