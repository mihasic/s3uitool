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
import type { CopyMoveTarget } from "@/types/s3";

interface CopyMoveModalProps {
  target: CopyMoveTarget | null;
  onClose: () => void;
  onConfirm: (target: CopyMoveTarget, destination: string) => void;
}

export function CopyMoveModal({ target, onClose, onConfirm }: CopyMoveModalProps) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[625px]">
        {target && <CopyMoveForm target={target} onClose={onClose} onConfirm={onConfirm} />}
      </DialogContent>
    </Dialog>
  );
}

function CopyMoveForm({ target, onClose, onConfirm }: CopyMoveModalProps & { target: CopyMoveTarget }) {
  const [destination, setDestination] = useState(target.key);
  const verb = target.action === "copy" ? "Copy" : "Move";

  const handleConfirm = () => {
    onConfirm(target, destination);
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{verb} Object</DialogTitle>
        <DialogDescription>
          {verb} "{target.key}" to a new location.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Input
            id="destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="col-span-4"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleConfirm}>{verb}</Button>
      </DialogFooter>
    </>
  );
}
