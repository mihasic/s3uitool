import type { ObjectList } from "@api/schema/s3";
import { keepPreviousData, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { objectsKey } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import { useProfileApi, useProfileId } from "@/hooks/useProfileApi";
import { bucketPath } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { buildItems, reachablePrefixes } from "@/lib/object-tree";
import type { ViewMode } from "@/types/s3";

interface ListingParams {
  prefix: string;
  filter_text?: string;
  continuation_token?: string;
  max_keys?: number;
  delimiter?: string;
}

function savedViewMode(): ViewMode {
  const saved = localStorage.getItem("viewMode");
  return saved === "folder" || saved === "tree" || saved === "flat" ? saved : "folder";
}

function listingSearch(params: ListingParams): string {
  const search = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined) search.set(name, String(value));
  }
  return search.toString();
}

export function useObjectBrowser(bucket: string, prefix: string) {
  const api = useProfileApi();
  const profile = useProfileId();
  const queryClient = useQueryClient();

  const [viewMode, setViewModeState] = useState<ViewMode>(savedViewMode);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [autoExpand, setAutoExpand] = useState(true);
  const [rawFilterText, setRawFilterText] = useState("");
  const filterText = useDebounce(rawFilterText, 500);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageTokens, setPageTokens] = useState<(string | null)[]>([null]);
  const [pageSize, setPageSize] = useState(20);

  const bucketKey = objectsKey(profile, bucket);
  const listing = (params: ListingParams) => ({
    queryKey: [...bucketKey, params],
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      api.get<ObjectList>(`${bucketPath(bucket)}/objects?${listingSearch(params)}`, { signal }),
  });

  const root = useQuery({
    ...listing({
      prefix,
      filter_text: filterText || undefined,
      continuation_token: pageTokens[currentPage] ?? undefined,
      max_keys: pageSize,
      delimiter: viewMode === "flat" ? "" : "/",
    }),
    placeholderData: keepPreviousData,
  });
  const rootData = root.isPlaceholderData ? undefined : root.data;

  const expandedFolders =
    viewMode === "tree" && autoExpand && rootData
      ? new Set([...expanded, ...rootData.CommonPrefixes.map((p) => p.Prefix)])
      : expanded;

  const childPrefixes = viewMode === "flat" ? [] : reachablePrefixes(prefix, expandedFolders);
  const children = useQueries({ queries: childPrefixes.map((p) => listing({ prefix: p })) });

  const listings = new Map<string, ObjectList>();
  childPrefixes.forEach((p, i) => {
    const data = children[i]?.data;
    if (data) listings.set(p, data);
  });
  if (root.data) listings.set(prefix, root.data);

  const nextToken = rootData?.NextContinuationToken;
  const knownTokens =
    nextToken && pageTokens[currentPage + 1] !== nextToken
      ? pageTokens.toSpliced(currentPage + 1, 1, nextToken)
      : pageTokens;

  const resetTree = () => {
    setExpanded(new Set());
    setAutoExpand(true);
  };

  return {
    items: buildItems(prefix, viewMode, listings, expandedFolders),
    loading: root.isFetching || children.some((q) => q.isFetching),
    error: root.error ? getErrorMessage(root.error) : null,
    viewMode,
    setViewMode: (mode: ViewMode) => {
      localStorage.setItem("viewMode", mode);
      setViewModeState(mode);
      if (mode === "tree") setAutoExpand(true);
    },
    refresh: () => queryClient.invalidateQueries({ queryKey: bucketKey }),
    toggleFolder: (folder: string) => {
      const next = new Set(expandedFolders);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      setExpanded(next);
      setAutoExpand(false);
    },
    filterText: rawFilterText,
    setFilterText: (text: string) => {
      setRawFilterText(text);
      setCurrentPage(0);
      setPageTokens([null]);
      resetTree();
    },
    currentPage,
    setCurrentPage: (page: number) => {
      setPageTokens(knownTokens);
      setCurrentPage(page);
      resetTree();
    },
    pageTokens: knownTokens,
    pageSize,
    setPageSize: (size: number) => {
      setPageSize(size);
      setCurrentPage(0);
      setPageTokens([null]);
      resetTree();
    },
  };
}
