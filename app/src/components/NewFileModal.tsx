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

interface NewFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (key: string) => void;
  currentPrefix: string;
}

export function NewFileModal({ isOpen, onClose, onCreate, currentPrefix }: NewFileModalProps) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevPrefix, setPrevPrefix] = useState(currentPrefix);

  if (isOpen !== prevIsOpen || currentPrefix !== prevPrefix) {
    setPrevIsOpen(isOpen);
    setPrevPrefix(currentPrefix);
    if (isOpen) {
      setKey(`${currentPrefix}newfile.json`);
      setError(null);
    }
  }

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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New File</DialogTitle>
          <DialogDescription>Create a new file in the current location.</DialogDescription>
        </DialogHeader>
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
      </DialogContent>
    </Dialog>
  );
}
