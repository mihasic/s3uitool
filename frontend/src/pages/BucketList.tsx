import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Database } from "lucide-react";

interface Bucket {
  Name: string;
  CreationDate: string;
}

export function BucketList() {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Bucket[]>("s3/buckets")
      .then(setBuckets)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6">Loading buckets...</div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">S3 Buckets</h1>
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
        {buckets.length === 0 && (
          <div className="col-span-3 text-center text-muted-foreground">
            No buckets found.
          </div>
        )}
      </div>
    </div>
  );
}
