import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, RefreshCw, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQueues } from "@/hooks/useApi";
import { api } from "@/lib/api";

export function QueueList() {
  const { data: queues = [], isLoading: loading, error } = useQueues();
  const queryClient = useQueryClient();

  const purgeQueueMutation = useMutation({
    mutationFn: (queueName: string) => api.post(`sqs/queues/${queueName}/purge`, {}),
    onSuccess: () => {
      toast.success("Queue purged successfully");
      queryClient.invalidateQueries({ queryKey: ["queues"] });
    },
    onError: (err) => {
      console.error(err);
      toast.error("Failed to purge queue");
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["queues"] });
  };

  const handlePurge = async (queueName: string) => {
    if (!confirm(`Are you sure you want to purge queue ${queueName}? This will delete all messages.`)) return;
    purgeQueueMutation.mutate(queueName);
  };

  if (loading) return <div className="p-6">Loading queues...</div>;
  if (error)
    return <div className="p-6 text-red-500">Error: {error instanceof Error ? error.message : String(error)}</div>;

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">SQS Queues</h1>
        <Button variant="outline" size="icon" onClick={handleRefresh} title="Refresh">
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
                      disabled={purgeQueueMutation.isPending}
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
