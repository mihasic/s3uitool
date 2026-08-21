import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MessageSquare, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQueues } from "@/hooks/useApi";
import { profileKey, useProfileApi, useProfileId } from "@/hooks/useProfileApi";
import { getErrorMessage, reportError } from "@/lib/errors";
import type { Queue } from "@/types/s3";

function QueueCounts({ queue }: { queue: Queue }) {
  if (queue.Available === null) return <span className="text-muted-foreground">&mdash;</span>;
  const extra = [
    queue.InFlight ? `${queue.InFlight} in flight` : null,
    queue.Delayed ? `${queue.Delayed} delayed` : null,
  ].filter(Boolean);
  return (
    <div className="flex items-baseline gap-2">
      <span className="tabular-nums font-medium">{queue.Available}</span>
      {extra.length > 0 && <span className="text-xs text-muted-foreground">{extra.join(", ")}</span>}
    </div>
  );
}

export function QueueList() {
  const { data: queues = [], isLoading: loading, error } = useQueues();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const api = useProfileApi();
  const profile = useProfileId();

  const purgeQueueMutation = useMutation({
    mutationFn: (queueName: string) => api.post(`sqs/queues/${queueName}/purge`, {}),
    onSuccess: () => {
      toast.success("Queue purged successfully");
      queryClient.invalidateQueries({ queryKey: profileKey(profile, "queues") });
    },
    onError: (err) => {
      reportError("Failed to purge queue", err);
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: profileKey(profile, "queues") });
  };

  const handlePurge = async (queueName: string) => {
    const ok = await confirm({
      title: "Purge queue",
      description: `Purge queue ${queueName}? This will delete all messages.`,
      confirmText: "Purge",
      destructive: true,
    });
    if (ok) purgeQueueMutation.mutate(queueName);
  };

  if (loading) return <div className="p-6">Loading queues...</div>;
  if (error) return <div className="p-6 text-red-500">Error: {getErrorMessage(error)}</div>;

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
              <TableHead className="w-[170px]">Messages</TableHead>
              <TableHead>URL</TableHead>
              <TableHead className="w-[150px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queues.map((queue) => (
              <TableRow key={queue.Url}>
                <TableCell className="font-medium">
                  <Link
                    to="/$profile/sqs/$queueName"
                    params={{ profile, queueName: queue.Name }}
                    className="hover:underline text-blue-600"
                  >
                    {queue.Name}
                  </Link>
                </TableCell>
                <TableCell>
                  <QueueCounts queue={queue} />
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{queue.Url}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" asChild title="View Messages">
                      <Link to="/$profile/sqs/$queueName" params={{ profile, queueName: queue.Name }}>
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
                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
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
