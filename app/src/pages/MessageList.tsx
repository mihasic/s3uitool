import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowLeft, Eye, RefreshCw, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { SendMessageModal } from "@/components/SendMessageModal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { getErrorMessage, reportError } from "@/lib/errors";
import type { Message } from "@/types/s3";

const route = getRouteApi("/sqs/$queueName");

export function MessageList() {
  const { queueName } = route.useParams();
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const queryClient = useQueryClient();
  const confirm = useConfirm();

  const messagesKey = ["messages", queueName] as const;
  const {
    data: messages = [],
    isLoading: loading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: messagesKey,
    queryFn: () => api.get<Message[]>(`sqs/queues/${queueName}/messages`),
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: (vars: { body: string; delaySeconds: number }) =>
      api.post(`sqs/queues/${queueName}/messages`, { Body: vars.body, DelaySeconds: vars.delaySeconds }),
    onSuccess: () => {
      toast.success("Message sent successfully");
      queryClient.invalidateQueries({ queryKey: messagesKey });
    },
    onError: (err) => reportError("Failed to send message", err),
  });

  const deleteMutation = useMutation({
    mutationFn: (receiptHandle: string) =>
      api.delete(`sqs/queues/${queueName}/messages/${encodeURIComponent(receiptHandle)}`),
    onSuccess: () => {
      toast.success("Message deleted successfully");
      queryClient.invalidateQueries({ queryKey: messagesKey });
    },
    onError: (err) => reportError("Failed to delete message", err),
  });

  const handleSend = async (body: string, delaySeconds: number) => {
    // Swallow rejection here; onError already surfaces it. Lets the modal close either way.
    await sendMutation.mutateAsync({ body, delaySeconds }).catch(() => {});
  };

  const handleDelete = async (receiptHandle: string) => {
    const ok = await confirm({
      title: "Delete message",
      description: "Are you sure you want to delete this message?",
      confirmText: "Delete",
      destructive: true,
    });
    if (ok) deleteMutation.mutate(receiptHandle);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link to="/sqs">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">
            <Link to="/sqs" className="hover:underline text-muted-foreground">
              Queues
            </Link>
            <span className="mx-2 text-muted-foreground">/</span>
            {queueName}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setSendModalOpen(true)}>
            <Send className="h-4 w-4 mr-2" />
            Send Message
          </Button>
        </div>
      </div>

      {error && <div className="p-4 mb-4 text-red-500 bg-red-50 rounded">{getErrorMessage(error)}</div>}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Message ID</TableHead>
              <TableHead>Body (Preview)</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {messages.map((msg) => (
              <TableRow key={msg.MessageId}>
                <TableCell className="font-mono text-xs">{msg.MessageId}</TableCell>
                <TableCell className="max-w-md truncate">{msg.Body}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="View message"
                      onClick={() => setSelectedMessage(msg)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete message"
                      onClick={() => handleDelete(msg.ReceiptHandle)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {messages.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">
                  No messages found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <SendMessageModal
        isOpen={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        onSend={handleSend}
        queueName={queueName}
      />

      <Dialog open={!!selectedMessage} onOpenChange={(open) => !open && setSelectedMessage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Message Details</DialogTitle>
            <DialogDescription>ID: {selectedMessage?.MessageId}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <h4 className="font-medium leading-none">Body</h4>
              <div className="p-4 bg-muted rounded-md whitespace-pre-wrap font-mono text-sm max-h-[400px] overflow-y-auto">
                {selectedMessage?.Body}
              </div>
            </div>
            {selectedMessage?.Attributes && Object.keys(selectedMessage.Attributes).length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium leading-none">Attributes</h4>
                <div className="p-4 bg-muted rounded-md font-mono text-sm">
                  <pre>{JSON.stringify(selectedMessage.Attributes, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
