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

