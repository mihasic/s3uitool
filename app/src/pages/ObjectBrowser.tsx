import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { CopyMoveModal } from "@/components/CopyMoveModal";
import { FilePreviewDialog } from "@/components/FilePreviewDialog";
import { NewFileModal } from "@/components/NewFileModal";
import { ObjectBrowserToolbar } from "@/components/ObjectBrowserToolbar";
import { ObjectListTable } from "@/components/ObjectListTable";
import { UploadModal } from "@/components/UploadModal";
import { useObjectBrowser } from "@/hooks/useObjectBrowser";
import { api } from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";
import { IMAGE_EXTENSIONS } from "@/lib/file-utils";

export function ObjectBrowser() {
  const { bucket } = useParams<{ bucket: string }>();
  const [searchParams] = useSearchParams();
  const prefix = searchParams.get("prefix") || "";

  const {
    items,
    loading,
    error,
    viewMode,
    setViewMode,
    refresh,
    toggleFolder,
    filterText,
    setFilterText,
    currentPage,
    setCurrentPage,
    pageTokens,
    pageSize,
    setPageSize,
  } = useObjectBrowser(bucket, prefix);

  const [selectedFile, setSelectedFile] = useState<{
    key: string;
    content: string;
    isImage?: boolean;
    isPdf?: boolean;
    isDocx?: boolean;
  } | null>(null);

  const [copyMoveModalOpen, setCopyMoveModalOpen] = useState(false);
  const [copyMoveAction, setCopyMoveAction] = useState<"copy" | "move">("copy");
  const [copyMoveSourceKey, setCopyMoveSourceKey] = useState("");
  const [copyMoveIsFolder, setCopyMoveIsFolder] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [newFileModalOpen, setNewFileModalOpen] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);

  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const navigate = useNavigate();

  // Keep keyboard selection index valid when the visible item set changes.
  useEffect(() => {
    setSelectedIndex((prev) => {
      if (items.length === 0) return -1;
      return prev >= items.length ? items.length - 1 : prev;
    });
  }, [items]);

  const handleView = useCallback(
    async (key: string) => {
      if (!bucket) return;
      const ext = key.split(".").pop()?.toLowerCase();

      if (ext && IMAGE_EXTENSIONS.has(ext)) {
        setSelectedFile({
          key,
          content: `${API_BASE_URL}/s3/buckets/${bucket}/download/${encodeURIComponent(key)}?inline=true`,
          isImage: true,
        });
        return;
      }

      if (ext === "pdf") {
        setSelectedFile({
          key,
          content: `${API_BASE_URL}/s3/buckets/${bucket}/download/${encodeURIComponent(key)}?inline=true`,
          isImage: false,
          isPdf: true,
        });
        return;
      }

      if (ext === "docx") {
        setSelectedFile({
          key,
          content: `${API_BASE_URL}/s3/buckets/${bucket}/download/${encodeURIComponent(key)}`,
          isImage: false,
          isPdf: false,
          isDocx: true,
        });
        return;
      }

      try {
        const response = await api.get<{ Content: string | null; ContentType: string }>(
          `s3/buckets/${bucket}/objects/${encodeURIComponent(key)}`,
        );

        if (response.ContentType?.toLowerCase().startsWith("image/")) {
          setSelectedFile({
            key,
            content: `${API_BASE_URL}/s3/buckets/${bucket}/download/${encodeURIComponent(key)}?inline=true`,
            isImage: true,
          });
          return;
        }

        if (response.Content !== null) {
          setSelectedFile({ key, content: response.Content, isImage: false });
        } else {
          toast.error("Binary file or empty content");
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load file");
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
        refresh();
      } catch (err) {
        console.error(err);
        toast.error("Failed to delete file");
      }
    },
    [bucket, refresh],
  );

  const handleDeleteFolder = useCallback(
    async (folderPrefix: string) => {
      if (!bucket || !confirm(`Are you sure you want to delete folder ${folderPrefix} and all its contents?`)) return;
      try {
        await api.post(`s3/buckets/${bucket}/delete-prefix`, { prefix: folderPrefix });
        toast.success("Folder deleted successfully");
        refresh();
      } catch (err) {
        console.error(err);
        toast.error("Failed to delete folder");
      }
    },
    [bucket, refresh],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedFile || copyMoveModalOpen || uploadModalOpen || newFileModalOpen) return;

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
            navigate(`/s3/${bucket}?prefix=${encodeURIComponent(item.key)}`);
          } else {
            handleView(item.key);
          }
        }
      } else if (e.key === "ArrowRight") {
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          const item = items[selectedIndex];
          if (item.type === "folder" && !item.isExpanded) {
            toggleFolder(item.key);
          }
        }
      } else if (e.key === "ArrowLeft") {
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          const item = items[selectedIndex];
          if (item.type === "folder" && item.isExpanded) {
            toggleFolder(item.key);
          }
        }
      } else if (e.key === "Delete") {
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          const item = items[selectedIndex];
          if (item.type === "file") {
            handleDelete(item.key);
          } else if (item.type === "folder") {
            handleDeleteFolder(item.key);
          }
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
    handleDeleteFolder,
    handleView,
    toggleFolder,
  ]);

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
      refresh();
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
      refresh();
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload file");
      throw err; // Re-throw to let modal know it failed
    }
  };

  const handleCopy = (key: string) => {
    setCopyMoveSourceKey(key);
    setCopyMoveAction("copy");
    setCopyMoveIsFolder(false);
    setCopyMoveModalOpen(true);
  };

  const handleMove = (key: string) => {
    setCopyMoveSourceKey(key);
    setCopyMoveAction("move");
    setCopyMoveIsFolder(false);
    setCopyMoveModalOpen(true);
  };

  const handleCopyFolder = (prefix: string) => {
    setCopyMoveSourceKey(prefix);
    setCopyMoveAction("copy");
    setCopyMoveIsFolder(true);
    setCopyMoveModalOpen(true);
  };

  const handleMoveFolder = (prefix: string) => {
    setCopyMoveSourceKey(prefix);
    setCopyMoveAction("move");
    setCopyMoveIsFolder(true);
    setCopyMoveModalOpen(true);
  };

  const handleCopyMoveConfirm = async (destinationKey: string) => {
    if (!bucket) return;
    try {
      if (copyMoveIsFolder) {
        // Ensure destination folder ends with /
        const dest = destinationKey.endsWith("/") ? destinationKey : `${destinationKey}/`;

        await api.post("s3/copy-prefix", {
          source_bucket: bucket,
          source_prefix: copyMoveSourceKey,
          destination_bucket: bucket,
          destination_prefix: dest,
          move: copyMoveAction === "move",
        });
      } else {
        await api.post("s3/copy", {
          source_bucket: bucket,
          source_key: copyMoveSourceKey,
          destination_bucket: bucket,
          destination_key: destinationKey,
          move: copyMoveAction === "move",
        });
      }

      refresh();
      const type = copyMoveIsFolder ? "Folder" : "File";
      toast.success(`${type} ${copyMoveAction === "copy" ? "copied" : "moved"} successfully`);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to ${copyMoveAction} ${copyMoveIsFolder ? "folder" : "file"}`);
    }
  };

  const handleDownload = (key: string) => {
    if (!bucket) return;
    // Direct download link
    window.open(`${API_BASE_URL}/s3/buckets/${bucket}/download/${encodeURIComponent(key)}`, "_blank");
  };

  const handleDownloadFolder = (prefix: string) => {
    if (!bucket) return;
    window.open(`${API_BASE_URL}/s3/buckets/${bucket}/download-prefix?prefix=${encodeURIComponent(prefix)}`, "_blank");
  };

  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;
  if (!bucket) return null;

  return (
    <div className="p-6">
      <ObjectBrowserToolbar
        bucket={bucket}
        prefix={prefix}
        onNewFile={() => setNewFileModalOpen(true)}
        onUpload={() => {
          setDroppedFile(null);
          setUploadModalOpen(true);
        }}
        onRefresh={refresh}
        viewMode={viewMode}
        setViewMode={setViewMode}
        filterText={filterText}
        onFilterChange={setFilterText}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        pageTokens={pageTokens}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
      />

      <ObjectListTable
        items={items}
        loading={loading}
        bucket={bucket}
        selectedIndex={selectedIndex}
        onView={handleView}
        onDownload={handleDownload}
        onCopy={handleCopy}
        onMove={handleMove}
        onDelete={handleDelete}
        onDeleteFolder={handleDeleteFolder}
        onCopyFolder={handleCopyFolder}
        onMoveFolder={handleMoveFolder}
        onDownloadFolder={handleDownloadFolder}
        onToggleFolder={toggleFolder}
        onFileDrop={(file) => {
          setDroppedFile(file);
          setUploadModalOpen(true);
        }}
        viewMode={viewMode}
      />

      <FilePreviewDialog
        file={selectedFile}
        isOpen={!!selectedFile}
        onClose={() => setSelectedFile(null)}
        onSave={handleSave}
      />

      <CopyMoveModal
        isOpen={copyMoveModalOpen}
        onClose={() => setCopyMoveModalOpen(false)}
        onConfirm={handleCopyMoveConfirm}
        sourceKey={copyMoveSourceKey}
        action={copyMoveAction}
      />

      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => {
          setUploadModalOpen(false);
          setDroppedFile(null);
        }}
        onUpload={handleUpload}
        currentPrefix={prefix}
        initialFile={droppedFile}
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
