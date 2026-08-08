import { toast } from "sonner";

/** Safely extract a human-readable message from an unknown thrown value. */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return String(err);
}

/** Log an error and show a toast, with the API's explanation as the description. */
export function reportError(userMessage: string, err: unknown): void {
  console.error(userMessage, err);
  const detail = getErrorMessage(err);
  toast.error(userMessage, detail && detail !== userMessage ? { description: detail } : undefined);
}
