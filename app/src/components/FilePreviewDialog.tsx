import { Loader2 } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getDualPreviewKind, getLanguageFromFilename } from "@/lib/file-utils";
import type { PreviewFile } from "@/types/s3";

const DocxViewer = lazy(() => import("@/components/DocxViewer").then((m) => ({ default: m.DocxViewer })));
const FileViewer = lazy(() => import("@/components/FileViewer").then((m) => ({ default: m.FileViewer })));
const DualPreview = lazy(() => import("@/components/DualPreview").then((m) => ({ default: m.DualPreview })));

const spinner = (
  <div className="flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

interface FilePreviewDialogProps {
  file: PreviewFile | null;
  onClose: () => void;
  onSave: (content: string) => void;
}

export function FilePreviewDialog({ file, onClose, onSave }: FilePreviewDialogProps) {
  return (
    <Dialog open={file !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{file?.key}</DialogTitle>
          <DialogDescription className="sr-only">Preview of the selected file's contents</DialogDescription>
        </DialogHeader>
        {file && <PreviewBody key={file.key} file={file} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  );
}

function PreviewBody({ file, onSave }: { file: PreviewFile; onSave: (content: string) => void }) {
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const markLoaded = () => setMediaLoaded(true);
  const showSpinner = (file.kind === "image" || file.kind === "pdf") && !mediaLoaded;

  return (
    <div className="relative flex-1 min-h-0 flex items-center justify-center bg-gray-50 rounded-md overflow-hidden">
      {showSpinner && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      <PreviewContent file={file} onSave={onSave} onLoad={markLoaded} />
    </div>
  );
}

function PreviewContent({
  file,
  onSave,
  onLoad,
}: {
  file: PreviewFile;
  onSave: (content: string) => void;
  onLoad: () => void;
}) {
  switch (file.kind) {
    case "image":
      return (
        <img
          src={file.url}
          alt={file.key}
          className="max-w-full max-h-full object-contain"
          onLoad={onLoad}
          onError={onLoad}
        />
      );
    case "pdf":
      return <iframe src={file.url} title={file.key} className="w-full h-full border-0" onLoad={onLoad} />;
    case "docx":
      return (
        <Suspense fallback={spinner}>
          <DocxViewer url={file.url} />
        </Suspense>
      );
    case "text": {
      const dualKind = getDualPreviewKind(file.key);
      return (
        <Suspense fallback={spinner}>
          {dualKind ? (
            <DualPreview fileKey={file.key} kind={dualKind} content={file.content} onSave={onSave} />
          ) : (
            <FileViewer content={file.content} onSave={onSave} language={getLanguageFromFilename(file.key)} />
          )}
        </Suspense>
      );
    }
  }
}
