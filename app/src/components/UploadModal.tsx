import { Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogFooter, FormDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateObjectKey } from "@/lib/file-utils";
import type { AppMutation } from "@/lib/query-client";
import type { PutObject } from "@/types/s3";

export interface UploadDraft {
  file: File | null;
}

interface UploadModalProps {
  draft: UploadDraft | null;
  onClose: () => void;
  upload: AppMutation<PutObject>;
  currentPrefix: string;
}

export function UploadModal({ draft, ...props }: UploadModalProps) {
  return (
    <FormDialog
      open={draft !== null}
      onClose={props.onClose}
      title="Upload File"
      description="Upload a file to the current location."
      className="sm:max-w-[625px]"
    >
      {draft && <UploadForm initialFile={draft.file} {...props} />}
    </FormDialog>
  );
}

function UploadForm({
  onClose,
  upload,
  currentPrefix,
  initialFile,
}: Omit<UploadModalProps, "draft"> & { initialFile: File | null }) {
  const [file, setFile] = useState(initialFile);
  const [key, setKey] = useState(currentPrefix + (initialFile?.name ?? ""));
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setKey(currentPrefix + selectedFile.name);
      setError(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
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
    upload.mutate({ key, body: file, verb: "upload" }, { onSuccess: onClose });
  };

  const uploading = upload.isPending;

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="file">File</Label>
        {file && (
          <div className="text-sm font-medium text-green-600">
            Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
          </div>
        )}
        <Input id="file" type="file" onChange={handleFileChange} disabled={uploading} />
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
  );
}
