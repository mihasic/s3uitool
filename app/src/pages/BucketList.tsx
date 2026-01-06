import { Database, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

interface Bucket {
  Name: string;
  CreationDate: string;
}

export function BucketList() {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBuckets = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<Bucket[]>("s3/buckets");
      setBuckets(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    api
      .get<Bucket[]>("s3/buckets")
      .then(setBuckets)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6">Loading buckets...</div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">S3 Buckets</h1>
        <Button variant="outline" size="icon" onClick={fetchBuckets} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {buckets.map((bucket) => (
          <Link key={bucket.Name} to={`/s3/${bucket.Name}`}>
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
