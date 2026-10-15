import { z } from "zod";
import { dateTime, nullable, stringMap } from "./common";

export const bucketModel = z.object({
  Name: z.string().default(""),
  CreationDate: dateTime,
});

export const s3ObjectModel = z.object({
  Key: z.string().default(""),
  LastModified: dateTime,
  ETag: z.string().default(""),
  Size: z.number().default(0),
  StorageClass: nullable(z.string()),
});

export const s3ObjectContentModel = s3ObjectModel.extend({
  ContentType: nullable(z.string()),
  Metadata: nullable(stringMap),
  Content: nullable(z.string()),
});

const commonPrefixModel = z.object({ Prefix: z.string().default("") });

export const objectListModel = z.object({
  Objects: z.array(s3ObjectModel),
  CommonPrefixes: z.array(commonPrefixModel).default([]),
  Prefix: z.string(),
  NextContinuationToken: nullable(z.string()),
  IsTruncated: z.boolean().default(false),
});

export const objectListQueryModel = z.object({
  prefix: z.string().default(""),
  continuation_token: z.string().optional(),
  max_keys: z.coerce.number<number>().int().positive().default(1000).catch(1000),
  filter_text: z.string().optional(),
  delimiter: z.string().optional(),
});

export const uploadFormModel = z.object({ file: z.instanceof(File) });

export const downloadQueryModel = z.object({ inline: z.stringbool().default(false) });

export const deletePrefixRequestModel = z.object({ prefix: z.string() });

const copyBase = z.object({
  source_bucket: z.string().min(1),
  destination_bucket: z.string().min(1),
  move: z.boolean().optional(),
});

export const copyRequestModel = copyBase.extend({
  source_key: z.string().min(1),
  destination_key: z.string().min(1),
});

export const copyPrefixRequestModel = copyBase.extend({
  source_prefix: z.string(),
  destination_prefix: z.string(),
});

export const downloadPrefixQueryModel = objectListQueryModel.pick({ prefix: true });

export type Bucket = z.output<typeof bucketModel>;
export type S3Object = z.output<typeof s3ObjectModel>;
export type S3ObjectContent = z.output<typeof s3ObjectContentModel>;
export type ObjectList = z.output<typeof objectListModel>;
export type ObjectListInput = z.input<typeof objectListModel>;
export type ObjectListQuery = z.output<typeof objectListQueryModel>;
export type ObjectListParams = z.input<typeof objectListQueryModel>;
export type DeletePrefixRequest = z.input<typeof deletePrefixRequestModel>;
export type CopyRequest = z.input<typeof copyRequestModel>;
export type CopyPrefixRequest = z.input<typeof copyPrefixRequestModel>;
