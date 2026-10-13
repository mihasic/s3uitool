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

export const commonPrefixModel = z.object({ Prefix: z.string().default("") });

export const objectListModel = z.object({
  Objects: z.array(s3ObjectModel),
  CommonPrefixes: z.array(commonPrefixModel).default([]),
  Prefix: z.string(),
  NextContinuationToken: nullable(z.string()),
  IsTruncated: z.boolean().default(false),
});

export const objectListBatchModel = z.record(z.string(), objectListModel);

export const prefixParamsModel = z.object({
  prefix: z.string(),
  continuation_token: z.string().nullish(),
  max_keys: z.number().int().positive().optional(),
  filter_text: z.string().nullish(),
  delimiter: z.string().optional(),
});

export const objectListQueryModel = z.object({
  prefix: z.string().default(""),
  continuation_token: z.string().optional(),
  max_keys: z.coerce.number().int().positive().catch(1000),
  filter_text: z.string().optional(),
  delimiter: z.string().optional(),
});

export const objectListBatchRequestModel = z.object({
  requests: z.array(prefixParamsModel).default([]),
});

export const deletePrefixRequestModel = z.object({ prefix: z.string() });

export const copyRequestModel = z.object({
  source_bucket: z.string().min(1),
  source_key: z.string().min(1),
  destination_bucket: z.string().min(1),
  destination_key: z.string().min(1),
  move: z.boolean().optional(),
});

export const copyPrefixRequestModel = z.object({
  source_bucket: z.string().min(1),
  source_prefix: z.string(),
  destination_bucket: z.string().min(1),
  destination_prefix: z.string(),
  move: z.boolean().optional(),
});

export const downloadPrefixQueryModel = z.object({ prefix: z.string().default("") });

export type Bucket = z.output<typeof bucketModel>;
export type S3Object = z.output<typeof s3ObjectModel>;
export type S3ObjectContent = z.output<typeof s3ObjectContentModel>;
export type CommonPrefix = z.output<typeof commonPrefixModel>;
export type ObjectList = z.output<typeof objectListModel>;
export type ObjectListBatch = z.output<typeof objectListBatchModel>;
export type PrefixParams = z.input<typeof prefixParamsModel>;
export type ObjectListBatchRequest = z.input<typeof objectListBatchRequestModel>;
export type DeletePrefixRequest = z.input<typeof deletePrefixRequestModel>;
export type CopyRequest = z.input<typeof copyRequestModel>;
export type CopyPrefixRequest = z.input<typeof copyPrefixRequestModel>;
