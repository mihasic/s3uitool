import { describe, expect, test } from "bun:test";
import { getS3Client, getSqsClient } from "../src/aws";
import { getRegistry, type Profile } from "../src/profiles";

const { profiles, defaultId } = await getRegistry(true);
const byId = (id: string) => profiles.find((p) => p.id === id) as Profile;
const defaultProfile = byId(defaultId);
const altProfile = byId("alt");

describe("aws clients", () => {
  test("address S3 path-style", () => {
    // The SDK defaults to virtual-host addressing, which breaks RustFS/MinIO.
    expect(getS3Client(defaultProfile).config.forcePathStyle).toBe(true);
  });

  test("sign with the profile's credentials, not the provider chain", async () => {
    // With AWS_PROFILE exported the chain would prefer it and sign against a real account.
    for (const client of [getS3Client(defaultProfile), getSqsClient(defaultProfile)]) {
      const credentials = await client.config.credentials();
      expect(credentials.accessKeyId).toBe(process.env.AWS_ACCESS_KEY_ID as string);
      expect(credentials.secretAccessKey).toBe(process.env.AWS_SECRET_ACCESS_KEY as string);
    }
  });

  test("cache one client per profile", () => {
    expect(getS3Client(defaultProfile)).toBe(getS3Client(defaultProfile));
    expect(getS3Client(altProfile)).not.toBe(getS3Client(defaultProfile));
    expect(getSqsClient(altProfile)).not.toBe(getSqsClient(defaultProfile));
  });

  test("rebuild a client when the profile's resolved shape changes", () => {
    const before = getS3Client(altProfile);
    const moved: Profile = { ...altProfile, s3Endpoint: "http://localhost:19999", fingerprint: "changed" };
    expect(getS3Client(moved)).not.toBe(before);
  });
});
