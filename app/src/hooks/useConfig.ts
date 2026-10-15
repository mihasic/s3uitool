import type { AppConfig } from "@api/schema/config";
import { queryOptions } from "@tanstack/react-query";
import { rootRouteId, useRouteContext } from "@tanstack/react-router";
import { getConfig } from "@/lib/api";
import { reportError } from "@/lib/errors";

const FALLBACK_CONFIG: AppConfig = {
  defaultProfile: "default",
  profiles: [{ id: "default", label: "Default", source: "env", s3: true, sqs: true }],
};

export const configQuery = queryOptions({
  queryKey: ["config"],
  queryFn: getConfig,
  retry: false,
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: Number.POSITIVE_INFINITY,
});

export function fallbackConfig(err: unknown): AppConfig {
  reportError("Couldn't load app config from the server — showing all features.", err, "config");
  return FALLBACK_CONFIG;
}

export function useConfig(): AppConfig {
  return useRouteContext({ from: rootRouteId, select: (context) => context.config });
}
