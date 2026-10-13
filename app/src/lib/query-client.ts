import { MutationCache, QueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { reportError } from "@/lib/errors";

type MutationMessage = string | ((variables: never) => string);

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      error: MutationMessage;
      success?: MutationMessage;
      invalidates?: QueryKey;
    };
  }
}

function messageFor(message: MutationMessage, variables: unknown): string {
  return typeof message === "function" ? (message as (variables: unknown) => string)(variables) : message;
}

export const queryClient: QueryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: (_data, variables, _result, mutation) => {
      const meta = mutation.meta;
      if (!meta) return;
      if (meta.success) toast.success(messageFor(meta.success, variables));
      if (meta.invalidates) void queryClient.invalidateQueries({ queryKey: meta.invalidates });
    },
    onError: (error, variables, _result, mutation) => {
      if (mutation.meta) reportError(messageFor(mutation.meta.error, variables), error);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
