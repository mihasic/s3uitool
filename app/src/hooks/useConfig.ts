import type { AppConfig } from "@api/schema/config";
import { queryOptions } from "@tanstack/react-query";
import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import { toast } from "sonner";
import { getConfig } from "@/lib/api";

const FALLBACK_CONFIG: AppConfig = {
  defaultProfile: "default",
  profiles: [{ id: "default", label: "Default", source: "env", s3: true, sqs: true }],
};

export const configQuery = queryOptions({
  queryKey: ["config"],
  queryFn: async (): Promise<AppConfig> => {
    try {
      return await getConfig();
    } catch (err) {
      console.error("Failed to fetch config:", err);
      toast.error("Couldn't load app config from the server — showing all features.");
      return FALLBACK_CONFIG;
    }
  },
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
});

export function useConfig(): AppConfig {
  return useRouteContext({ from: rootRouteId, select: (context) => context.config });
}
