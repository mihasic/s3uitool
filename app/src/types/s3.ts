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

export interface CopyMoveTarget {
  action: "copy" | "move";
  key: string;
  isFolder: boolean;
}

export type PreviewFile =
  | { kind: "image" | "pdf" | "docx"; key: string; url: string }
  | { kind: "text"; key: string; content: string };
