import { useCallback, useEffect, useMemo, useState } from "react";
import type { TableItem } from "@/components/ObjectListTable";
import { api } from "@/lib/api";
import type { ObjectListResponse } from "@/types/s3";

export function useObjectBrowser(bucket: string | undefined, prefix: string) {
  const [autoExpand, setAutoExpand] = useState(() => {
    return localStorage.getItem("autoExpand") === "true";
  });

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

  // Reset expanded folders on navigation
  // biome-ignore lint/correctness/useExhaustiveDependencies: Reset on prefix change
  useEffect(() => {
    setExpandedFolders(new Set());
  }, [prefix]);

  // Save autoExpand
  useEffect(() => {
    localStorage.setItem("autoExpand", String(autoExpand));
  }, [autoExpand]);

  // Save expanded folders to local storage
  useEffect(() => {
    localStorage.setItem("expandedFolders", JSON.stringify(Array.from(expandedFolders)));
  }, [expandedFolders]);

  const [folderContent, setFolderContent] = useState<Record<string, ObjectListResponse>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!bucket) return;
    setLoading(true);

    try {
      // 1. Always fetch the root prefix content first
      const rootData = await api.get<ObjectListResponse>(
        `s3/buckets/${bucket}/objects?prefix=${encodeURIComponent(prefix)}`,
      );

      // Handle Auto-Expand logic:
      if (autoExpand) {
        const foldersToExpand = rootData.CommonPrefixes.map((p) => p.Prefix);
        if (foldersToExpand.length > 0) {
          const missing = foldersToExpand.some((p) => !expandedFolders.has(p));
          if (missing) {
            const nextExpanded = new Set(expandedFolders);
            foldersToExpand.forEach((p) => void nextExpanded.add(p));
            setExpandedFolders(nextExpanded);
            setFolderContent((prev) => ({ ...prev, [prefix]: rootData }));
            return;
          }
        }
      }

      const prefixesToFetch = new Set<string>();
      prefixesToFetch.add(prefix);

      // Fetch expanded folders if they are relevant
      expandedFolders.forEach((p) => {
        if (p !== prefix && p.startsWith(prefix)) {
          prefixesToFetch.add(p);
        }
      });

      const results = await Promise.all(
        Array.from(prefixesToFetch).map(async (p) => {
          if (p === prefix && rootData) return { prefix: p, data: rootData };

          const res = await api.get<ObjectListResponse>(`s3/buckets/${bucket}/objects?prefix=${encodeURIComponent(p)}`);
          return { prefix: p, data: res };
        }),
      );

      const newContent: Record<string, ObjectListResponse> = {};
      results.forEach((r) => {
        newContent[r.prefix] = r.data;
      });
      setFolderContent(newContent);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [bucket, prefix, expandedFolders, autoExpand]);

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

  return {
    items,
    loading,
    error,
    autoExpand,
    setAutoExpand,
    refresh: fetchData,
    toggleFolder: handleToggleFolder,
  };
}
