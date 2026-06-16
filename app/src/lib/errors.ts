import { toast } from "sonner";

/** Safely extract a human-readable message from an unknown thrown value. */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return String(err);
}

/** Log an error and show a toast with a user-facing message. */
export function reportError(userMessage: string, err: unknown): void {
  console.error(userMessage, err);
  toast.error(userMessage);
}
