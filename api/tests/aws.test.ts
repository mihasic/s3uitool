import { describe, expect, test } from "bun:test";
import { getS3Client, getSqsClient } from "../src/aws";

describe("aws clients", () => {
  test("address S3 path-style", () => {
    // The SDK defaults to virtual-host addressing, which breaks RustFS/MinIO.
    expect(getS3Client().config.forcePathStyle).toBe(true);
  });

  test("sign with the env credentials, not the provider chain", async () => {
    // With AWS_PROFILE exported the chain would prefer it and sign against a real account.
    for (const client of [getS3Client(), getSqsClient()]) {
      const credentials = await client.config.credentials();
      expect(credentials.accessKeyId).toBe(process.env.AWS_ACCESS_KEY_ID as string);
      expect(credentials.secretAccessKey).toBe(process.env.AWS_SECRET_ACCESS_KEY as string);
    }
  });
});
