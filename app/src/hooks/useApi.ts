import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ObjectListResponse } from "@/types/s3";

interface Bucket {
  Name: string;
  CreationDate: string;
}

interface Queue {
  Url: string;
  Name: string;
  Attributes?: Record<string, string>;
}

interface PrefixParams {
  prefix: string;
  continuation_token?: string | null;
  max_keys?: number;
  filter_text?: string | null;
  delimiter?: string;
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
 * Hook for fetching S3 objects with filtering, pagination, and batch support
 */
interface UseObjectListParams {
  bucket: string | undefined;
  prefix: string;
  filterText: string;
  currentPage: number;
  pageTokens: (string | null)[];
  pageSize: number;
  viewMode: "folder" | "tree" | "flat";
  expandedFolders: Set<string>;
}

export function useObjectList({
  bucket,
  prefix,
  filterText,
  currentPage,
  pageTokens,
  pageSize,
  viewMode,
  expandedFolders,
}: UseObjectListParams): UseQueryResult<Record<string, ObjectListResponse>> {
  const getParent = (p: string) => {
    const trimmed = p.endsWith("/") ? p.slice(0, -1) : p;
    const lastSlash = trimmed.lastIndexOf("/");
    if (lastSlash === -1) return "";
    return `${trimmed.slice(0, lastSlash)}/`;
  };

  const isReachable = (p: string): boolean => {
    if (p === prefix) return true;

    let current = p;
    // Walk upwards
    while (current !== prefix && current.length > prefix.length) {
      const parent = getParent(current);
      // If we hit the viewing prefix, checking is done and successful
      if (parent === prefix) return true;

      if (current === "" && prefix !== "") return false;

      if (!expandedFolders.has(parent)) return false;

      current = parent;
    }
    return true;
  };

  const buildRequests = () => {
    const prefixesToFetch = new Set<string>();
    prefixesToFetch.add(prefix);

    if (viewMode !== "flat") {
      expandedFolders.forEach((p) => {
        if (p !== prefix && p.startsWith(prefix)) {
          if (isReachable(p)) {
            prefixesToFetch.add(p);
          }
        }
      });
    }

    const requests: PrefixParams[] = Array.from(prefixesToFetch).map((p) => {
      if (p === prefix) {
        return {
          prefix: p,
          filter_text: filterText || null,
          continuation_token: pageTokens[currentPage] || null,
          max_keys: pageSize,
          delimiter: viewMode === "flat" ? "" : "/",
        };
      }
      return { prefix: p };
    });

    return requests;
  };

  const requests = buildRequests();

  return useQuery({
    queryKey: ["objects", bucket, requests],
    queryFn: async () => {
      if (!bucket) return {};

      const BATCH_SIZE = 20;
      const results: Record<string, ObjectListResponse> = {};
      const requestChunks: PrefixParams[][] = [];

      for (let i = 0; i < requests.length; i += BATCH_SIZE) {
        requestChunks.push(requests.slice(i, i + BATCH_SIZE));
      }

      for (const chunk of requestChunks) {
        const chunkResults = await Promise.all(
          chunk.map((req) =>
            api.get<ObjectListResponse>(
              `s3/buckets/${bucket}/objects?prefix=${encodeURIComponent(req.prefix || "")}${req.delimiter !== undefined ? `&delimiter=${encodeURIComponent(req.delimiter)}` : ""}${req.filter_text ? `&filter_text=${encodeURIComponent(req.filter_text)}` : ""}${req.continuation_token ? `&continuation_token=${encodeURIComponent(req.continuation_token)}` : ""}${req.max_keys ? `&max_keys=${req.max_keys}` : ""}`,
            ),
          ),
        );

        chunk.forEach((req, index) => {
          results[req.prefix] = chunkResults[index];
        });
      }

      return results;
    },
    enabled: !!bucket,
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
