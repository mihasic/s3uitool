import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Database, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBuckets } from "@/hooks/useApi";
import { profileKey, useProfileId } from "@/hooks/useProfileApi";
import { getErrorMessage } from "@/lib/errors";

export function BucketList() {
  const { data: buckets = [], isLoading: loading, error } = useBuckets();
  const queryClient = useQueryClient();
  const profile = useProfileId();

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
      <div className="grid gap-4 md:grid-cols-3">
        {buckets.map((bucket) => (
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
        {buckets.length === 0 && <div className="col-span-3 text-center text-muted-foreground">No buckets found.</div>}
      </div>
    </div>
  );
}
