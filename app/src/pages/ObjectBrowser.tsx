import type { CopyPrefixRequest, CopyRequest, DeletePrefixRequest, S3ObjectContent } from "@api/schema/s3";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useEffectEvent, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { CopyMoveModal } from "@/components/CopyMoveModal";
import { FilePreviewDialog } from "@/components/FilePreviewDialog";
import { NewFileModal } from "@/components/NewFileModal";
import { ObjectBrowserToolbar } from "@/components/ObjectBrowserToolbar";
import { ObjectListTable } from "@/components/ObjectListTable";
import { UploadModal } from "@/components/UploadModal";
import { useObjectBrowser } from "@/hooks/useObjectBrowser";
import { useProfileApi } from "@/hooks/useProfileApi";
import { reportError } from "@/lib/errors";
import { fileExtension, getDualPreviewKind, IMAGE_EXTENSIONS } from "@/lib/file-utils";

const route = getRouteApi("/$profile/s3/$bucket");

export function ObjectBrowser() {
  const { profile, bucket } = route.useParams();
  const { prefix } = route.useSearch();
  const api = useProfileApi();

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
  const confirm = useConfirm();

  const activeIndex = Math.min(selectedIndex, items.length - 1);
  const activeItem = activeIndex >= 0 ? items[activeIndex] : undefined;

  const handleView = async (key: string) => {
    if (!bucket) return;
    const ext = fileExtension(key);
    const isDual = !!getDualPreviewKind(key);

    if (!isDual && ext && IMAGE_EXTENSIONS.has(ext)) {
      setSelectedFile({
        key,
        content: api.url(`/s3/buckets/${bucket}/download/${encodeURIComponent(key)}?inline=true`),
        isImage: true,
      });
      return;
    }

    if (ext === "pdf") {
      setSelectedFile({
        key,
        content: api.url(`/s3/buckets/${bucket}/download/${encodeURIComponent(key)}?inline=true`),
        isImage: false,
        isPdf: true,
      });
      return;
    }

    if (ext === "docx") {
      setSelectedFile({
        key,
        content: api.url(`/s3/buckets/${bucket}/download/${encodeURIComponent(key)}`),
        isImage: false,
        isPdf: false,
        isDocx: true,
      });
      return;
    }

    try {
      const response = await api.get<S3ObjectContent>(`s3/buckets/${bucket}/objects/${encodeURIComponent(key)}`);

      if ((!isDual || response.Content === null) && response.ContentType?.toLowerCase().startsWith("image/")) {
        setSelectedFile({
          key,
          content: api.url(`/s3/buckets/${bucket}/download/${encodeURIComponent(key)}?inline=true`),
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
      reportError("Failed to load file", err);
    }
  };

  const handleDelete = async (key: string) => {
    if (!bucket) return;
    const ok = await confirm({
      title: "Delete file",
      description: `Are you sure you want to delete ${key}?`,
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.delete(`s3/buckets/${bucket}/objects/${encodeURIComponent(key)}`);
      toast.success("File deleted successfully");
      refresh();
    } catch (err) {
      reportError("Failed to delete file", err);
    }
  };

  const handleDeleteFolder = async (folderPrefix: string) => {
    if (!bucket) return;
    const ok = await confirm({
      title: "Delete folder",
      description: `Delete folder ${folderPrefix} and all its contents?`,
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.post(`s3/buckets/${bucket}/delete-prefix`, { prefix: folderPrefix } satisfies DeletePrefixRequest);
      toast.success("Folder deleted successfully");
      refresh();
    } catch (err) {
      reportError("Failed to delete folder", err);
    }
  };

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (selectedFile || copyMoveModalOpen || uploadModalOpen || newFileModalOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(Math.min(activeIndex + 1, items.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(Math.max(activeIndex - 1, 0));
      return;
    }
    if (!activeItem) return;

    const isFolder = activeItem.type === "folder";
    if (e.key === "Enter") {
      if (isFolder) {
        navigate({ to: "/$profile/s3/$bucket", params: { profile, bucket }, search: { prefix: activeItem.key } });
      } else {
        handleView(activeItem.key);
      }
    } else if (e.key === "ArrowRight") {
      if (isFolder && !activeItem.isExpanded) toggleFolder(activeItem.key);
    } else if (e.key === "ArrowLeft") {
      if (isFolder && activeItem.isExpanded) toggleFolder(activeItem.key);
    } else if (e.key === "Delete") {
      if (isFolder) handleDeleteFolder(activeItem.key);
      else handleDelete(activeItem.key);
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
      reportError("Failed to save file", err);
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
      reportError("Failed to upload file", err);
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
        } satisfies CopyPrefixRequest);
      } else {
        await api.post("s3/copy", {
          source_bucket: bucket,
          source_key: copyMoveSourceKey,
          destination_bucket: bucket,
          destination_key: destinationKey,
          move: copyMoveAction === "move",
        } satisfies CopyRequest);
      }

      refresh();
      const type = copyMoveIsFolder ? "Folder" : "File";
      toast.success(`${type} ${copyMoveAction === "copy" ? "copied" : "moved"} successfully`);
    } catch (err) {
      reportError(`Failed to ${copyMoveAction} ${copyMoveIsFolder ? "folder" : "file"}`, err);
    }
  };

  const handleDownload = (key: string) => {
    if (!bucket) return;
    // Direct download link
    window.open(api.url(`/s3/buckets/${bucket}/download/${encodeURIComponent(key)}`), "_blank");
  };

  const handleDownloadFolder = (prefix: string) => {
    if (!bucket) return;
    window.open(api.url(`/s3/buckets/${bucket}/download-prefix?prefix=${encodeURIComponent(prefix)}`), "_blank");
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
        selectedIndex={activeIndex}
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
