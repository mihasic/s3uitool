import { useEffect, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { File, Folder, ArrowLeft, Eye, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileViewer } from "@/components/FileViewer";

interface S3Object {
  Key: string;
  LastModified: string;
  ETag: string;
  Size: number;
  StorageClass: string;
}

interface CommonPrefix {
  Prefix: string;
}

interface ObjectListResponse {
  Objects: S3Object[];
  CommonPrefixes: CommonPrefix[];
  Prefix: string;
}

export function ObjectBrowser() {
  const { bucket } = useParams<{ bucket: string }>();
  const [searchParams] = useSearchParams();
  const prefix = searchParams.get("prefix") || "";
  
  const [data, setData] = useState<ObjectListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<{ key: string; content: string } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [viewLoading, setViewLoading] = useState(false);

  useEffect(() => {
    if (!bucket) return;
    
    setLoading(true);
    api.get<ObjectListResponse>(`s3/buckets/${bucket}/objects?prefix=${encodeURIComponent(prefix)}`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [bucket, prefix]);

  const handleView = async (key: string) => {
    if (!bucket) return;
    setViewLoading(true);
    try {
      const response = await api.get<{ Content: string | null; ContentType: string }>(
        `s3/buckets/${bucket}/objects/${encodeURIComponent(key)}`
      );
      if (response.Content !== null) {
        setSelectedFile({ key, content: response.Content });
      } else {
        alert("Binary file or empty content");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to load file");
    } finally {
      setViewLoading(false);
    }
  };

  const handleDownload = (key: string) => {
    if (!bucket) return;
    // Direct download link
    window.open(`${import.meta.env.VITE_API_URL || "/api"}/s3/buckets/${bucket}/download/${encodeURIComponent(key)}`, "_blank");
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getParentPrefix = (currentPrefix: string) => {
    if (!currentPrefix) return "";
    const parts = currentPrefix.split("/").filter(Boolean);
    parts.pop();
    return parts.length > 0 ? parts.join("/") + "/" : "";
  };

  if (loading) return <div className="p-6">Loading objects...</div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;
  if (!data) return null;

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" asChild>
          <Link to={prefix ? `/s3/${bucket}?prefix=${getParentPrefix(prefix)}` : "/s3"}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">
          <Link to="/s3" className="hover:underline text-muted-foreground">Buckets</Link>
          <span className="mx-2 text-muted-foreground">/</span>
          {bucket}
          <span className="mx-2 text-muted-foreground">/</span>
          {prefix}
        </h1>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Last Modified</TableHead>
              <TableHead>ETag</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.CommonPrefixes.map((p) => {
              const folderName = p.Prefix.split("/").filter(Boolean).pop() || "";
              return (
                <TableRow key={p.Prefix}>
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
                  <TableCell></TableCell>
                </TableRow>
              );
            })}
            {data.Objects.map((obj) => {
              const fileName = obj.Key.split("/").pop() || obj.Key;
              return (
                <TableRow key={obj.Key}>
                  <TableCell>
                    <File className="h-4 w-4 text-gray-500" />
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{fileName}</span>
                  </TableCell>
                  <TableCell>{formatSize(obj.Size)}</TableCell>
                  <TableCell>{new Date(obj.LastModified).toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-xs">{obj.ETag.replace(/"/g, "")}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleView(obj.Key)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDownload(obj.Key)}>
                        <Download className="h-4 w-4" />
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

      <Dialog open={!!selectedFile} onOpenChange={(open) => !open && setSelectedFile(null)}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedFile?.key}</DialogTitle>
          </DialogHeader>
          {selectedFile && (
            <div className="flex-1 min-h-0">
              <FileViewer content={selectedFile.content} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
