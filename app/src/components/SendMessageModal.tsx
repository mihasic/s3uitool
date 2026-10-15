import type { SendMessageRequest } from "@api/schema/sqs";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DialogFooter, FormDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AppMutation } from "@/lib/query-client";

interface SendMessageModalProps {
  queueName: string | null;
  onClose: () => void;
  send: AppMutation<SendMessageRequest>;
}

export function SendMessageModal({ queueName, onClose, send }: SendMessageModalProps) {
  return (
    <FormDialog
      open={queueName !== null}
      onClose={onClose}
      title="Send Message"
      description={
        <>
          Send a message to <strong>{queueName}</strong>.
        </>
      }
      className="sm:max-w-[625px]"
    >
      {queueName !== null && <SendMessageForm onClose={onClose} send={send} />}
    </FormDialog>
  );
}

function SendMessageForm({ onClose, send }: Omit<SendMessageModalProps, "queueName">) {
  const [body, setBody] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(0);

  const handleSend = () => send.mutate({ Body: body, DelaySeconds: delaySeconds }, { onSuccess: onClose });

  return (
    <>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="message-body">Message Body</Label>
          <Textarea
            id="message-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Enter message content..."
            className="min-h-[150px]"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="delay-seconds">Delay (seconds)</Label>
          <Input
            id="delay-seconds"
            type="number"
            min={0}
            max={900}
            value={delaySeconds}
            onChange={(e) => setDelaySeconds(parseInt(e.target.value, 10) || 0)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSend} disabled={!body || send.isPending}>
          Send Message
        </Button>
      </DialogFooter>
    </>
  );
}
