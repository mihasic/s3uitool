import { useParams } from "@tanstack/react-router";
import { useConfig } from "@/hooks/useConfig";
import { createApi, type ProfileApi } from "@/lib/api";
import { defaultProfileId } from "@/types/config";

/** The profile id from the route, falling back to the server's default. */
export function useProfileId(): string {
  const params = useParams({ strict: false }) as { profile?: string };
  const config = useConfig();
  return params.profile ?? defaultProfileId(config);
}

export function useProfileApi(): ProfileApi {
  return createApi(useProfileId());
}

/** Query keys are profile-scoped so one account's cache never shows up under another. */
export function profileKey(profile: string, ...rest: unknown[]): unknown[] {
  return ["p", profile, ...rest];
}
