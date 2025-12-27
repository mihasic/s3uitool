import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CopyMoveModal } from "@/components/CopyMoveModal";
import { FileViewer } from "@/components/FileViewer";
import { NewFileModal } from "@/components/NewFileModal";
import { ObjectBrowserToolbar } from "@/components/ObjectBrowserToolbar";
import { ObjectListTable } from "@/components/ObjectListTable";
import { UploadModal } from "@/components/UploadModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { getLanguageFromFilename, IMAGE_EXTENSIONS } from "@/lib/file-utils";
import type { ObjectListResponse } from "@/types/s3";

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
  const [newFileModalOpen, setNewFileModalOpen] = useState(false);

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
      if (selectedFile || copyMoveModalOpen || uploadModalOpen || newFileModalOpen) return; // Disable if modal is open

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
    newFileModalOpen,
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

  const handleCreateFile = (key: string) => {
    setSelectedFile({
      key,
      content: "{}",
      isImage: false,
    });
  };

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

  if (loading) return <div className="p-6">Loading objects...</div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;
  if (!data || !bucket) return null;

  return (
    <div className="p-6">
      <ObjectBrowserToolbar
        bucket={bucket}
        prefix={prefix}
        onNewFile={() => setNewFileModalOpen(true)}
        onUpload={() => setUploadModalOpen(true)}
      />

      <ObjectListTable
        data={data}
        bucket={bucket}
        selectedIndex={selectedIndex}
        onView={handleView}
        onDownload={handleDownload}
        onCopy={handleCopy}
        onMove={handleMove}
        onDelete={handleDelete}
      />

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

      <NewFileModal
        isOpen={newFileModalOpen}
        onClose={() => setNewFileModalOpen(false)}
        onCreate={handleCreateFile}
        currentPrefix={prefix}
      />
    </div>
  );
}
