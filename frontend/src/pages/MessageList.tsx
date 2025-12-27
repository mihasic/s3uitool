import { ArrowLeft, Eye, RefreshCw, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { SendMessageModal } from "@/components/SendMessageModal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";

interface Message {
	MessageId: string;
	ReceiptHandle: string;
	Body: string;
	MD5OfBody: string;
	Attributes?: Record<string, string>;
}

export function MessageList() {
	const { queueName } = useParams<{ queueName: string }>();
	const [messages, setMessages] = useState<Message[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [sendModalOpen, setSendModalOpen] = useState(false);
	const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

	const fetchMessages = useCallback(async () => {
		if (!queueName) return;
		setLoading(true);
		try {
			const data = await api.get<Message[]>(`sqs/queues/${queueName}/messages`);
			setMessages(data);
			setError(null);
		} catch (err: unknown) {
			setError((err as Error).message);
		} finally {
			setLoading(false);
		}
	}, [queueName]);

	useEffect(() => {
		fetchMessages();
		// Poll every 5 seconds
		const interval = setInterval(fetchMessages, 5000);
		return () => clearInterval(interval);
	}, [fetchMessages]);

	const handleSend = async (body: string, delaySeconds: number) => {
		if (!queueName) return;
		try {
			await api.post(`sqs/queues/${queueName}/messages`, {
				Body: body,
				DelaySeconds: delaySeconds,
			});
			toast.success("Message sent successfully");
			fetchMessages();
		} catch (err) {
			console.error(err);
			toast.error("Failed to send message");
		}
	};

	const handleDelete = async (receiptHandle: string) => {
		if (!queueName || !confirm("Are you sure you want to delete this message?")) return;
		try {
			await api.delete(`sqs/queues/${queueName}/messages/${encodeURIComponent(receiptHandle)}`);
			// Optimistic update or refresh
			setMessages((prev) => prev.filter((m) => m.ReceiptHandle !== receiptHandle));
			toast.success("Message deleted successfully");
		} catch (err) {
			console.error(err);
			toast.error("Failed to delete message");
		}
	};

	if (!queueName) return <div>Invalid queue name</div>;

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
					<Button variant="outline" onClick={fetchMessages} disabled={loading}>
						<RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
						Refresh
					</Button>
					<Button onClick={() => setSendModalOpen(true)}>
						<Send className="h-4 w-4 mr-2" />
						Send Message
					</Button>
				</div>
			</div>

			{error && <div className="p-4 mb-4 text-red-500 bg-red-50 rounded">{error}</div>}

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
										<Button variant="ghost" size="icon" onClick={() => setSelectedMessage(msg)}>
											<Eye className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
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
