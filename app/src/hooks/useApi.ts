import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { profileKey, useProfileApi, useProfileId } from "@/hooks/useProfileApi";
import type { Bucket, Queue } from "@/types/s3";

/**
 * Hook for fetching all S3 buckets
 */
export function useBuckets(): UseQueryResult<Bucket[]> {
  const api = useProfileApi();
  const profile = useProfileId();
  return useQuery({
    queryKey: profileKey(profile, "buckets"),
    queryFn: () => api.get<Bucket[]>("s3/buckets"),
  });
}

/**
 * Hook for fetching all SQS queues
 */
export function useQueues(): UseQueryResult<Queue[]> {
  const api = useProfileApi();
  const profile = useProfileId();
  return useQuery({
    queryKey: profileKey(profile, "queues"),
    queryFn: () => api.get<Queue[]>("sqs/queues"),
  });
}
