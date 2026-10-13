import type { CopyPrefixRequest, CopyRequest, DeletePrefixRequest, S3ObjectContent } from "@api/schema/s3";
import { useMutation } from "@tanstack/react-query";
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
import { objectsKey } from "@/hooks/useApi";
import { useObjectBrowser } from "@/hooks/useObjectBrowser";
import { useProfileApi } from "@/hooks/useProfileApi";
import { bucketPath, downloadPath, objectPath } from "@/lib/api";
import { reportError } from "@/lib/errors";
import { fileExtension, getDualPreviewKind, IMAGE_EXTENSIONS } from "@/lib/file-utils";
import type { CopyMoveTarget, PreviewFile } from "@/types/s3";

const route = getRouteApi("/$profile/s3/$bucket");

interface CopyMoveVariables extends CopyMoveTarget {
  destination: string;
}

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

  const [preview, setPreview] = useState<PreviewFile | null>(null);
  const [copyMoveTarget, setCopyMoveTarget] = useState<CopyMoveTarget | null>(null);
  const [uploadDialog, setUploadDialog] = useState<{ file: File | null } | null>(null);
  const [newFileModalOpen, setNewFileModalOpen] = useState(false);

  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const navigate = useNavigate();
  const confirm = useConfirm();

  const invalidates = objectsKey(profile, bucket);
  const putObject = (key: string, body: Blob) => {
    const formData = new FormData();
    formData.append("file", body);
    return api.upload(objectPath(bucket, key), formData);
  };

  const deleteObject = useMutation({
    mutationFn: (key: string) => api.delete(objectPath(bucket, key)),
    meta: { error: "Failed to delete file", success: "File deleted successfully", invalidates },
  });

  const deleteFolder = useMutation({
    mutationFn: (folder: string) =>
      api.post(`${bucketPath(bucket)}/delete-prefix`, { prefix: folder } satisfies DeletePrefixRequest),
    meta: { error: "Failed to delete folder", success: "Folder deleted successfully", invalidates },
  });

  const saveFile = useMutation({
    mutationFn: ({ key, content }: { key: string; content: string }) =>
      putObject(key, new Blob([content], { type: "text/plain" })),
    meta: { error: "Failed to save file", success: "File saved successfully", invalidates },
  });

  const upload = useMutation({
    mutationFn: ({ file, key }: { file: File; key: string }) => putObject(key, file),
    meta: { error: "Failed to upload file", success: "File uploaded successfully", invalidates },
  });

  const copyMove = useMutation({
    mutationFn: ({ action, key, isFolder, destination }: CopyMoveVariables) =>
      isFolder
        ? api.post("s3/copy-prefix", {
            source_bucket: bucket,
            source_prefix: key,
            destination_bucket: bucket,
            destination_prefix: destination.endsWith("/") ? destination : `${destination}/`,
            move: action === "move",
          } satisfies CopyPrefixRequest)
        : api.post("s3/copy", {
            source_bucket: bucket,
            source_key: key,
            destination_bucket: bucket,
            destination_key: destination,
            move: action === "move",
          } satisfies CopyRequest),
    meta: {
      error: ({ action, isFolder }: CopyMoveVariables) => `Failed to ${action} ${isFolder ? "folder" : "file"}`,
      success: ({ action, isFolder }: CopyMoveVariables) =>
        `${isFolder ? "Folder" : "File"} ${action === "copy" ? "copied" : "moved"} successfully`,
      invalidates,
    },
  });

  const activeIndex = Math.min(selectedIndex, items.length - 1);
  const activeItem = activeIndex >= 0 ? items[activeIndex] : undefined;

  const showMedia = (key: string, kind: "image" | "pdf" | "docx") =>
    setPreview({ kind, key, url: api.url(downloadPath(bucket, key, kind !== "docx")) });

  const handleView = async (key: string) => {
    const ext = fileExtension(key);
    const isDual = !!getDualPreviewKind(key);

    if (!isDual && ext && IMAGE_EXTENSIONS.has(ext)) return showMedia(key, "image");
    if (ext === "pdf") return showMedia(key, "pdf");
    if (ext === "docx") return showMedia(key, "docx");

    try {
      const response = await api.get<S3ObjectContent>(objectPath(bucket, key));
      if ((!isDual || response.Content === null) && response.ContentType?.toLowerCase().startsWith("image/")) {
        showMedia(key, "image");
      } else if (response.Content !== null) {
        setPreview({ kind: "text", key, content: response.Content });
      } else {
        toast.error("Binary file or empty content");
      }
    } catch (err) {
      reportError("Failed to load file", err);
    }
  };

  const handleDelete = async (key: string) => {
    const ok = await confirm({
      title: "Delete file",
      description: `Are you sure you want to delete ${key}?`,
      confirmText: "Delete",
      destructive: true,
    });
    if (ok) deleteObject.mutate(key);
  };

  const handleDeleteFolder = async (folderPrefix: string) => {
    const ok = await confirm({
      title: "Delete folder",
      description: `Delete folder ${folderPrefix} and all its contents?`,
      confirmText: "Delete",
      destructive: true,
    });
    if (ok) deleteFolder.mutate(folderPrefix);
  };

  const onKeyDown = useEffectEvent((e: KeyboardEvent) => {
    if (preview || copyMoveTarget || uploadDialog || newFileModalOpen) return;

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

  const handleCreateFile = (key: string) => setPreview({ kind: "text", key, content: "{}" });

  const handleSave = (content: string) => {
    if (!preview) return;
    saveFile.mutate({ key: preview.key, content }, { onSuccess: () => setPreview(null) });
  };

  const handleDownload = (key: string) => {
    window.open(api.url(downloadPath(bucket, key)), "_blank");
  };

  const handleDownloadFolder = (prefix: string) => {
    window.open(api.url(`${bucketPath(bucket)}/download-prefix?prefix=${encodeURIComponent(prefix)}`), "_blank");
  };

  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;

  return (
    <div className="p-6">
      <ObjectBrowserToolbar
        bucket={bucket}
        prefix={prefix}
        onNewFile={() => setNewFileModalOpen(true)}
        onUpload={() => setUploadDialog({ file: null })}
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
        onCopyMove={setCopyMoveTarget}
        onDelete={handleDelete}
        onDeleteFolder={handleDeleteFolder}
        onDownloadFolder={handleDownloadFolder}
        onToggleFolder={toggleFolder}
        onFileDrop={(file) => setUploadDialog({ file })}
        viewMode={viewMode}
      />

      <FilePreviewDialog file={preview} onClose={() => setPreview(null)} onSave={handleSave} />

      <CopyMoveModal
        target={copyMoveTarget}
        onClose={() => setCopyMoveTarget(null)}
        onConfirm={(target, destination) => copyMove.mutate({ ...target, destination })}
      />

      <UploadModal
        isOpen={uploadDialog !== null}
        onClose={() => setUploadDialog(null)}
        onUpload={(file, key) => upload.mutateAsync({ file, key })}
        currentPrefix={prefix}
        initialFile={uploadDialog?.file}
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
