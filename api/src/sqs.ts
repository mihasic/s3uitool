import {
  DeleteMessageCommand,
  GetQueueUrlCommand,
  ListQueuesCommand,
  PurgeQueueCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  type SQSClient,
} from "@aws-sdk/client-sqs";
import { Hono } from "hono";
import { getSqsClient } from "./aws.ts";
import { listOf, model, nullable, respondWith, str, stringMap, withDefault } from "./model.ts";

const queueModel = model({
  Url: str,
  Name: str,
});

const messageModel = model({
  MessageId: withDefault(str, ""),
  ReceiptHandle: withDefault(str, ""),
  Body: withDefault(str, ""),
  MD5OfBody: withDefault(str, ""),
  Attributes: nullable(stringMap),
});

export const sqsRoutes = new Hono();

async function queueUrl(sqs: SQSClient, name: string): Promise<string> {
  const response = await sqs.send(new GetQueueUrlCommand({ QueueName: name }));
  return response.QueueUrl ?? "";
}

sqsRoutes.get("/queues", async () => {
  const response = await getSqsClient().send(new ListQueuesCommand({}));
  return respondWith(
    listOf(queueModel),
    (response.QueueUrls ?? []).map((url) => ({ Url: url, Name: url.split("/").pop() ?? url })),
  );
});

sqsRoutes.get("/queues/:queueName/messages", async (c) => {
  const sqs = getSqsClient();
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

  return respondWith(listOf(messageModel), response.Messages ?? []);
});

sqsRoutes.post("/queues/:queueName/messages", async (c) => {
  const sqs = getSqsClient();
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
  const sqs = getSqsClient();
  await sqs.send(
    new DeleteMessageCommand({
      QueueUrl: await queueUrl(sqs, c.req.param("queueName")),
      ReceiptHandle: c.req.param("receiptHandle"),
    }),
  );
  return c.json({ message: "Message deleted successfully" });
});

sqsRoutes.post("/queues/:queueName/purge", async (c) => {
  const sqs = getSqsClient();
  await sqs.send(new PurgeQueueCommand({ QueueUrl: await queueUrl(sqs, c.req.param("queueName")) }));
  return c.json({ message: "Queue purged successfully" });
});
