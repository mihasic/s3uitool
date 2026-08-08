import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type BucketLocationConstraint, CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { CreateQueueCommand, SQSClient } from "@aws-sdk/client-sqs";

// Default to the comparison-stack emulators, but let the environment (e.g. CI) override.
// This must run before importing the app so its SDK clients pick up the endpoints.
// NOTE: 9000/9324 are deliberately avoided — on the dev machine an SSH tunnel owns
// those ports and forwards them to a real AWS account.
process.env.AWS_S3_ENDPOINT_URL ||= "http://localhost:19000";
process.env.AWS_SQS_ENDPOINT_URL ||= "http://localhost:19324";
process.env.AWS_DEFAULT_REGION ||= "eu-west-1";
process.env.AWS_ACCESS_KEY_ID ||= "test";
process.env.AWS_SECRET_ACCESS_KEY ||= "test";

// A stand-in for the built frontend, so the static routes are exercised too.
export const STATIC_FIXTURE = mkdtempSync(join(tmpdir(), "s3uitool-static-"));
mkdirSync(join(STATIC_FIXTURE, "assets"));
writeFileSync(join(STATIC_FIXTURE, "index.html"), "<!doctype html><title>app</title>");
writeFileSync(join(STATIC_FIXTURE, "assets", "app.js"), "export default 1;\n");
process.env.STATIC_DIR ||= STATIC_FIXTURE;

const region = process.env.AWS_DEFAULT_REGION;
// A developer shell may export AWS_PROFILE/AWS_REGION pointing at a real account;
// the JS credential chain would prefer the profile over the env keys set above.
const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
};

const s3 = new S3Client({
  endpoint: process.env.AWS_S3_ENDPOINT_URL || process.env.AWS_ENDPOINT_URL,
  region,
  credentials,
  forcePathStyle: true,
});
const sqs = new SQSClient({
  endpoint: process.env.AWS_SQS_ENDPOINT_URL || process.env.AWS_ENDPOINT_URL,
  region,
  credentials,
});

/** Ensure buckets and queues exist before the suite runs. */
for (const bucket of ["test-bucket-1", "test-bucket-2"]) {
  try {
    await s3.send(
      new CreateBucketCommand({
        Bucket: bucket,
        ...(region === "us-east-1"
          ? {}
          : { CreateBucketConfiguration: { LocationConstraint: region as BucketLocationConstraint } }),
      }),
    );
  } catch {
    // Bucket might exist
  }
}

for (const queue of ["test-queue-1", "test-queue-2"]) {
  try {
    await sqs.send(new CreateQueueCommand({ QueueName: queue }));
  } catch {
    // Queue might exist
  }
}
