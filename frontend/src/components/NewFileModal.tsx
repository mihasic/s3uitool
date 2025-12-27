import { FilePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NewFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (key: string) => void;
  currentPrefix: string;
}

export function NewFileModal({ isOpen, onClose, onCreate, currentPrefix }: NewFileModalProps) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setKey(`${currentPrefix}newfile.json`);
      setError(null);
    }
  }, [isOpen, currentPrefix]);

  const validateKey = (key: string): string | null => {
    if (!key.trim()) return "Key cannot be empty";

    const parts = key.split("/");
    for (const part of parts) {
      if (part === "." || part === "..") {
        return "Folder names cannot be '.' or '..'";
      }
    }
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateKey(key);
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
