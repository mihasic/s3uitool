import type { S3Object } from "@api/schema/s3";

export type TableItem =
  | { type: "folder"; key: string; name: string; depth: number; isExpanded: boolean }
  | { type: "file"; key: string; name: string; depth: number; object: S3Object };

export type ViewMode = "folder" | "tree" | "flat";

export interface CopyMoveTarget {
  action: "copy" | "move";
  key: string;
  isFolder: boolean;
}

export type PreviewFile =
  | { kind: "image" | "pdf" | "docx"; key: string; url: string }
  | { kind: "text"; key: string; content: string };

export interface CopyMove extends CopyMoveTarget {
  destination: string;
}

export interface PutObject {
  key: string;
  body: Blob;
  verb: "save" | "upload";
}
