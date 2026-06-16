import { Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getErrorMessage } from "@/lib/errors";
import { validateObjectKey } from "@/lib/file-utils";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File, key: string) => Promise<void>;
  currentPrefix: string;
  initialFile?: File | null;
}

export function UploadModal({ isOpen, onClose, onUpload, currentPrefix, initialFile }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialFile) {
        setFile(initialFile);
        setKey(currentPrefix + initialFile.name);

        // Populate the file input with the initial file
        if (fileInputRef.current) {
          const dt = new DataTransfer();
          dt.items.add(initialFile);
          fileInputRef.current.files = dt.files;
        }
      } else {
        setFile(null);
        setKey(currentPrefix);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
      setError(null);
      setUploading(false);
    }
  }, [isOpen, currentPrefix, initialFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      // If key is just the prefix (or empty), append the filename
      // If key already has a filename, replace it? Or just append if it ends in /?
      // Let's just set it to prefix + filename for simplicity, user can edit
      setKey(currentPrefix + selectedFile.name);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file");
      return;
    }

    const validationError = validateObjectKey(key);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setUploading(true);
      await onUpload(file, key);
      onClose();
    } catch (err) {
      // Parent handles the toast; surface the failure in the modal too.
      setError(getErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Upload File</DialogTitle>
          <DialogDescription>Upload a file to the current location.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="file">File</Label>
            {file && (
              <div className="text-sm font-medium text-green-600">
                Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </div>
            )}
            <Input id="file" type="file" ref={fileInputRef} onChange={handleFileChange} disabled={uploading} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="key">Destination Key (Path)</Label>
            <Input
              id="key"
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setError(null);
              }}
              placeholder="folder/filename.ext"
              disabled={uploading}
            />
            <p className="text-xs text-muted-foreground">You can specify nested folders (e.g. images/2024/photo.jpg)</p>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={uploading}>
              Cancel
            </Button>
            <Button type="submit" disabled={!file || uploading}>
              {uploading ? "Uploading..." : "Upload"}
              {!uploading && <Upload className="ml-2 h-4 w-4" />}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
