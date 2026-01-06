import { ArrowLeft, FilePlus, RefreshCw, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { getParentPrefix } from "@/lib/file-utils";

interface ObjectBrowserToolbarProps {
  bucket: string;
  prefix: string;
  onNewFile: () => void;
  onUpload: () => void;
  onRefresh: () => void;
}

export function ObjectBrowserToolbar({ bucket, prefix, onNewFile, onUpload, onRefresh }: ObjectBrowserToolbarProps) {
  const parts = prefix.split("/").filter(Boolean);
  let accumulatedPath = "";

  return (
    <div className="flex items-center gap-4 mb-6">
      <Button variant="outline" size="icon" asChild>
        <Link to={prefix ? `/s3/${bucket}?prefix=${getParentPrefix(prefix)}` : "/s3"}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>
      <Button variant="outline" size="icon" onClick={onRefresh} title="Refresh">
        <RefreshCw className="h-4 w-4" />
      </Button>
      <h1 className="text-2xl font-bold flex items-center">
        <Link to={`/s3/${bucket}`} className="hover:underline">
          {bucket}
        </Link>
        {parts.map((part) => {
          accumulatedPath += part + "/";
          return (
            <Fragment key={accumulatedPath}>
              <span className="mx-2 text-muted-foreground">/</span>
              <Link
                to={`/s3/${bucket}?prefix=${encodeURIComponent(accumulatedPath)}`}
                className="hover:underline"
              >
                {part}
              </Link>
            </Fragment>
          );
        })}
      </h1>
      <div className="ml-auto flex gap-2">
        <Button onClick={onNewFile}>
          <FilePlus className="mr-2 h-4 w-4" />
          New File
        </Button>
        <Button onClick={onUpload}>
          <Upload className="mr-2 h-4 w-4" />
          Upload
        </Button>
      </div>
    </div>
  );
}
