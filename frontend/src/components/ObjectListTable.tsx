import { ArrowRight, Copy, Download, Eye, File, Folder, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IMAGE_EXTENSIONS, VIEWABLE_EXTENSIONS } from "@/lib/file-utils";
import type { ObjectListResponse } from "@/types/s3";

interface ObjectListTableProps {
  data: ObjectListResponse;
  bucket: string;
  selectedIndex: number;
  onView: (key: string) => void;
  onDownload: (key: string) => void;
  onCopy: (key: string) => void;
  onMove: (key: string) => void;
  onDelete: (key: string) => void;
}

export function ObjectListTable({
  data,
  bucket,
  selectedIndex,
  onView,
  onDownload,
  onCopy,
  onMove,
  onDelete,
}: ObjectListTableProps) {
  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  };

  const handleFileClick = (key: string) => {
    const ext = key.split(".").pop()?.toLowerCase();
    if (ext && (VIEWABLE_EXTENSIONS.has(ext) || IMAGE_EXTENSIONS.has(ext))) {
      onView(key);
    } else {
      onDownload(key);
    }
  };

  return (
    <div className="rounded-md border">
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
          {data.CommonPrefixes.map((p, index) => {
            const folderName = p.Prefix.split("/").filter(Boolean).pop() || "";
            const isSelected = index === selectedIndex;
            return (
              <TableRow key={p.Prefix} className={isSelected ? "bg-muted" : ""}>
                <TableCell>
                  <Folder className="h-4 w-4 text-blue-500" />
                </TableCell>
                <TableCell>
                  <Link
                    to={`/s3/${bucket}?prefix=${encodeURIComponent(p.Prefix)}`}
                    className="font-medium hover:underline text-blue-600"
                  >
                    {folderName}/
                  </Link>
                </TableCell>
                <TableCell>-</TableCell>
                <TableCell>-</TableCell>
                <TableCell>-</TableCell>
                <TableCell />
              </TableRow>
            );
          })}
          {data.Objects.map((obj, index) => {
            const fileName = obj.Key.split("/").pop() || obj.Key;
            const globalIndex = data.CommonPrefixes.length + index;
            const isSelected = globalIndex === selectedIndex;
            return (
              <TableRow key={obj.Key} className={isSelected ? "bg-muted" : ""}>
                <TableCell>
                  <File className="h-4 w-4 text-gray-500" />
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => handleFileClick(obj.Key)}
                    className="font-medium hover:underline text-left"
                  >
                    {fileName}
                  </button>
                </TableCell>
                <TableCell>{formatSize(obj.Size)}</TableCell>
                <TableCell>{new Date(obj.LastModified).toLocaleString()}</TableCell>
                <TableCell className="font-mono text-xs">{obj.ETag.replace(/"/g, "")}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => onView(obj.Key)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDownload(obj.Key)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onCopy(obj.Key)} title="Copy">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onMove(obj.Key)} title="Move">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(obj.Key)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {data.Objects.length === 0 && data.CommonPrefixes.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                No objects found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
