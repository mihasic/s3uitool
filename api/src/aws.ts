import { S3Client } from "@aws-sdk/client-s3";
import { SQSClient } from "@aws-sdk/client-sqs";
import { settings } from "./config.ts";

/**
 * botocore resolves credentials as env vars → shared profile, so `AWS_ACCESS_KEY_ID`
 * always wins. The JS `credentialProviderNode` chain inverts that: when `AWS_PROFILE`
 * is set it skips the env provider entirely and signs with the profile — which on a
 * developer machine means hitting a *real* AWS account instead of the local emulator.
 * Pin the env credentials explicitly so the behaviour matches the Python original.
 */
function envCredentials() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) return {};
  // `dev:local` exports AWS_SESSION_TOKEN= (empty); botocore ignores that, but an empty
  // string here would sign requests with a blank x-amz-security-token header.
  const sessionToken = process.env.AWS_SESSION_TOKEN || undefined;
  return { credentials: { accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) } };
}

let s3: S3Client | undefined;
let sqs: SQSClient | undefined;

/**
 * Return a cached SDK client. Clients are safe to reuse and hold the connection
 * pool, so we build one lazily per service. Use `resetClients()` if a test needs
 * to rebuild against a different endpoint.
 */
export function getS3Client(): S3Client {
  s3 ??= new S3Client({
    // botocore switches to path-style addressing for custom endpoints; the JS SDK
    // always uses virtual-host style unless told otherwise, which breaks RustFS/MinIO.
    ...(settings.s3EndpointUrl ? { endpoint: settings.s3EndpointUrl, forcePathStyle: true } : {}),
    ...(settings.awsDefaultRegion ? { region: settings.awsDefaultRegion } : {}),
    ...envCredentials(),
  });
  return s3;
}

export function getSqsClient(): SQSClient {
  sqs ??= new SQSClient({
    ...(settings.sqsEndpointUrl ? { endpoint: settings.sqsEndpointUrl } : {}),
    ...(settings.awsDefaultRegion ? { region: settings.awsDefaultRegion } : {}),
    ...envCredentials(),
  });
  return sqs;
}

export function resetClients(): void {
  s3?.destroy();
  sqs?.destroy();
  s3 = undefined;
  sqs = undefined;
}
