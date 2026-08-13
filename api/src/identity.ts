import { GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { getStsClient } from "./aws";
import type { Profile } from "./profiles";

export interface Identity {
  available: boolean;
  accountId: string | null;
  arn: string | null;
  userId: string | null;
  reason?: string;
}

const UNAVAILABLE_TIMEOUT_MS = 5_000;

const cached = new Map<string, { fingerprint: string; identity: Identity }>();

/**
 * Never throws: S3-compatible emulators have no STS at all, and a scoped IAM policy may
 * deny sts:GetCallerIdentity. Either way the UI just hides the account line.
 */
export async function callerIdentity(profile: Profile): Promise<Identity> {
  const hit = cached.get(profile.id);
  if (hit && hit.fingerprint === profile.fingerprint && hit.identity.available) return hit.identity;

  let identity: Identity;
  try {
    const response = await getStsClient(profile).send(new GetCallerIdentityCommand({}), {
      abortSignal: AbortSignal.timeout(UNAVAILABLE_TIMEOUT_MS),
    });
    identity = {
      available: true,
      accountId: response.Account ?? null,
      arn: response.Arn ?? null,
      userId: response.UserId ?? null,
    };
  } catch (e) {
    identity = {
      available: false,
      accountId: null,
      arn: null,
      userId: null,
      reason: e instanceof Error ? e.message : String(e),
    };
  }

  cached.set(profile.id, { fingerprint: profile.fingerprint, identity });
  return identity;
}
