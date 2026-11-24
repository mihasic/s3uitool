import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogFooter, FormDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { validateObjectKey } from "@/lib/file-utils";
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
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateObjectKey(destination);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (destination === target.key) {
      setError("Destination must be different from the current path");
      return;
    }
    copyMove.mutate({ ...target, destination }, { onSuccess: onClose });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-2 py-4">
        <Input
          id="destination"
          value={destination}
          onChange={(e) => {
            setDestination(e.target.value);
            setError(null);
          }}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={copyMove.isPending || !destination.trim() || destination === target.key}>
          {verb}
        </Button>
      </DialogFooter>
    </form>
  );
}
