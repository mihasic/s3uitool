import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Bucket, Queue } from "@/types/s3";

/**
 * Hook for fetching all S3 buckets
 */
export function useBuckets(): UseQueryResult<Bucket[]> {
  return useQuery({
    queryKey: ["buckets"],
    queryFn: () => api.get<Bucket[]>("s3/buckets"),
  });
}

/**
 * Hook for fetching all SQS queues
 */
export function useQueues(): UseQueryResult<Queue[]> {
  return useQuery({
    queryKey: ["queues"],
    queryFn: () => api.get<Queue[]>("sqs/queues"),
  });
}
