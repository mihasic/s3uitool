import { DocxViewer } from "@/components/DocxViewer";
import { FileViewer } from "@/components/FileViewer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getLanguageFromFilename } from "@/lib/file-utils";

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
  onSave: (content: string) => Promise<void>;
}

export function FilePreviewDialog({ file, isOpen, onClose, onSave }: FilePreviewDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{file?.key}</DialogTitle>
        </DialogHeader>
        {file && (
          <div className="flex-1 min-h-0 flex items-center justify-center bg-gray-50 rounded-md overflow-hidden">
            {file.isImage ? (
              <img src={file.content} alt={file.key} className="max-w-full max-h-full object-contain" />
            ) : file.isPdf ? (
              <iframe src={file.content} title={file.key} className="w-full h-full border-0" />
            ) : file.isDocx ? (
              <DocxViewer url={file.content} />
            ) : (
              <FileViewer content={file.content} onSave={onSave} language={getLanguageFromFilename(file.key)} />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
