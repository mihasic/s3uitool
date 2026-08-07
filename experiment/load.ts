/**
 * Tiny closed-loop load generator: fixed concurrency, fixed request count,
 * reports throughput and latency percentiles.
 *
 *   bun experiment/load.ts <url> [requests] [concurrency]
 */
const [url, countArg, concurrencyArg] = process.argv.slice(2);
if (!url) {
  console.error("usage: bun experiment/load.ts <url> [requests] [concurrency]");
  process.exit(2);
}

const total = Number(countArg ?? 2000);
const concurrency = Number(concurrencyArg ?? 32);

// Warm up connection pools and JIT/interpreter caches before measuring.
for (let i = 0; i < Math.min(200, total); i++) await (await fetch(url)).arrayBuffer();

const latencies = new Float64Array(total);
let cursor = 0;
let failures = 0;

const started = performance.now();
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= total) return;
      const t0 = performance.now();
      try {
        const res = await fetch(url);
        await res.arrayBuffer();
        if (!res.ok) failures++;
      } catch {
        failures++;
      }
      latencies[index] = performance.now() - t0;
    }
  }),
);
const elapsed = (performance.now() - started) / 1000;

const sorted = Float64Array.from(latencies).sort();
const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;

console.log(
  JSON.stringify({
    url,
    requests: total,
    concurrency,
    failures,
    seconds: Number(elapsed.toFixed(3)),
    rps: Math.round(total / elapsed),
    p50_ms: Number(at(50).toFixed(2)),
    p95_ms: Number(at(95).toFixed(2)),
    p99_ms: Number(at(99).toFixed(2)),
  }),
);
