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

interface CopyMoveFormProps {
  onClose: () => void;
  onConfirm: (destinationKey: string) => void;
  sourceKey: string;
  action: "copy" | "move";
}

interface CopyMoveModalProps extends CopyMoveFormProps {
  isOpen: boolean;
}

export function CopyMoveModal({ isOpen, ...props }: CopyMoveModalProps) {
  const { action, sourceKey } = props;
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>{action === "copy" ? "Copy Object" : "Move Object"}</DialogTitle>
          <DialogDescription>
            {action === "copy" ? "Copy" : "Move"} "{sourceKey}" to a new location.
          </DialogDescription>
        </DialogHeader>
        <CopyMoveForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function CopyMoveForm({ onClose, onConfirm, sourceKey, action }: CopyMoveFormProps) {
  const [destinationKey, setDestinationKey] = useState(sourceKey);

  const handleConfirm = () => {
    onConfirm(destinationKey);
    onClose();
  };

  return (
    <>
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
    </>
  );
}
