import { Loader2 } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getDualPreviewKind, getLanguageFromFilename } from "@/lib/file-utils";

// Monaco and docx-preview are only reachable from this dialog, and together they are
// most of the bundle — load them when a preview actually opens.
const DocxViewer = lazy(() => import("@/components/DocxViewer").then((m) => ({ default: m.DocxViewer })));
const FileViewer = lazy(() => import("@/components/FileViewer").then((m) => ({ default: m.FileViewer })));
const DualPreview = lazy(() => import("@/components/DualPreview").then((m) => ({ default: m.DualPreview })));

const spinner = (
  <div className="flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

interface SelectedFile {
  key: string;
  content: string;
  isImage?: boolean;
  isPdf?: boolean;
  isDocx?: boolean;
}

interface FilePreviewDialogProps {
  file: SelectedFile | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (content: string) => void;
}

export function FilePreviewDialog({ file, isOpen, onClose, onSave }: FilePreviewDialogProps) {
  // Show a spinner for image/PDF previews until the media finishes loading.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const mediaLoaded = !!file && loadedKey === file.key;
  const markLoaded = () => setLoadedKey(file?.key ?? null);

  const showSpinner = !!file && (file.isImage || file.isPdf) && !mediaLoaded;
  const dualKind = file ? getDualPreviewKind(file.key) : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{file?.key}</DialogTitle>
          <DialogDescription className="sr-only">Preview of the selected file's contents</DialogDescription>
        </DialogHeader>
        {file && (
          <div className="relative flex-1 min-h-0 flex items-center justify-center bg-gray-50 rounded-md overflow-hidden">
            {showSpinner && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            {file.isImage ? (
              <img
                src={file.content}
                alt={file.key}
                className="max-w-full max-h-full object-contain"
                onLoad={markLoaded}
                onError={markLoaded}
              />
            ) : file.isPdf ? (
              <iframe src={file.content} title={file.key} className="w-full h-full border-0" onLoad={markLoaded} />
            ) : file.isDocx ? (
              <Suspense fallback={spinner}>
                <DocxViewer url={file.content} />
              </Suspense>
            ) : dualKind ? (
              <Suspense fallback={spinner}>
                <DualPreview fileKey={file.key} kind={dualKind} content={file.content} onSave={onSave} />
              </Suspense>
            ) : (
              <Suspense fallback={spinner}>
                <FileViewer content={file.content} onSave={onSave} language={getLanguageFromFilename(file.key)} />
              </Suspense>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
