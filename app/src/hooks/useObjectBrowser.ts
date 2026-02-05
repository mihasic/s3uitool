import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TableItem } from "@/components/ObjectListTable";
import { api } from "@/lib/api";
import type { ObjectListResponse } from "@/types/s3";

interface PrefixParams {
  prefix: string;
  continuation_token?: string | null;
  max_keys?: number;
  filter_text?: string | null;
}

export function useObjectBrowser(bucket: string | undefined, prefix: string) {
  const [autoExpand, setAutoExpand] = useState(() => {
    return localStorage.getItem("autoExpand") === "true";
  });

  const shouldCheckAutoExpand = useRef(true);

  // State for expanded folders
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("expandedFolders");
      if (!saved) return new Set();

      const parsed: string[] = JSON.parse(saved);
      const filtered = new Set<string>();

      parsed.forEach((p) => {
        // Only keep folders that are direct children of the current prefix
        if (p.startsWith(prefix) && p !== prefix) {
          const relative = p.slice(prefix.length);
          const parts = relative.split("/").filter(Boolean);
          if (parts.length === 1) {
            filtered.add(p);
          }
        }
      });
      return filtered;
    } catch {
      return new Set();
    }
  });

  // Filter and Pagination State
  const [filterText, setFilterText] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [pageTokens, setPageTokens] = useState<(string | null)[]>([null]);
  const [pageSize, setPageSize] = useState(20);

  // Reset expanded folders and pagination on navigation
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reset on prefix change
  useEffect(() => {
    setExpandedFolders(new Set());
    shouldCheckAutoExpand.current = true;
    setFilterText("");
    setCurrentPage(0);
    setPageTokens([null]);
  }, [prefix]);

  // Trigger auto-expand check when switch is turned on
  useEffect(() => {
    if (autoExpand) {
      shouldCheckAutoExpand.current = true;
    }
  }, [autoExpand]);

  // Save autoExpand
  useEffect(() => {
    // Only persist, do not trigger fetch
    localStorage.setItem("autoExpand", String(autoExpand));
  }, [autoExpand]);

  // Save expanded folders to local storage
  useEffect(() => {
    localStorage.setItem("expandedFolders", JSON.stringify(Array.from(expandedFolders)));
  }, [expandedFolders]);

  const [folderContent, setFolderContent] = useState<Record<string, ObjectListResponse>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use a ref to track if we've already started a fetch for a specific state
  // preventing double-firing in rapid succession if not needed.
  // Ideally, useAbortedEffect or similar, but here we just cancel logic.
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestKey = useRef<string>("");

  const fetchData = useCallback(
    async (force: boolean = false) => {
      if (!bucket) return;

      const getParent = (p: string) => {
        const trimmed = p.endsWith("/") ? p.slice(0, -1) : p;
        const lastSlash = trimmed.lastIndexOf("/");
        if (lastSlash === -1) return "";
        return trimmed.slice(0, lastSlash) + "/";
      };

      // 1. Identify reachable prefixes
      // A prefix is "reachable" if all its ancestors (up to current viewing prefix) are expanded.
      // Always include the current prefix (root of view).
      const prefixesToFetch = new Set<string>();
      prefixesToFetch.add(prefix);

      const isReachable = (p: string) => {
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

      expandedFolders.forEach((p) => {
        if (p !== prefix && p.startsWith(prefix)) {
          if (isReachable(p)) {
            prefixesToFetch.add(p);
          }
        }
      });

      const requests: PrefixParams[] = Array.from(prefixesToFetch).map((p) => {
        if (p === prefix) {
          return {
            prefix: p,
            filter_text: filterText || null,
            continuation_token: pageTokens[currentPage] || null,
            max_keys: pageSize,
          };
        }
        return { prefix: p };
      });

      const requestKey = JSON.stringify({ bucket, requests });
      // If request identical to last one and not forced, skip.
      // However, if we are waiting for auto-expand check (and autoExpand is ON),
      // we must proceed even if request looks same (though usually auto-expand adds prefixes so it wouldn't match).
      // The main protection here is to stop loops when autoExpand logic is settling or off.
      if (!force && requestKey === lastRequestKey.current && !(autoExpand && shouldCheckAutoExpand.current)) {
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setLoading(true);

      try {
        lastRequestKey.current = requestKey;

        // Batch requests logic
        const BATCH_SIZE = 20;
        const results: Record<string, ObjectListResponse> = {};
        const requestChunks: PrefixParams[][] = [];

        for (let i = 0; i < requests.length; i += BATCH_SIZE) {
          requestChunks.push(requests.slice(i, i + BATCH_SIZE));
        }

        await Promise.all(
          requestChunks.map(async (chunk) => {
            if (abortController.signal.aborted) return;
            const chunkResult = await api.post<Record<string, ObjectListResponse>>(
              `s3/buckets/${bucket}/objects/batch`,
              {
                requests: chunk,
              },
              { signal: abortController.signal },
            );
            Object.assign(results, chunkResult);
          }),
        );

        if (abortController.signal.aborted) {
          return;
        }

        const rootData = results[prefix];
        if (!rootData) {
          throw new Error("Failed to load root folder");
        }

        // Update tokens if we moved to a new page or first load
        if (rootData.NextContinuationToken) {
          const nextToken = rootData.NextContinuationToken;
          setPageTokens((prev) => {
            if (prev[currentPage + 1] === nextToken) {
              return prev;
            }
            const newTokens = [...prev];
            // Ensure we don't duplicate or overwrite wrongly if things raced, but simplified:
            // We always store the next token at currentPage + 1
            newTokens[currentPage + 1] = nextToken;
            return newTokens;
          });
        }

        // Handle Auto-Expand logic:
        if (autoExpand && shouldCheckAutoExpand.current) {
          const foldersToExpand = rootData.CommonPrefixes.map((p) => p.Prefix);
          if (foldersToExpand.length > 0) {
            const missing = foldersToExpand.filter((p) => !expandedFolders.has(p));
            if (missing.length > 0) {
              const nextExpanded = new Set(expandedFolders);
              missing.forEach((p) => {
                nextExpanded.add(p);
              });
              // We set the folders to expand, this will trigger another fetch via effect
              // We set check to false to stop loop in next fetch
              shouldCheckAutoExpand.current = false;
              setExpandedFolders(nextExpanded);

              // We ALSO set the content we have now, so we don't just show loading
              setFolderContent((prev) => ({ ...prev, ...results }));
              return;
            }
          }
          // If we reached here, either no folders to expand, or all are expanded.
          // We can turn off the check.
          shouldCheckAutoExpand.current = false;
        }

        setFolderContent(results);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        // Also ignore if we aborted manually
        if (abortController.signal.aborted) return;

        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [bucket, prefix, expandedFolders, autoExpand, filterText, currentPage, pageTokens, pageSize],
  );

  // Re-fetch when bucket, prefix or expandedFolders changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const items = useMemo(() => {
    const flatten = (currentPrefix: string, depth: number): TableItem[] => {
      const content = folderContent[currentPrefix];
      if (!content) return [];

      const result: TableItem[] = [];

      // CommonPrefixes (Folders)
      content.CommonPrefixes.forEach((p) => {
        const folderName = p.Prefix.split("/").filter(Boolean).pop() || "";
        const isExpanded = expandedFolders.has(p.Prefix);
        result.push({
          key: p.Prefix,
          type: "folder",
          name: folderName,
          depth,
          isExpanded,
        });

        if (isExpanded) {
          result.push(...flatten(p.Prefix, depth + 1));
        }
      });

      // Objects (Files)
      content.Objects.forEach((o) => {
        const fileName = o.Key.split("/").pop() || o.Key;
        result.push({
          key: o.Key,
          type: "file",
          name: fileName,
          depth,
          size: o.Size,
          lastModified: o.LastModified,
          etag: o.ETag,
        });
      });

      return result;
    };

    return flatten(prefix, 0);
  }, [folderContent, expandedFolders, prefix]);

  const handleToggleFolder = (folderPrefix: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPrefix)) {
        next.delete(folderPrefix);
      } else {
        next.add(folderPrefix);
      }
      return next;
    });
  };

  const handleFilterChange = (val: string) => {
    setFilterText(val);
    setCurrentPage(0);
    setPageTokens([null]);
    setExpandedFolders(new Set());
    if (autoExpand) {
      shouldCheckAutoExpand.current = true;
    }
  };

  const handlePageChange = (p: number) => {
    setCurrentPage(p);
    setExpandedFolders(new Set());
    if (autoExpand) {
      shouldCheckAutoExpand.current = true;
    }
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(0);
    setPageTokens([null]);
    setExpandedFolders(new Set());
    if (autoExpand) {
      shouldCheckAutoExpand.current = true;
    }
  };

  return {
    items,
    loading,
    error,
    autoExpand,
    setAutoExpand,
    refresh: () => fetchData(true),
    toggleFolder: handleToggleFolder,
    filterText,
    setFilterText: handleFilterChange,
    currentPage,
    setCurrentPage: handlePageChange,
    pageTokens, // To check if next page is available
    isTruncated: folderContent[prefix]?.IsTruncated,
    pageSize,
    setPageSize: handlePageSizeChange,
  };
}
