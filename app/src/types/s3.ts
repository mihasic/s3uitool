export interface S3Object {
  Key: string;
  LastModified: string;
  ETag: string;
  Size: number;
  StorageClass: string;
}

export interface CommonPrefix {
  Prefix: string;
}

export interface ObjectListResponse {
  Objects: S3Object[];
  CommonPrefixes: CommonPrefix[];
  Prefix: string;
  NextContinuationToken?: string;
  IsTruncated?: boolean;
}

export interface Bucket {
  Name: string;
  CreationDate: string;
}

export interface Queue {
  Url: string;
  Name: string;
  Available: number | null;
  InFlight: number | null;
  Delayed: number | null;
}

export interface Message {
  MessageId: string;
  ReceiptHandle: string;
  Body: string;
  MD5OfBody: string;
  Attributes?: Record<string, string>;
}

export interface TableItem {
  key: string;
  type: "file" | "folder";
  name: string;
  depth: number;
  size?: number;
  lastModified?: string;
  etag?: string;
  isExpanded?: boolean;
}

export type ViewMode = "folder" | "tree" | "flat";
