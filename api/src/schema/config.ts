import { z } from "zod";

const profileSourceModel = z.enum(["env", "ambient", "ini"]);

const publicProfileModel = z.object({
  id: z.string(),
  label: z.string(),
  source: profileSourceModel,
  region: z.string().optional(),
  s3: z.boolean(),
  sqs: z.boolean(),
});

export const appConfigModel = z.object({
  defaultProfile: z.string(),
  profiles: z.array(publicProfileModel).min(1),
});

export const identityModel = z.object({
  available: z.boolean(),
  accountId: z.string().nullable(),
  arn: z.string().nullable(),
  userId: z.string().nullable(),
  reason: z.string().optional(),
});

export type ProfileSource = z.output<typeof profileSourceModel>;
export type PublicProfile = z.output<typeof publicProfileModel>;
export type AppConfig = z.output<typeof appConfigModel>;
export type Identity = z.output<typeof identityModel>;
