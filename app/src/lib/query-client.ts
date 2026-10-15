import {
  MutationCache,
  type Query,
  QueryClient,
  type QueryKey,
  type UseMutationResult,
  useMutation,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { reportError } from "@/lib/errors";

type MutationMessage<V> = string | ((variables: V) => string);
type Invalidation<V> = QueryKey | ((query: Query, variables: V) => boolean);

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      error: MutationMessage<never>;
      success?: MutationMessage<never>;
      invalidates?: Invalidation<never>;
    };
  }
}

interface AppMutationOptions<D, V> {
  mutationFn: (variables: V) => Promise<D>;
  error: MutationMessage<V>;
  success?: MutationMessage<V>;
  invalidates?: Invalidation<V>;
}

export type AppMutation<V> = UseMutationResult<unknown, Error, V>;

export function useAppMutation<D, V>({ mutationFn, ...meta }: AppMutationOptions<D, V>) {
  return useMutation({ mutationFn, meta });
}

function messageFor(message: MutationMessage<never>, variables: unknown): string {
  return typeof message === "function" ? (message as (variables: unknown) => string)(variables) : message;
}

export const queryClient: QueryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: (_data, variables, _result, mutation) => {
      const meta = mutation.meta;
      if (!meta) return;
      if (meta.success) toast.success(messageFor(meta.success, variables));
      const target = meta.invalidates as Invalidation<unknown> | undefined;
      if (typeof target === "function") {
        void queryClient.invalidateQueries({ predicate: (query) => target(query, variables) });
      } else if (target) {
        void queryClient.invalidateQueries({ queryKey: target });
      }
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
