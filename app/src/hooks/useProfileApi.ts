import { useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import { useConfig } from "@/contexts/ConfigContext";
import { createApi, type ProfileApi } from "@/lib/api";
import { activeProfile } from "@/types/config";

/** The profile id from the route, falling back to the server's default. */
export function useProfileId(): string {
  const params = useParams({ strict: false }) as { profile?: string };
  const { config } = useConfig();
  return params.profile ?? activeProfile(config, undefined)?.id ?? "default";
}

export function useProfileApi(): ProfileApi {
  const profile = useProfileId();
  return useMemo(() => createApi(profile), [profile]);
}

/** Query keys are profile-scoped so one account's cache never shows up under another. */
export function profileKey(profile: string, ...rest: unknown[]): unknown[] {
  return ["p", profile, ...rest];
}
