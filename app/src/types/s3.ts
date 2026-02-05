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
