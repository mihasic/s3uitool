import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useConfig } from "@/contexts/ConfigContext";
import { profileKey, useProfileApi, useProfileId } from "@/hooks/useProfileApi";
import type { Identity, Profile, ProfileSource } from "@/types/config";

const GROUP_LABELS: Record<ProfileSource, string> = {
  env: "Configured",
  ambient: "Local session",
  ini: "AWS config",
};

const GROUP_ORDER: ProfileSource[] = ["env", "ini", "ambient"];

function groupBySource(profiles: Profile[]) {
  return GROUP_ORDER.map((source) => ({ source, group: profiles.filter((p) => p.source === source) })).filter(
    ({ group }) => group.length > 0,
  );
}

/** Best-effort: STS is absent on emulators and may be denied by policy, so a miss is silent. */
function IdentityLine({ profile }: { profile: string }) {
  const api = useProfileApi();
  const { data } = useQuery({
    queryKey: profileKey(profile, "identity"),
    queryFn: () => api.get<Identity>("identity"),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

  if (!data?.available || !data.accountId) return null;
  return (
    <span className="text-xs text-muted-foreground font-mono" title={data.arn ?? undefined}>
      {data.accountId}
    </span>
  );
}

export function ProfileSwitcher() {
  const { config } = useConfig();
  const active = useProfileId();
  const navigate = useNavigate();

  if (!config || config.profiles.length < 2) return null;

  const groups = groupBySource(config.profiles);

  const handleChange = (id: string) => {
    if (id === active) return;
    // Buckets and queues do not carry across accounts, so land on the service root.
    const target = config.profiles.find((p) => p.id === id);
    if (target?.s3 || !target?.sqs) navigate({ to: "/$profile/s3", params: { profile: id } });
    else navigate({ to: "/$profile/sqs", params: { profile: id } });
  };

  return (
    <div className="ml-auto flex items-center gap-3">
      <IdentityLine profile={active} />
      <select
        aria-label="AWS profile"
        value={active}
        onChange={(e) => handleChange(e.target.value)}
        className="h-8 rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {groups.map(({ source, group }) => (
          <optgroup key={source} label={GROUP_LABELS[source]}>
            {group.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.label}
                {profile.region ? ` (${profile.region})` : ""}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
