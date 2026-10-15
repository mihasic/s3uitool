import { FilePlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogFooter, FormDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateObjectKey } from "@/lib/file-utils";

interface NewFileModalProps {
  prefix: string | null;
  onClose: () => void;
  onCreate: (key: string) => void;
}

export function NewFileModal({ prefix, onClose, onCreate }: NewFileModalProps) {
  return (
    <FormDialog
      open={prefix !== null}
      onClose={onClose}
      title="Create New File"
      description="Create a new file in the current location."
      className="sm:max-w-[425px]"
    >
      {prefix !== null && <NewFileForm prefix={prefix} onClose={onClose} onCreate={onCreate} />}
    </FormDialog>
  );
}

function NewFileForm({ prefix, onClose, onCreate }: NewFileModalProps & { prefix: string }) {
  const [key, setKey] = useState(`${prefix}newfile.json`);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateObjectKey(key);
    if (validationError) {
      setError(validationError);
      return;
    }
    onCreate(key);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="key">File Path</Label>
        <Input
          id="key"
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            setError(null);
          }}
          placeholder="folder/filename.json"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">
          <FilePlus className="mr-2 h-4 w-4" />
          Create
        </Button>
      </DialogFooter>
    </form>
  );
}
