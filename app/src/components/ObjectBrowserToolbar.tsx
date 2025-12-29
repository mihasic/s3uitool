import { ArrowLeft, FilePlus, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getParentPrefix } from "@/lib/file-utils";

interface ObjectBrowserToolbarProps {
  bucket: string;
  prefix: string;
  onNewFile: () => void;
  onUpload: () => void;
}

export function ObjectBrowserToolbar({ bucket, prefix, onNewFile, onUpload }: ObjectBrowserToolbarProps) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <Button variant="outline" size="icon" asChild>
        <Link to={prefix ? `/s3/${bucket}?prefix=${getParentPrefix(prefix)}` : "/s3"}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>
      <h1 className="text-2xl font-bold">
        <Link to="/s3" className="hover:underline text-muted-foreground">
          Buckets
        </Link>
        <span className="mx-2 text-muted-foreground">/</span>
        {bucket}
        <span className="mx-2 text-muted-foreground">/</span>
        {prefix}
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
