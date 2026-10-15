import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogFooter, FormDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { AppMutation } from "@/lib/query-client";
import type { CopyMove, CopyMoveTarget } from "@/types/s3";

interface CopyMoveModalProps {
  target: CopyMoveTarget | null;
  onClose: () => void;
  copyMove: AppMutation<CopyMove>;
}

export function CopyMoveModal({ target, onClose, copyMove }: CopyMoveModalProps) {
  const verb = target?.action === "move" ? "Move" : "Copy";
  return (
    <FormDialog
      open={target !== null}
      onClose={onClose}
      title={`${verb} Object`}
      description={target && `${verb} "${target.key}" to a new location.`}
      className="sm:max-w-[625px]"
    >
      {target && <CopyMoveForm target={target} verb={verb} onClose={onClose} copyMove={copyMove} />}
    </FormDialog>
  );
}

function CopyMoveForm({
  target,
  verb,
  onClose,
  copyMove,
}: Omit<CopyMoveModalProps, "target"> & { target: CopyMoveTarget; verb: string }) {
  const [destination, setDestination] = useState(target.key);

  const handleConfirm = () => copyMove.mutate({ ...target, destination }, { onSuccess: onClose });

  return (
    <>
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
        <Button onClick={handleConfirm} disabled={copyMove.isPending}>
          {verb}
        </Button>
      </DialogFooter>
    </>
  );
}
