import type { ObjectList, ObjectListParams } from "@api/schema/s3";
import {
  keepPreviousData,
  partialMatchKey,
  type Query,
  type UseQueryResult,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { objectsKey } from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import { useProfileApi, useProfileId } from "@/hooks/useProfileApi";
import { bucketPath, withSearch } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { buildItems, reachablePrefixes } from "@/lib/object-tree";
import type { ViewMode } from "@/types/s3";

function savedViewMode(): ViewMode {
  const saved = localStorage.getItem("viewMode");
  return saved === "folder" || saved === "tree" || saved === "flat" ? saved : "folder";
}

export const PAGE_SIZES = [5, 10, 20, 50, 100];

function savedPageSize(): number {
  const saved = Number(localStorage.getItem("pageSize"));
  return PAGE_SIZES.includes(saved) ? saved : 20;
}

export interface Listing {
  prefix: string;
  flat: boolean;
}

export function listingOf(query: Query, profile: string, bucket: string): Listing | null {
  const bucketKey = objectsKey(profile, bucket);
  if (query.queryKey.length !== bucketKey.length + 1 || !partialMatchKey(query.queryKey, bucketKey)) return null;
  const params = query.queryKey[bucketKey.length] as ObjectListParams;
  return { prefix: params.prefix ?? "", flat: params.delimiter === "" };
}

function combineListings(results: UseQueryResult<ObjectList>[]) {
  const listings = new Map<string, ObjectList>();
  for (const { data } of results) {
    if (data) listings.set(data.Prefix, data);
  }
  return { listings, isFetching: results.some((result) => result.isFetching) };
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
  const [pageSize, setPageSize] = useState(savedPageSize);

  const bucketKey = objectsKey(profile, bucket);
  const listing = (params: ObjectListParams) => ({
    queryKey: [...bucketKey, params],
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      api.get<ObjectList>(withSearch(`${bucketPath(bucket)}/objects`, params), { signal }),
    staleTime: 0,
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
  const children = useQueries({
    queries: childPrefixes.map((p) => listing({ prefix: p })),
    combine: combineListings,
  });

  const listings = root.data ? new Map(children.listings).set(prefix, root.data) : children.listings;

  const nextToken = rootData?.NextContinuationToken;
  const knownTokens =
    nextToken && pageTokens[currentPage + 1] !== nextToken
      ? pageTokens.toSpliced(currentPage + 1, 1, nextToken)
      : pageTokens;

  const resetTree = () => {
    setExpanded(new Set());
    setAutoExpand(true);
  };

  const resetPaging = () => {
    setCurrentPage(0);
    setPageTokens([null]);
    resetTree();
  };

  return {
    items: buildItems(prefix, viewMode, listings, expandedFolders),
    loading: root.isFetching || children.isFetching,
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
      resetPaging();
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
      localStorage.setItem("pageSize", String(size));
      setPageSize(size);
      resetPaging();
    },
  };
}
