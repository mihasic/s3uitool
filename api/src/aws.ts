import { S3Client } from "@aws-sdk/client-s3";
import { SQSClient } from "@aws-sdk/client-sqs";
import { STSClient } from "@aws-sdk/client-sts";
import type { Profile } from "./profiles";

interface Cached<T extends { destroy: () => void }> {
  fingerprint: string;
  client: T;
}

function cache<T extends { destroy: () => void }>(store: Map<string, Cached<T>>, profile: Profile, create: () => T): T {
  const existing = store.get(profile.id);
  if (existing) {
    if (existing.fingerprint === profile.fingerprint) return existing.client;
    existing.client.destroy();
  }
  const client = create();
  store.set(profile.id, { fingerprint: profile.fingerprint, client });
  return client;
}

const s3Clients = new Map<string, Cached<S3Client>>();
const sqsClients = new Map<string, Cached<SQSClient>>();
const stsClients = new Map<string, Cached<STSClient>>();

export function getS3Client(profile: Profile): S3Client {
  return cache(
    s3Clients,
    profile,
    () =>
      new S3Client({
        // The SDK defaults to virtual-host addressing, which breaks RustFS/MinIO.
        ...(profile.s3Endpoint ? { endpoint: profile.s3Endpoint, forcePathStyle: true } : {}),
        ...(profile.region ? { region: profile.region } : {}),
        ...(profile.credentials ? { credentials: profile.credentials } : {}),
      }),
  );
}

export function getSqsClient(profile: Profile): SQSClient {
  return cache(
    sqsClients,
    profile,
    () =>
      new SQSClient({
        ...(profile.sqsEndpoint ? { endpoint: profile.sqsEndpoint } : {}),
        ...(profile.region ? { region: profile.region } : {}),
        ...(profile.credentials ? { credentials: profile.credentials } : {}),
      }),
  );
}

export function getStsClient(profile: Profile): STSClient {
  return cache(
    stsClients,
    profile,
    () =>
      new STSClient({
        ...(profile.region ? { region: profile.region } : {}),
        ...(profile.credentials ? { credentials: profile.credentials } : {}),
      }),
  );
}
