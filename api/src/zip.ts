import { Zip, ZipDeflate } from "fflate";

/**
 * The structural minimum this module needs, so both Bun's global `ReadableStream`
 * and the `node:stream/web` one the AWS SDK returns satisfy it.
 */
type ChunkReader = {
  read(): Promise<{ done: boolean; value?: Uint8Array }>;
  cancel(reason?: unknown): Promise<void>;
};

export type ZipEntry = { name: string; data: { getReader(): ChunkReader } };

/**
 * Stream a DEFLATE-compressed zip built from `entries`, matching the Python
 * implementation's `zipfile.ZIP_DEFLATED` output.
 *
 * Everything is driven from `pull`, so the producer only advances when the client
 * reads: one source chunk is fetched and compressed per read, and nothing is
 * buffered beyond the chunk in flight. Feeding fflate from `start` instead — or
 * handing it whole objects — makes peak memory scale with the size of the
 * archive rather than the size of a chunk.
 */
export function zipStream(entries: AsyncIterable<ZipEntry>): ReadableStream<Uint8Array> {
  const pending: Uint8Array[] = [];
  let finished = false;
  let failure: unknown;

  const zip = new Zip((err, chunk, final) => {
    if (err) {
      failure ??= err;
      return;
    }
    if (chunk.length) pending.push(chunk);
    if (final) finished = true;
  });

  const source = entries[Symbol.asyncIterator]();
  let current: { file: ZipDeflate; reader: ChunkReader } | null = null;
  let ended = false;

  /** Advance the producer by one step. Returns false once everything has been written. */
  async function step(): Promise<boolean> {
    if (ended) return false;

    if (!current) {
      const next = await source.next();
      if (next.done) {
        zip.end();
        ended = true;
        return false;
      }
      const file = new ZipDeflate(next.value.name, { level: 6 });
      zip.add(file);
      current = { file, reader: next.value.data.getReader() };
      return true;
    }

    const { value, done } = await current.reader.read();
    if (done) {
      current.file.push(new Uint8Array(0), true);
      current = null;
    } else if (value) {
      current.file.push(value, false);
    }
    return true;
  }

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (pending.length === 0 && !finished && !failure) {
        if (!(await step())) break;
      }

      if (failure) {
        controller.error(failure);
        return;
      }

      const chunk = pending.shift();
      if (chunk) controller.enqueue(chunk);
      else if (finished || ended) controller.close();
    },

    async cancel(reason) {
      ended = true;
      await current?.reader.cancel(reason);
      await source.return?.(undefined);
    },
  });
}
