import { MessageSquare, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";

interface Queue {
  Url: string;
  Name: string;
  Attributes?: Record<string, string>;
}

export function QueueList() {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchQueues = useCallback(() => {
    setLoading(true);
    api
      .get<Queue[]>("sqs/queues")
      .then(setQueues)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchQueues();
  }, [fetchQueues]);

  const handlePurge = async (queueName: string) => {
    if (!confirm(`Are you sure you want to purge queue ${queueName}? This will delete all messages.`)) return;
    try {
      await api.post(`sqs/queues/${queueName}/purge`, {});
      toast.success("Queue purged successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to purge queue");
    }
  };

  if (loading) return <div className="p-6">Loading queues...</div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">SQS Queues</h1>
        <Button variant="outline" size="icon" onClick={fetchQueues} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>URL</TableHead>
              <TableHead className="w-[150px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queues.map((queue) => (
              <TableRow key={queue.Url}>
                <TableCell className="font-medium">
                  <Link to={`/sqs/${queue.Name}`} className="hover:underline text-blue-600">
                    {queue.Name}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{queue.Url}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" asChild title="View Messages">
                      <Link to={`/sqs/${queue.Name}`}>
                        <MessageSquare className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePurge(queue.Name)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      title="Purge Queue"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {queues.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                  No queues found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
