/**
 * Response-parity harness for the FastAPI ↔ Hono comparison.
 *
 * Every check is executed against both base URLs and the two responses are diffed
 * on status, selected headers and (normalised) body. Read-only checks hit the same
 * underlying objects on both stacks, so volatile values like ETag/LastModified line
 * up naturally. Mutating checks are given a per-stack namespace, which is normalised
 * back out before comparing.
 *
 *   bun experiment/parity.ts http://localhost:18000 http://localhost:18001
 */
import { unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [pyBase, tsBase] = process.argv.slice(2);
if (!pyBase || !tsBase) {
  console.error("usage: bun experiment/parity.ts <python-base-url> <hono-base-url>");
  process.exit(2);
}

const NS = "__NS__";
const HEADERS_OF_INTEREST = [
  "content-type",
  "content-disposition",
  "access-control-allow-origin",
  "access-control-allow-credentials",
];

type Probe = {
  name: string;
  /** `path` may contain `__NS__`, replaced with a per-stack namespace for mutations. */
  path: string;
  init?: (ns: string) => RequestInit;
  /** How to turn the response body into something comparable. */
  body?: "json" | "text" | "zip" | "none";
  /** Extra normalisation applied to the stringified body. */
  scrub?: (text: string) => string;
  /**
   * Set for probes that write data: the two stacks write at different instants and
   * into different namespaces, so ETag/LastModified legitimately diverge.
   */
  volatileObjects?: boolean;
};

type Snapshot = { status: number; headers: Record<string, string | null>; body: string };

const json = (value: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(value),
});

/** Volatile values that legitimately differ between two independent runs. */
function scrubCommon(text: string): string {
  return text
    .replaceAll(/"ReceiptHandle":"[^"]*"/g, '"ReceiptHandle":"<handle>"')
    .replaceAll(/"MessageId":"[^"]*"/g, '"MessageId":"<id>"')
    .replaceAll(/"NextContinuationToken":"[^"]*"/g, '"NextContinuationToken":"<token>"')
    .replaceAll(/"SentTimestamp":"\d+"/g, '"SentTimestamp":"<ts>"')
    .replaceAll(/"ApproximateFirstReceiveTimestamp":"\d+"/g, '"ApproximateFirstReceiveTimestamp":"<ts>"')
    .replaceAll(/"ApproximateReceiveCount":"\d+"/g, '"ApproximateReceiveCount":"<n>"');
}

/** Decode an archive to `{name: contents}` using the system unzip. */
async function unzipEntries(buf: Uint8Array): Promise<Record<string, string>> {
  if (buf.length === 0) return {};
  const path = join(tmpdir(), `parity-${buf.length}-${buf[buf.length - 1]}.zip`);
  await Bun.write(path, buf);
  try {
    const names = (await new Response(Bun.spawn(["zipinfo", "-1", path]).stdout).text())
      .split("\n")
      .filter(Boolean)
      .sort();
    const entries: Record<string, string> = {};
    for (const name of names) {
      entries[name] = await new Response(Bun.spawn(["unzip", "-p", path, name]).stdout).text();
    }
    return entries;
  } finally {
    unlinkSync(path);
  }
}

async function snapshot(base: string, probe: Probe, ns: string): Promise<Snapshot> {
  const path = probe.path.replaceAll(NS, ns);
  const res = await fetch(base + path, probe.init?.(ns) ?? {});

  const headers: Record<string, string | null> = {};
  for (const h of HEADERS_OF_INTEREST) headers[h] = res.headers.get(h)?.replaceAll(ns, NS) ?? null;

  let body = "";
  switch (probe.body ?? "json") {
    case "none":
      await res.arrayBuffer();
      break;
    case "text":
      body = await res.text();
      break;
    case "zip": {
      // Zip bytes embed mtimes (and fflate streams with data descriptors while
      // zipfile does not), so compare the decoded entries instead of raw bytes.
      body = JSON.stringify(await unzipEntries(new Uint8Array(await res.arrayBuffer())));
      break;
    }
    default: {
      const text = await res.text();
      try {
        body = JSON.stringify(JSON.parse(text));
      } catch {
        body = text;
      }
    }
  }

  body = scrubCommon(body).replaceAll(ns, NS);
  if (probe.volatileObjects) {
    body = body
      // ETag values are JSON strings containing escaped quotes.
      .replaceAll(/"ETag":"(?:\\.|[^"\\])*"/g, '"ETag":"<etag>"')
      .replaceAll(/"LastModified":"[^"]*"/g, '"LastModified":"<ts>"');
  }
  if (probe.scrub) body = probe.scrub(body);
  return { status: res.status, headers, body };
}

const BUCKET = "documents";
const QUEUE = "email-jobs";

const probes: Probe[] = [
  // --- meta -------------------------------------------------------------
  { name: "GET /api/health", path: "/api/health" },
  { name: "GET /api/config", path: "/api/config" },
  { name: "GET /api/unknown → 404", path: "/api/definitely-not-a-route" },
  {
    name: "CORS echo on /api/health",
    path: "/api/health",
    init: () => ({ headers: { Origin: "http://localhost:5173" } }),
  },
  {
    name: "CORS preflight",
    path: "/api/s3/buckets",
    body: "text",
    init: () => ({
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    }),
  },
  { name: "HEAD /api/health", path: "/api/health", body: "none", init: () => ({ method: "HEAD" }) },
  { name: "wrong method on /api/health", path: "/api/health", init: () => ({ method: "DELETE" }) },

  // --- s3 reads ---------------------------------------------------------
  { name: "GET /s3/buckets", path: "/api/s3/buckets", scrub: sortJsonArray },
  { name: "list root", path: `/api/s3/buckets/${BUCKET}/objects` },
  { name: "list prefix", path: `/api/s3/buckets/${BUCKET}/objects?prefix=project/` },
  { name: "list flat (no delimiter)", path: `/api/s3/buckets/${BUCKET}/objects?delimiter=` },
  { name: "list paged max_keys=2", path: `/api/s3/buckets/${BUCKET}/objects?delimiter=&max_keys=2` },
  { name: "list filter_text", path: `/api/s3/buckets/${BUCKET}/objects?filter_text=we` },
  { name: "list bad max_keys → 422", path: `/api/s3/buckets/${BUCKET}/objects?max_keys=abc` },
  { name: "list missing bucket → 404", path: "/api/s3/buckets/no-such-bucket-xyz/objects" },
  {
    name: "batch prefixes",
    path: `/api/s3/buckets/${BUCKET}/objects/batch`,
    init: () => json({ requests: [{ prefix: "" }, { prefix: "project/" }, { prefix: "src/" }] }),
  },
  {
    name: "batch legacy prefixes",
    path: `/api/s3/buckets/${BUCKET}/objects/batch`,
    init: () => json({ prefixes: ["project/", "docs/"] }),
  },
  { name: "get text object", path: `/api/s3/buckets/${BUCKET}/objects/welcome.txt` },
  { name: "get nested object", path: `/api/s3/buckets/${BUCKET}/objects/project%2Fspecs.md` },
  { name: "get binary object", path: "/api/s3/buckets/images/objects/photo.jpg" },
  { name: "get missing object → 404", path: `/api/s3/buckets/${BUCKET}/objects/nope.txt` },
  { name: "download attachment", path: `/api/s3/buckets/${BUCKET}/download/welcome.txt`, body: "text" },
  {
    name: "download inline",
    path: `/api/s3/buckets/${BUCKET}/download/project%2Fspecs.md?inline=true`,
    body: "text",
  },
  { name: "download octet-stream guess", path: "/api/s3/buckets/images/download/icon.svg", body: "none" },
  { name: "download missing → 404", path: `/api/s3/buckets/${BUCKET}/download/nope.txt` },
  { name: "download-prefix zip", path: `/api/s3/buckets/${BUCKET}/download-prefix?prefix=project%2F`, body: "zip" },
  { name: "download-prefix zip (root)", path: "/api/s3/buckets/logs/download-prefix?prefix=", body: "zip" },

  // --- sqs reads --------------------------------------------------------
  { name: "GET /sqs/queues", path: "/api/sqs/queues", scrub: sortJsonArray },
  { name: "receive from empty queue", path: `/api/sqs/queues/${QUEUE}/messages` },
  { name: "unknown queue → 404", path: "/api/sqs/queues/no-such-queue-xyz/messages" },

  // --- static -----------------------------------------------------------
  { name: "GET / (spa index)", path: "/", body: "text" },
  { name: "GET /buckets (spa fallback)", path: "/buckets", body: "text" },
  { name: "GET /vite.svg (static asset)", path: "/vite.svg", body: "text" },
  { name: "traversal ../../etc/passwd", path: "/..%2F..%2Fetc%2Fpasswd", body: "text" },
  { name: "traversal ..%252f", path: "/%2e%2e%2f%2e%2e%2fetc%2fpasswd", body: "text" },

  // --- s3 mutations (per-stack namespace) -------------------------------
  {
    volatileObjects: true,
    name: "PUT upload",
    path: `/api/s3/buckets/${BUCKET}/objects/${NS}%2Fupload.txt`,
    init: (ns) => {
      const form = new FormData();
      form.append("file", new File([`payload for ${ns}`], "upload.txt", { type: "text/plain" }));
      return { method: "PUT", body: form };
    },
  },
  { volatileObjects: true, name: "read back upload", path: `/api/s3/buckets/${BUCKET}/objects/${NS}%2Fupload.txt` },
  {
    volatileObjects: true,
    name: "copy object",
    path: "/api/s3/copy",
    init: (ns) =>
      json({
        source_bucket: BUCKET,
        source_key: `${ns}/upload.txt`,
        destination_bucket: "images",
        destination_key: `${ns}/copied.txt`,
        move: false,
      }),
  },
  { volatileObjects: true, name: "read back copy", path: `/api/s3/buckets/images/objects/${NS}%2Fcopied.txt` },
  {
    volatileObjects: true,
    name: "move object",
    path: "/api/s3/copy",
    init: (ns) =>
      json({
        source_bucket: "images",
        source_key: `${ns}/copied.txt`,
        destination_bucket: "images",
        destination_key: `${ns}/moved.txt`,
        move: true,
      }),
  },
  { volatileObjects: true, name: "source gone after move → 404", path: `/api/s3/buckets/images/objects/${NS}%2Fcopied.txt` },
  {
    volatileObjects: true,
    name: "upload second object",
    path: `/api/s3/buckets/${BUCKET}/objects/${NS}%2Fnested%2Fdeep.txt`,
    init: () => {
      const form = new FormData();
      form.append("file", new File(["deep"], "deep.txt", { type: "text/plain" }));
      return { method: "PUT", body: form };
    },
  },
  {
    volatileObjects: true,
    name: "copy-prefix",
    path: "/api/s3/copy-prefix",
    init: (ns) =>
      json({
        source_bucket: BUCKET,
        source_prefix: `${ns}/`,
        destination_bucket: BUCKET,
        destination_prefix: `${ns}-copy/`,
        move: false,
      }),
  },
  { volatileObjects: true, name: "list copied prefix", path: `/api/s3/buckets/${BUCKET}/objects?delimiter=&prefix=${NS}-copy%2F` },
  { volatileObjects: true, name: "zip copied prefix", path: `/api/s3/buckets/${BUCKET}/download-prefix?prefix=${NS}-copy%2F`, body: "zip" },
  {
    volatileObjects: true,
    name: "DELETE object",
    path: `/api/s3/buckets/${BUCKET}/objects/${NS}%2Fupload.txt`,
    init: () => ({ method: "DELETE" }),
  },
  {
    volatileObjects: true,
    name: "delete-prefix",
    path: `/api/s3/buckets/${BUCKET}/delete-prefix`,
    init: (ns) => json({ prefix: `${ns}-copy/` }),
  },
  {
    volatileObjects: true,
    name: "delete-prefix (already empty)",
    path: `/api/s3/buckets/${BUCKET}/delete-prefix`,
    init: (ns) => json({ prefix: `${ns}-copy/` }),
  },
  { volatileObjects: true, name: "cleanup remaining prefix", path: `/api/s3/buckets/${BUCKET}/delete-prefix`, init: (ns) => json({ prefix: `${ns}/` }) },
  { volatileObjects: true, name: "cleanup images prefix", path: "/api/s3/buckets/images/delete-prefix", init: (ns) => json({ prefix: `${ns}/` }) },

  // --- sqs mutations ----------------------------------------------------
  { volatileObjects: true, name: "purge queue (pre)", path: `/api/sqs/queues/${QUEUE}/purge`, init: () => ({ method: "POST" }) },
  {
    volatileObjects: true,
    name: "send message",
    path: `/api/sqs/queues/${QUEUE}/messages`,
    init: () => json({ Body: "parity probe", DelaySeconds: 0 }),
  },
  { volatileObjects: true, name: "receive message", path: `/api/sqs/queues/${QUEUE}/messages` },
  { volatileObjects: true, name: "purge queue (post)", path: `/api/sqs/queues/${QUEUE}/purge`, init: () => ({ method: "POST" }) },
  { volatileObjects: true, name: "send to unknown queue → 404", path: "/api/sqs/queues/nope-xyz/messages", init: () => json({ Body: "x" }) },
];

/** Order-insensitive comparison for endpoints where the backend order is arbitrary. */
function sortJsonArray(text: string): string {
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return text;
    return JSON.stringify([...parsed].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
  } catch {
    return text;
  }
}

let pass = 0;
const diffs: string[] = [];

for (const probe of probes) {
  // Mutations run sequentially and in-order per stack; the namespace keeps the two
  // stacks from stepping on each other's keys.
  const py = await snapshot(pyBase, probe, "parity-py");
  const ts = await snapshot(tsBase, probe, "parity-ts");

  const problems: string[] = [];
  if (py.status !== ts.status) problems.push(`  status: python=${py.status} hono=${ts.status}`);
  for (const h of HEADERS_OF_INTEREST) {
    if (py.headers[h] !== ts.headers[h]) {
      problems.push(`  header ${h}: python=${JSON.stringify(py.headers[h])} hono=${JSON.stringify(ts.headers[h])}`);
    }
  }
  if (py.body !== ts.body) {
    problems.push(`  body:\n    python: ${truncate(py.body)}\n    hono  : ${truncate(ts.body)}`);
  }

  if (problems.length === 0) {
    pass += 1;
    console.log(`PASS  ${probe.name}`);
  } else {
    console.log(`DIFF  ${probe.name}`);
    diffs.push(`${probe.name}\n${problems.join("\n")}`);
  }
}

function truncate(text: string, max = 400): string {
  return text.length > max ? `${text.slice(0, max)}… (${text.length} chars)` : text;
}

console.log(`\n${pass}/${probes.length} probes identical`);
if (diffs.length) {
  console.log(`\n=== ${diffs.length} difference(s) ===`);
  for (const d of diffs) console.log(`\n${d}`);
  process.exitCode = 1;
}
