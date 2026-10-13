import { z } from "zod";

export const profileSourceModel = z.enum(["env", "ambient", "ini"]);

export const publicProfileModel = z.object({
  id: z.string(),
  label: z.string(),
  source: profileSourceModel,
  region: z.string().optional(),
  s3: z.boolean(),
  sqs: z.boolean(),
});

export const appConfigModel = z.object({
  defaultProfile: z.string(),
  profiles: z.array(publicProfileModel),
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
