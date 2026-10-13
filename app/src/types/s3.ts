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
