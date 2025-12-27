import { useEffect, useState } from "react";
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

interface CopyMoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (destinationKey: string) => void;
  sourceKey: string;
  action: "copy" | "move";
}

export function CopyMoveModal({ isOpen, onClose, onConfirm, sourceKey, action }: CopyMoveModalProps) {
  const [destinationKey, setDestinationKey] = useState(sourceKey);

  useEffect(() => {
    if (isOpen) {
      setDestinationKey(sourceKey);
    }
  }, [isOpen, sourceKey]);

  const handleConfirm = () => {
    onConfirm(destinationKey);
    onClose();
  };

  const title = action === "copy" ? "Copy Object" : "Move Object";
  const description =
    action === "copy" ? `Copy "${sourceKey}" to a new location.` : `Move "${sourceKey}" to a new location.`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Input
              id="destination"
              value={destinationKey}
              onChange={(e) => setDestinationKey(e.target.value)}
              className="col-span-4"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm}>{action === "copy" ? "Copy" : "Move"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
