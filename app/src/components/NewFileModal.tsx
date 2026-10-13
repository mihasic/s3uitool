import { FilePlus } from "lucide-react";
import { useState } from "react";
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
import { validateObjectKey } from "@/lib/file-utils";

interface NewFileFormProps {
  onClose: () => void;
  onCreate: (key: string) => void;
  currentPrefix: string;
}

interface NewFileModalProps extends NewFileFormProps {
  isOpen: boolean;
}

export function NewFileModal({ isOpen, ...props }: NewFileModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New File</DialogTitle>
          <DialogDescription>Create a new file in the current location.</DialogDescription>
        </DialogHeader>
        <NewFileForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function NewFileForm({ onClose, onCreate, currentPrefix }: NewFileFormProps) {
  const [key, setKey] = useState(`${currentPrefix}newfile.json`);
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
