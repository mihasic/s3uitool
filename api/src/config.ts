import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Mirrors pydantic-settings' bool coercion so `ENABLE_S3=0` behaves identically. */
const TRUTHY = new Set(["1", "true", "t", "yes", "y", "on"]);
const FALSY = new Set(["0", "false", "f", "no", "n", "off"]);

function toBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (TRUTHY.has(normalized)) return true;
  if (FALSY.has(normalized)) return false;
  return fallback;
}

/**
 * Load `.env` files the way pydantic-settings does: real env vars win, and later
 * files in the list win over earlier ones.
 */
function loadDotenv(files: string[]): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const file of files) {
    const path = resolve(file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const match = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/.exec(line);
      if (!match || line.trimStart().startsWith("#")) continue;
      const value = (match[2] ?? "").trim().replace(/^(['"])([\s\S]*)\1$/, "$2");
      merged[match[1] as string] = value;
    }
  }
  return merged;
}

const dotenv = loadDotenv([".env", "../.env"]);

function env(name: string): string | undefined {
  const upper = name.toUpperCase();
  return process.env[upper] ?? dotenv[upper] ?? dotenv[name.toLowerCase()];
}

const awsEndpointUrl = env("aws_endpoint_url");

export const settings = {
  awsDefaultRegion: env("aws_default_region"),
  awsEndpointUrl,
  /** Prefer S3-specific endpoint, fallback to legacy shared endpoint. */
  s3EndpointUrl: env("aws_s3_endpoint_url") || awsEndpointUrl,
  /** Prefer SQS-specific endpoint, fallback to legacy shared endpoint. */
  sqsEndpointUrl: env("aws_sqs_endpoint_url") || awsEndpointUrl,
  enableS3: toBool(env("enable_s3"), true),
  enableSqs: toBool(env("enable_sqs"), true),
};
