import { z } from "zod";
import { nullable, stringMap } from "./common";

export const queueModel = z.object({
  Url: z.string(),
  Name: z.string(),
  Available: nullable(z.number()),
  InFlight: nullable(z.number()),
  Delayed: nullable(z.number()),
});

export const messageModel = z.object({
  MessageId: z.string().default(""),
  ReceiptHandle: z.string().default(""),
  Body: z.string().default(""),
  MD5OfBody: z.string().default(""),
  Attributes: nullable(stringMap),
});

export const sendMessageRequestModel = z.object({
  Body: z.string().min(1),
  DelaySeconds: z.number().int().min(0).max(900).optional(),
});

export type Queue = z.output<typeof queueModel>;
export type Message = z.output<typeof messageModel>;
export type SendMessageRequest = z.input<typeof sendMessageRequestModel>;
