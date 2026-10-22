import { createContext, type ReactNode, use, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogFooter, FormDialog } from "@/components/ui/dialog";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm: ConfirmFn = (opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  };

  const settle = (result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext value={confirm}>
      {children}
      <FormDialog
        open={options !== null}
        onClose={() => settle(false)}
        title={options?.title}
        description={options?.description}
        className="sm:max-w-[425px]"
      >
        <DialogFooter>
          <Button variant="outline" onClick={() => settle(false)}>
            {options?.cancelText ?? "Cancel"}
          </Button>
          <Button variant={options?.destructive ? "destructive" : "default"} onClick={() => settle(true)}>
            {options?.confirmText ?? "Confirm"}
          </Button>
        </DialogFooter>
      </FormDialog>
    </ConfirmContext>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = use(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
