import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Database, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBuckets } from "@/hooks/useApi";
import { profileKey, useProfileId } from "@/hooks/useProfileApi";
import { getErrorMessage } from "@/lib/errors";

export function BucketList() {
  const { data: buckets = [], isLoading: loading, error } = useBuckets();
  const queryClient = useQueryClient();
  const profile = useProfileId();
  const [filterText, setFilterText] = useState("");

  const filtered = useMemo(() => {
    const needle = filterText.trim().toLowerCase();
    if (!needle) return buckets;
    return buckets.filter((bucket) => bucket.Name.toLowerCase().includes(needle));
  }, [buckets, filterText]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: profileKey(profile, "buckets") });
  };

  if (loading) return <div className="p-6">Loading buckets...</div>;
  if (error) return <div className="p-6 text-red-500">Error: {getErrorMessage(error)}</div>;

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">S3 Buckets</h1>
        <Button variant="outline" size="icon" onClick={handleRefresh} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2 max-w-sm mb-6">
        <Label htmlFor="bucket-filter" className="sr-only">
          Filter
        </Label>
        <Input
          id="bucket-filter"
          placeholder="Filter buckets..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="h-8"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {filtered.map((bucket) => (
          <Link
            key={bucket.Name}
            to="/$profile/s3/$bucket"
            params={{ profile, bucket: bucket.Name }}
            search={{ prefix: "" }}
          >
            <Card className="hover:bg-accent transition-colors cursor-pointer">
              <CardHeader className="flex flex-row items-center gap-4">
                <Database className="h-8 w-8 text-blue-500" />
                <CardTitle>{bucket.Name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Created: {new Date(bucket.CreationDate).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 text-center text-muted-foreground">
            {buckets.length === 0 ? "No buckets found." : "No buckets match the filter."}
          </div>
        )}
      </div>
    </div>
  );
}
