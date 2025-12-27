import { ArrowLeft, ArrowRight, Copy, Download, Eye, File, Folder, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CopyMoveModal } from "@/components/CopyMoveModal";
import { FileViewer } from "@/components/FileViewer";
import { UploadModal } from "@/components/UploadModal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";

const VIEWABLE_EXTENSIONS = new Set([
  "txt",
  "md",
  "json",
  "js",
  "ts",
  "tsx",
  "jsx",
  "html",
  "css",
  "scss",
  "less",
  "py",
  "java",
  "c",
  "cpp",
  "h",
  "hpp",
  "go",
  "rs",
  "rb",
  "php",
  "sh",
  "bash",
  "zsh",
  "yaml",
  "yml",
  "xml",
  "sql",
  "ini",
  "conf",
  "properties",
  "log",
  "csv",
  "ps1",
  "htm",
  "sass",
  "rst",
  "xaml",
  "cs",
]);

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "ico"]);

const getLanguageFromFilename = (filename: string): string => {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js":
    case "jsx":
      return "javascript";
    case "ts":
    case "tsx":
      return "typescript";
    case "py":
      return "python";
    case "md":
      return "markdown";
    case "sh":
    case "bash":
    case "zsh":
      return "shell";
    case "yml":
    case "yaml":
      return "yaml";
    case "json":
      return "json";
    case "html":
    case "htm":
      return "html";
    case "css":
      return "css";
    case "scss":
    case "sass":
    case "less":
      return "scss";
    case "sql":
      return "sql";
    case "xml":
    case "xaml":
      return "xml";
    case "cs":
      return "csharp";
    case "ps1":
      return "powershell";
    case "rst":
      return "restructuredtext";
    default:
      return "plaintext";
  }
};

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

  const [selectedFile, setSelectedFile] = useState<{ key: string; content: string; isImage?: boolean } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_viewLoading, setViewLoading] = useState(false);

  const [copyMoveModalOpen, setCopyMoveModalOpen] = useState(false);
  const [copyMoveAction, setCopyMoveAction] = useState<"copy" | "move">("copy");
  const [copyMoveSourceKey, setCopyMoveSourceKey] = useState("");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const navigate = useNavigate();

  const items = useMemo(() => {
    if (!data) return [];
    return [
      ...data.CommonPrefixes.map((p) => ({ type: "folder" as const, ...p })),
      ...data.Objects.map((o) => ({ type: "file" as const, ...o })),
    ];
  }, [data]);

  const handleView = useCallback(
    async (key: string) => {
      if (!bucket) return;
      const ext = key.split(".").pop()?.toLowerCase();

      if (ext && IMAGE_EXTENSIONS.has(ext)) {
        setSelectedFile({
          key,
          content: `${import.meta.env.VITE_API_URL || "/api"}/s3/buckets/${bucket}/download/${encodeURIComponent(key)}?inline=true`,
          isImage: true,
        });
        return;
      }

      setViewLoading(true);
      try {
        const response = await api.get<{ Content: string | null; ContentType: string }>(
          `s3/buckets/${bucket}/objects/${encodeURIComponent(key)}`,
        );
        if (response.Content !== null) {
          setSelectedFile({ key, content: response.Content, isImage: false });
        } else {
          toast.error("Binary file or empty content");
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load file");
      } finally {
        setViewLoading(false);
      }
    },
    [bucket],
  );

  const handleDelete = useCallback(
    async (key: string) => {
      if (!bucket || !confirm(`Are you sure you want to delete ${key}?`)) return;
      try {
        await api.delete(`s3/buckets/${bucket}/objects/${encodeURIComponent(key)}`);

        toast.success("File deleted successfully");
        // Refresh list
        setLoading(true);
        api
          .get<ObjectListResponse>(`s3/buckets/${bucket}/objects?prefix=${encodeURIComponent(prefix)}`)
          .then(setData)
          .catch((err) => setError(err.message))
          .finally(() => setLoading(false));
      } catch (err) {
        console.error(err);
        toast.error("Failed to delete file");
      }
    },
    [bucket, prefix],
  );

  useEffect(() => {
    setSelectedIndex(-1);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedFile || copyMoveModalOpen || uploadModalOpen) return; // Disable if modal is open

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          const item = items[selectedIndex];
          if (item.type === "folder") {
            navigate(`/s3/${bucket}?prefix=${encodeURIComponent(item.Prefix)}`);
          } else {
            handleView(item.Key);
          }
        }
      } else if (e.key === "Delete") {
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          const item = items[selectedIndex];
          if (item.type === "file") {
            handleDelete(item.Key);
          }
          // TODO: Handle folder delete if implemented
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    items,
    selectedIndex,
    selectedFile,
    copyMoveModalOpen,
    uploadModalOpen,
    bucket,
    navigate,
    handleDelete,
    handleView,
  ]);

  useEffect(() => {
    if (!bucket) return;

    setLoading(true);
    api
      .get<ObjectListResponse>(`s3/buckets/${bucket}/objects?prefix=${encodeURIComponent(prefix)}`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [bucket, prefix]);

  const handleSave = async (newContent: string) => {
    if (!bucket || !selectedFile) return;
    try {
      const formData = new FormData();
      const blob = new Blob([newContent], { type: "text/plain" });
      formData.append("file", blob);

      await api.upload(`s3/buckets/${bucket}/objects/${encodeURIComponent(selectedFile.key)}`, formData);

      toast.success("File saved successfully");
      setSelectedFile(null);
      // Refresh list
      setLoading(true);
      api
        .get<ObjectListResponse>(`s3/buckets/${bucket}/objects?prefix=${encodeURIComponent(prefix)}`)
        .then(setData)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    } catch (err) {
      console.error(err);
      toast.error("Failed to save file");
    }
  };

  const handleUpload = async (file: File, key: string) => {
    if (!bucket) return;
    try {
      const formData = new FormData();
      formData.append("file", file);

      await api.upload(`s3/buckets/${bucket}/objects/${encodeURIComponent(key)}`, formData);

      toast.success("File uploaded successfully");
      // Refresh list
      setLoading(true);
      api
        .get<ObjectListResponse>(`s3/buckets/${bucket}/objects?prefix=${encodeURIComponent(prefix)}`)
        .then(setData)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload file");
      throw err; // Re-throw to let modal know it failed
    }
  };

  const handleCopy = (key: string) => {
    setCopyMoveSourceKey(key);
    setCopyMoveAction("copy");
    setCopyMoveModalOpen(true);
  };

  const handleMove = (key: string) => {
    setCopyMoveSourceKey(key);
    setCopyMoveAction("move");
    setCopyMoveModalOpen(true);
  };

  const handleCopyMoveConfirm = async (destinationKey: string) => {
    if (!bucket) return;
    try {
      await api.post(`s3/copy`, {
        source_bucket: bucket,
        source_key: copyMoveSourceKey,
        destination_bucket: bucket,
        destination_key: destinationKey,
        move: copyMoveAction === "move",
      });

      // Refresh list
      setLoading(true);
      api
        .get<ObjectListResponse>(`s3/buckets/${bucket}/objects?prefix=${encodeURIComponent(prefix)}`)
        .then(setData)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));

      toast.success(`File ${copyMoveAction === "copy" ? "copied" : "moved"} successfully`);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to ${copyMoveAction} file`);
    }
  };

  const handleDownload = (key: string) => {
    if (!bucket) return;
    // Direct download link
    window.open(
      `${import.meta.env.VITE_API_URL || "/api"}/s3/buckets/${bucket}/download/${encodeURIComponent(key)}`,
      "_blank",
    );
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  };

  const getParentPrefix = (currentPrefix: string) => {
    if (!currentPrefix) return "";
    const parts = currentPrefix.split("/").filter(Boolean);
    parts.pop();
    return parts.length > 0 ? `${parts.join("/")}/` : "";
  };

  const handleFileClick = (key: string) => {
    const ext = key.split(".").pop()?.toLowerCase();
    if (ext && (VIEWABLE_EXTENSIONS.has(ext) || IMAGE_EXTENSIONS.has(ext))) {
      handleView(key);
    } else {
      handleDownload(key);
    }
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
          <Link to="/s3" className="hover:underline text-muted-foreground">
            Buckets
          </Link>
          <span className="mx-2 text-muted-foreground">/</span>
          {bucket}
          <span className="mx-2 text-muted-foreground">/</span>
          {prefix}
        </h1>
        <div className="ml-auto">
          <Button onClick={() => setUploadModalOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
        </div>
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
                  <TableCell></TableCell>
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
                      <Button variant="ghost" size="icon" onClick={() => handleView(obj.Key)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDownload(obj.Key)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleCopy(obj.Key)} title="Copy">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleMove(obj.Key)} title="Move">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(obj.Key)}
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

      <Dialog open={!!selectedFile} onOpenChange={(open) => !open && setSelectedFile(null)}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedFile?.key}</DialogTitle>
          </DialogHeader>
          {selectedFile && (
            <div className="flex-1 min-h-0 flex items-center justify-center bg-gray-50 rounded-md overflow-hidden">
              {selectedFile.isImage ? (
                <img
                  src={selectedFile.content}
                  alt={selectedFile.key}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <FileViewer
                  content={selectedFile.content}
                  onSave={handleSave}
                  language={getLanguageFromFilename(selectedFile.key)}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CopyMoveModal
        isOpen={copyMoveModalOpen}
        onClose={() => setCopyMoveModalOpen(false)}
        onConfirm={handleCopyMoveConfirm}
        sourceKey={copyMoveSourceKey}
        action={copyMoveAction}
      />

      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onUpload={handleUpload}
        currentPrefix={prefix}
      />
    </div>
  );
}
