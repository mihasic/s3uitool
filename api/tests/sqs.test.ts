import { beforeAll, describe, expect, test } from "bun:test";
import { app } from "../src/app.ts";

const QUEUE = "test-queue-1";

describe("sqs", () => {
  beforeAll(async () => {
    await app.request(`/api/sqs/queues/${QUEUE}/purge`, { method: "POST" });
  });

  test("lists queues", async () => {
    const res = await app.request("/api/sqs/queues");
    expect(res.status).toBe(200);
    const queues = (await res.json()) as { Name: string; Url: string }[];
    expect(Array.isArray(queues)).toBe(true);
    expect(queues.map((q) => q.Name)).toContain(QUEUE);
    expect(queues[0]?.Url).toStartWith("http");
  });

  test("sends and receives a message", async () => {
    const messageBody = "Test Message";

    const send = await app.request(`/api/sqs/queues/${QUEUE}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Body: messageBody }),
    });
    expect(send.status).toBe(200);
    expect(await send.json()).toEqual({ message: "Message sent successfully" });

    const receive = await app.request(`/api/sqs/queues/${QUEUE}/messages`);
    expect(receive.status).toBe(200);
    const messages = (await receive.json()) as { Body: string; ReceiptHandle: string; Attributes: unknown }[];
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.some((m) => m.Body === messageBody)).toBe(true);
    // VisibilityTimeout=0 means peeking must not hide the message from the next read.
    expect(
      ((await (await app.request(`/api/sqs/queues/${QUEUE}/messages`)).json()) as unknown[]).length,
    ).toBeGreaterThan(0);
  });

  test("deletes a message by receipt handle", async () => {
    await app.request(`/api/sqs/queues/${QUEUE}/purge`, { method: "POST" });
    await app.request(`/api/sqs/queues/${QUEUE}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Body: "delete me" }),
    });

    const [message] = (await (await app.request(`/api/sqs/queues/${QUEUE}/messages`)).json()) as {
      ReceiptHandle: string;
    }[];
    expect(message).toBeDefined();

    const res = await app.request(
      `/api/sqs/queues/${QUEUE}/messages/${encodeURIComponent((message as { ReceiptHandle: string }).ReceiptHandle)}`,
      { method: "DELETE" },
    );
    expect(await res.json()).toEqual({ message: "Message deleted successfully" });
    expect(await (await app.request(`/api/sqs/queues/${QUEUE}/messages`)).json()).toEqual([]);
  });

  test("purges a queue", async () => {
    await app.request(`/api/sqs/queues/${QUEUE}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Body: "purge me" }),
    });
    const res = await app.request(`/api/sqs/queues/${QUEUE}/purge`, { method: "POST" });
    expect(await res.json()).toEqual({ message: "Queue purged successfully" });
  });

  test("returns 404 for an unknown queue", async () => {
    const res = await app.request("/api/sqs/queues/no-such-queue-xyz/messages");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ detail: "Queue not found" });
  });
});
