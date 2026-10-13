import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SendMessageFormProps {
  onClose: () => void;
  onSend: (body: string, delaySeconds: number) => void;
}

interface SendMessageModalProps extends SendMessageFormProps {
  isOpen: boolean;
  queueName: string;
}

export function SendMessageModal({ isOpen, queueName, ...props }: SendMessageModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>Send Message</DialogTitle>
          <DialogDescription>
            Send a message to <strong>{queueName}</strong>.
          </DialogDescription>
        </DialogHeader>
        <SendMessageForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function SendMessageForm({ onClose, onSend }: SendMessageFormProps) {
  const [body, setBody] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(0);

  const handleSend = () => {
    onSend(body, delaySeconds);
    onClose();
  };

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
        <Button onClick={handleSend} disabled={!body}>
          Send Message
        </Button>
      </DialogFooter>
    </>
  );
}
