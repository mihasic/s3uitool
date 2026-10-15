import type { Bucket } from "@api/schema/s3";
import type { Queue } from "@api/schema/sqs";
import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { profileKey, useProfileApi, useProfileId } from "@/hooks/useProfileApi";

const bucketsKey = (profile: string) => profileKey(profile, "buckets");
export const objectsKey = (profile: string, bucket: string) => profileKey(profile, "objects", bucket);
export const queuesKey = (profile: string) => profileKey(profile, "queues");
export const messagesKey = (profile: string, queue: string) => profileKey(profile, "messages", queue);

export function useBuckets(): UseQueryResult<Bucket[]> {
  const api = useProfileApi();
  const profile = useProfileId();
  return useQuery({
    queryKey: bucketsKey(profile),
    queryFn: () => api.get<Bucket[]>("s3/buckets"),
  });
}

export function useQueues(): UseQueryResult<Queue[]> {
  const api = useProfileApi();
  const profile = useProfileId();
  return useQuery({
    queryKey: queuesKey(profile),
    queryFn: () => api.get<Queue[]>("sqs/queues"),
  });
}
