import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface Bucket {
  Name: string;
  CreationDate: string;
}

interface Queue {
  Url: string;
  Name: string;
  Attributes?: Record<string, string>;
}

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

/**
 * Hook for uploading files to S3
 */
export function useUploadFile() {
  return {
    upload: async (bucket: string, key: string, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return api.upload<{ message: string }>(`s3/buckets/${bucket}/upload?key=${encodeURIComponent(key)}`, formData);
    },
  };
}

/**
 * Hook for downloading files
 */
export function useDownloadFile() {
  return {
    getDownloadUrl: (bucket: string, key: string, inline: boolean = false) => {
      const baseUrl = process.env.VITE_API_BASE_URL || "";
      return `${baseUrl}/s3/buckets/${bucket}/download/${encodeURIComponent(key)}?inline=${inline}`;
    },
  };
}

/**
 * Hook for getting file content
 */
export function useFileContent(bucket: string | undefined, key: string | undefined) {
  return useQuery({
    queryKey: ["fileContent", bucket, key],
    queryFn: () => {
      if (!bucket || !key) return null;
      return api.get<{ Content: string | null; ContentType: string }>(
        `s3/buckets/${bucket}/objects/${encodeURIComponent(key)}`,
      );
    },
    enabled: !!bucket && !!key,
  });
}
