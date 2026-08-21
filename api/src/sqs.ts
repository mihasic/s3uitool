import {
  DeleteMessageCommand,
  GetQueueAttributesCommand,
  GetQueueUrlCommand,
  ListQueuesCommand,
  PurgeQueueCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  type SQSClient,
} from "@aws-sdk/client-sqs";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { getSqsClient } from "./aws";
import type { AppEnv } from "./context";
import { nullable, respondWith, stringMap } from "./model";

const queueModel = z.object({
  Url: z.string(),
  Name: z.string(),
  Available: nullable(z.number()),
  InFlight: nullable(z.number()),
  Delayed: nullable(z.number()),
});

const COUNT_ATTRIBUTES = [
  "ApproximateNumberOfMessages",
  "ApproximateNumberOfMessagesNotVisible",
  "ApproximateNumberOfMessagesDelayed",
] as const;

const count = (attributes: Record<string, string> | undefined, name: string): number | null => {
  const value = Number(attributes?.[name]);
  return Number.isFinite(value) ? value : null;
};

async function queueCounts(sqs: SQSClient, url: string) {
  try {
    const { Attributes } = await sqs.send(
      new GetQueueAttributesCommand({ QueueUrl: url, AttributeNames: [...COUNT_ATTRIBUTES] }),
    );
    return {
      Available: count(Attributes, "ApproximateNumberOfMessages"),
      InFlight: count(Attributes, "ApproximateNumberOfMessagesNotVisible"),
      Delayed: count(Attributes, "ApproximateNumberOfMessagesDelayed"),
    };
  } catch {
    return { Available: null, InFlight: null, Delayed: null };
  }
}

const messageModel = z.object({
  MessageId: z.string().default(""),
  ReceiptHandle: z.string().default(""),
  Body: z.string().default(""),
  MD5OfBody: z.string().default(""),
  Attributes: nullable(stringMap),
});

export const sqsRoutes = new Hono<AppEnv>();

sqsRoutes.use("*", async (c, next) => {
  const profile = c.get("profile");
  if (!profile.sqs) throw new HTTPException(404, { message: `SQS is not enabled for profile "${profile.id}"` });
  c.set("sqs", getSqsClient(profile));
  await next();
});

async function queueUrl(sqs: SQSClient, name: string): Promise<string> {
  const response = await sqs.send(new GetQueueUrlCommand({ QueueName: name }));
  return response.QueueUrl ?? "";
}

sqsRoutes.get("/queues", async (c) => {
  const sqs = c.get("sqs");
  const response = await sqs.send(new ListQueuesCommand({}));
  const queues = await Promise.all(
    (response.QueueUrls ?? []).map(async (url) => ({
      Url: url,
      Name: url.split("/").pop() ?? url,
      ...(await queueCounts(sqs, url)),
    })),
  );
  return respondWith(z.array(queueModel), queues);
});

sqsRoutes.get("/queues/:queueName/messages", async (c) => {
  const sqs = c.get("sqs");
  const response = await sqs.send(
    new ReceiveMessageCommand({
      QueueUrl: await queueUrl(sqs, c.req.param("queueName")),
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 0, // Short polling
      VisibilityTimeout: 0, // Make messages visible again immediately (peek mode)
      MessageSystemAttributeNames: ["All"],
      MessageAttributeNames: ["All"],
    }),
  );

  return respondWith(z.array(messageModel), response.Messages ?? []);
});

sqsRoutes.post("/queues/:queueName/messages", async (c) => {
  const sqs = c.get("sqs");
  const body = await c.req.json<{ Body: string; DelaySeconds?: number }>();
  await sqs.send(
    new SendMessageCommand({
      QueueUrl: await queueUrl(sqs, c.req.param("queueName")),
      MessageBody: body.Body,
      DelaySeconds: body.DelaySeconds ?? 0,
    }),
  );
  return c.json({ message: "Message sent successfully" });
});

sqsRoutes.delete("/queues/:queueName/messages/:receiptHandle{.+}", async (c) => {
  const sqs = c.get("sqs");
  await sqs.send(
    new DeleteMessageCommand({
      QueueUrl: await queueUrl(sqs, c.req.param("queueName")),
      ReceiptHandle: c.req.param("receiptHandle"),
    }),
  );
  return c.json({ message: "Message deleted successfully" });
});

sqsRoutes.post("/queues/:queueName/purge", async (c) => {
  const sqs = c.get("sqs");
  await sqs.send(new PurgeQueueCommand({ QueueUrl: await queueUrl(sqs, c.req.param("queueName")) }));
  return c.json({ message: "Queue purged successfully" });
});
