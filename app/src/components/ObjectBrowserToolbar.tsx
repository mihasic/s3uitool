import { ArrowLeft, ChevronLeft, ChevronRight, FilePlus, MoreHorizontal, RefreshCw, Upload } from "lucide-react";
import { Fragment } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getParentPrefix } from "@/lib/file-utils";

interface ObjectBrowserToolbarProps {
  bucket: string;
  prefix: string;
  onNewFile: () => void;
  onUpload: () => void;
  onRefresh: () => void;
  autoExpand: boolean;
  onToggleAutoExpand: (checked: boolean) => void;
  filterText: string;
  onFilterChange: (val: string) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  pageTokens: (string | null)[];
  pageSize: number;
  onPageSizeChange: (size: number) => void;
}

const generatePaginationItems = (current: number, total: number) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);

  const items: (number | "ellipsis")[] = [0];

  if (current <= 3) {
    // Near start: 1, 2, 3, 4, 5, ..., N
    items.push(1, 2, 3, 4);
    items.push("ellipsis");
  } else if (current >= total - 4) {
    // Near end: 1, ..., N-4, N-3, N-2, N-1, N
    items.push("ellipsis");
    items.push(total - 5, total - 4, total - 3, total - 2);
  } else {
    // Middle: 1, ..., n-1, n, n+1, ..., N
    items.push("ellipsis");
    items.push(current - 1, current, current + 1);
    items.push("ellipsis");
  }

  items.push(total - 1);
  return items;
};

export function ObjectBrowserToolbar({
  bucket,
  prefix,
  onNewFile,
  onUpload,
  onRefresh,
  autoExpand,
  onToggleAutoExpand,
  filterText,
  onFilterChange,
  currentPage,
  onPageChange,
  pageTokens,
  pageSize,
  onPageSizeChange,
}: ObjectBrowserToolbarProps) {
  const parts = prefix.split("/").filter(Boolean);

  return (
    <div className="flex flex-col gap-4 mb-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link to={prefix ? `/s3/${bucket}?prefix=${getParentPrefix(prefix)}` : "/s3"}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Button variant="outline" size="icon" onClick={onRefresh} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold flex flex-wrap items-center">
          <Link to={`/s3/${bucket}`} className="hover:underline">
            {bucket}
          </Link>
          {parts.map((part, index) => {
            const currentPath = `${parts.slice(0, index + 1).join("/")}/`;
            return (
              <Fragment key={currentPath}>
                <span className="mx-2 text-muted-foreground">/</span>
                <Link to={`/s3/${bucket}?prefix=${encodeURIComponent(currentPath)}`} className="hover:underline">
                  {part}
                </Link>
              </Fragment>
            );
          })}
        </h1>
      </div>

      <div className="flex items-center gap-4 justify-between">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Label htmlFor="filter" className="sr-only">
            Filter
          </Label>
          <Input
            id="filter"
            placeholder="Filter files..."
            value={filterText}
            onChange={(e) => onFilterChange(e.target.value)}
            className="h-8"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 mr-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {generatePaginationItems(currentPage, pageTokens.length).map((item, idx) =>
              item === "ellipsis" ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: Ellipsis are safe to index
                <div key={`ellipsis-${idx}`} className="flex items-center justify-center w-8 h-8">
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </div>
              ) : (
                <Button
                  key={item}
                  variant={currentPage === item ? "default" : "ghost"}
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => onPageChange(item)}
                >
                  {item + 1}
                </Button>
              ),
            )}

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= pageTokens.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 mr-4">
            <Label htmlFor="page-size" className="whitespace-nowrap text-sm">
              Rows:
            </Label>
            <select
              id="page-size"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {[5, 10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch id="auto-expand" checked={autoExpand} onCheckedChange={onToggleAutoExpand} />
            <Label htmlFor="auto-expand">Auto-expand</Label>
          </div>
          <Button onClick={onNewFile} size="sm" variant="outline">
            <FilePlus className="h-4 w-4 mr-2" />
            New File
          </Button>
          <Button onClick={onUpload} size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </Button>
        </div>
      </div>
    </div>
  );
}
