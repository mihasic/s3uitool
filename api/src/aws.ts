import { S3Client } from "@aws-sdk/client-s3";
import { SQSClient } from "@aws-sdk/client-sqs";
import { settings } from "./config";

/**
 * Pin env credentials. The JS provider chain prefers `AWS_PROFILE` over them, so a
 * developer machine would otherwise sign against a real account, not the emulator.
 */
function envCredentials() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) return {};
  // An empty token would be sent as a blank x-amz-security-token header.
  const sessionToken = process.env.AWS_SESSION_TOKEN || undefined;
  return { credentials: { accessKeyId, secretAccessKey, ...(sessionToken ? { sessionToken } : {}) } };
}

let s3: S3Client | undefined;
let sqs: SQSClient | undefined;

/** Cached: clients are reusable and hold the connection pool. */
export function getS3Client(): S3Client {
  s3 ??= new S3Client({
    // The SDK defaults to virtual-host addressing, which breaks RustFS/MinIO.
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
