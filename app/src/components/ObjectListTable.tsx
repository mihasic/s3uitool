import { ArrowRight, ChevronDown, ChevronRight, Copy, Download, Eye, File, Folder, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IMAGE_EXTENSIONS, TEXTUAL_EXTENSIONS } from "@/lib/file-utils";

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

interface ObjectListTableProps {
  items: TableItem[];
  bucket: string;
  selectedIndex: number;
  onView: (key: string) => void;
  onDownload: (key: string) => void;
  onCopy: (key: string) => void;
  onMove: (key: string) => void;
  onDelete: (key: string) => void;
  onDeleteFolder?: (prefix: string) => void;
  onCopyFolder?: (prefix: string) => void;
  onMoveFolder?: (prefix: string) => void;
  onDownloadFolder?: (prefix: string) => void;
  onToggleFolder: (prefix: string) => void;
  onFileDrop: (file: File) => void;
}

export function ObjectListTable({
  items,
  bucket,
  selectedIndex,
  onView,
  onDownload,
  onCopy,
  onMove,
  onDelete,
  onDeleteFolder,
  onCopyFolder,
  onMoveFolder,
  onDownloadFolder,
  onToggleFolder,
  onFileDrop,
}: ObjectListTableProps) {
  const [isDragging, setIsDragging] = useState(false);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  };

  const isPreviewAvailable = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    return !!(ext && (TEXTUAL_EXTENSIONS.has(ext) || IMAGE_EXTENSIONS.has(ext) || ext === "pdf" || ext === "docx"));
  };

  const handleFileClick = (key: string) => {
    if (isPreviewAvailable(key)) {
      onView(key);
    } else {
      onDownload(key);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      onFileDrop(files[0]);
    }
  };

  return (
    <section
      aria-label="File upload dropzone"
      className={`rounded-md border relative min-h-[100px] ${isDragging ? "border-blue-500" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-blue-50/90 rounded-md border-2 border-dashed border-blue-500 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
          <Upload className="h-12 w-12 mb-3 text-blue-600" />
          <span className="text-xl font-semibold text-blue-600">Drop file to upload</span>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]" />
            <TableHead>Name</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Last Modified</TableHead>
            <TableHead>ETag</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => {
            const isSelected = index === selectedIndex;

            if (item.type === "folder") {
              return (
                <TableRow key={item.key} className={isSelected ? "bg-muted" : ""}>
                  <TableCell>
                    <div className="flex items-center" style={{ paddingLeft: `${item.depth * 20}px` }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          onToggleFolder(item.key);
                        }}
                        className="mr-1 p-0.5 hover:bg-gray-200 rounded"
                      >
                        {item.isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-500" />
                        )}
                      </button>
                      <Folder className="h-4 w-4 text-blue-500 ml-1" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link
                      to={`/s3/${bucket}?prefix=${encodeURIComponent(item.key)}`}
                      className="font-medium hover:underline text-blue-600"
                    >
                      {item.name}/
                    </Link>
                  </TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>-</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                    <div className="w-9 h-9" aria-hidden="true" />
                    {onDownloadFolder && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDownloadFolder(item.key)}
                        title="Download Folder as Zip"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    {onCopyFolder && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onCopyFolder(item.key)}
                        title="Copy Folder"
                      >
                       <Copy className="h-4 w-4" />
                      </Button>
                    )}
                    {onMoveFolder && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onMoveFolder(item.key)}
                        title="Move Folder"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    )}
                    {onDeleteFolder && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteFolder(item.key)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        title="Delete Folder"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            }

            return (
              <TableRow key={item.key} className={isSelected ? "bg-muted" : ""}>
                <TableCell>
                  <div className="flex items-center" style={{ paddingLeft: `${item.depth * 20}px` }}>
                    <div className="w-6 mr-1" /> {/* Spacer for tree alignment */}
                    <File className="h-4 w-4 text-gray-500 ml-1" />
                  </div>
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => handleFileClick(item.key)}
                    className="font-medium hover:underline text-left"
                  >
                    {item.name}
                  </button>
                </TableCell>
                <TableCell>{item.size !== undefined ? formatSize(item.size) : "-"}</TableCell>
                <TableCell>{item.lastModified ? new Date(item.lastModified).toLocaleString() : "-"}</TableCell>
                <TableCell className="font-mono text-xs">{item.etag?.replace(/"/g, "") || "-"}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onView(item.key)}
                      disabled={!isPreviewAvailable(item.key)}
                      title={isPreviewAvailable(item.key) ? "Preview" : "Preview not available"}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDownload(item.key)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onCopy(item.key)} title="Copy">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onMove(item.key)} title="Move">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(item.key)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                No objects found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  );
}
