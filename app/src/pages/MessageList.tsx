import type { Message, SendMessageRequest } from "@api/schema/sqs";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, Link } from "@tanstack/react-router";
import { ArrowLeft, Eye, Loader2, RefreshCw, Send, Trash2 } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { useConfirm } from "@/components/ConfirmDialog";
import { SendMessageModal } from "@/components/SendMessageModal";
import { Button } from "@/components/ui/button";
import { FormDialog } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { messagesKey } from "@/hooks/useApi";
import { useProfileApi } from "@/hooks/useProfileApi";
import { queuePath } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { detectLanguage } from "@/lib/file-utils";
import { useAppMutation } from "@/lib/query-client";

// Monaco is most of the bundle — pull it in only when a message is opened.
const FileViewer = lazy(() => import("@/components/FileViewer").then((m) => ({ default: m.FileViewer })));

const route = getRouteApi("/$profile/sqs/$queueName");

export function MessageList() {
  const { profile, queueName } = route.useParams();
  const api = useProfileApi();
  const [sendTo, setSendTo] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const confirm = useConfirm();

  const queryKey = messagesKey(profile, queueName);
  const {
    data: messages = [],
    isLoading: loading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () => api.get<Message[]>(`${queuePath(queueName)}/messages`),
    refetchInterval: 5000,
  });

  const sendMutation = useAppMutation({
    mutationFn: (request: SendMessageRequest) => api.post(`${queuePath(queueName)}/messages`, request),
    error: "Failed to send message",
    success: "Message sent successfully",
    invalidates: queryKey,
  });

  const deleteMutation = useAppMutation({
    mutationFn: (receiptHandle: string) =>
      api.delete(`${queuePath(queueName)}/messages/${encodeURIComponent(receiptHandle)}`),
    error: "Failed to delete message",
    success: "Message deleted successfully",
    invalidates: queryKey,
  });

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
            <Link to="/$profile/sqs" params={{ profile }}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">
            <Link to="/$profile/sqs" params={{ profile }} className="hover:underline text-muted-foreground">
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
          <Button onClick={() => setSendTo(queueName)}>
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

      <SendMessageModal queueName={sendTo} onClose={() => setSendTo(null)} send={sendMutation} />

      <FormDialog
        open={selectedMessage !== null}
        onClose={() => setSelectedMessage(null)}
        title="Message Details"
        description={selectedMessage && `ID: ${selectedMessage.MessageId}`}
        className="max-w-4xl h-[80vh] flex flex-col"
      >
        {selectedMessage && (
          <div className="flex-1 min-h-0 flex flex-col gap-4">
            <div className="flex-1 min-h-0 flex flex-col gap-2">
              <h4 className="font-medium leading-none">Body</h4>
              <div className="flex-1 min-h-0">
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  }
                >
                  <FileViewer
                    key={selectedMessage.MessageId}
                    content={selectedMessage.Body}
                    language={detectLanguage(selectedMessage.Body)}
                  />
                </Suspense>
              </div>
            </div>
            {selectedMessage.Attributes && Object.keys(selectedMessage.Attributes).length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium leading-none">Attributes</h4>
                <div className="p-4 bg-muted rounded-md font-mono text-sm max-h-32 overflow-y-auto">
                  <pre>{JSON.stringify(selectedMessage.Attributes, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        )}
      </FormDialog>
    </div>
  );
}
