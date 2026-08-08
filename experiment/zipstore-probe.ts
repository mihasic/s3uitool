// Prototype: client-zip (STORE) vs the shipped fflate (DEFLATE) streaming writer.
import { makeZip } from "client-zip";
import { zipStream } from "../api/src/zip.ts";

// Probe-only: let the harness override the fflate level.
import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "../api/node_modules/@aws-sdk/client-s3/dist-es/index.js";

const s3 = new S3Client({
  endpoint: "http://localhost:19000",
  region: "us-east-1",
  forcePathStyle: true,
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

async function* files(bucket: string, prefix: string) {
  let token: string | undefined;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
    for (const o of page.Contents ?? []) {
      if (!o.Key || o.Key.endsWith("/")) continue;
      const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: o.Key }));
      yield { name: o.Key.slice(prefix.length), input: obj.Body!.transformToWebStream(), size: o.Size };
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
}

const [mode, bucket, prefix] = process.argv.slice(2);
let peak = 0;
const sample = setInterval(() => {
  peak = Math.max(peak, process.memoryUsage().rss);
}, 50);

let bytes = 0;
async function* renamed() {
  for await (const f of files(bucket as string, prefix ?? "")) yield { name: f.name, data: f.input };
}
const stream =
  mode === "store"
    ? makeZip(files(bucket as string, prefix ?? ""))
    : zipStream(renamed());
const reader = stream.getReader();
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  bytes += value.length;
}
clearInterval(sample);
console.log(JSON.stringify({ mode, bytes, peakRssMiB: Math.round(peak / 1048576) }));
