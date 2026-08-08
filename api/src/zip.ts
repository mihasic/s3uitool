import { Zip, type ZipInputFile } from "fflate";

/** Fits Bun's `ReadableStream` and the `node:stream/web` one the SDK returns. */
type ChunkReader = {
  read(): Promise<{ done: boolean; value?: Uint8Array }>;
  cancel(reason?: unknown): Promise<void>;
};

export type ZipEntry = { name: string; data: { getReader(): ChunkReader } };

/** fflate and Bun.hash want a non-shared buffer. */
type Bytes = Uint8Array<ArrayBuffer>;

/**
 * A fflate zip entry backed by Bun's native deflate: fflate writes the container,
 * zlib compresses off-thread so a large download never stalls the event loop.
 */
class NativeDeflate implements ZipInputFile {
  compression = 8;
  size = 0;
  crc = 0;
  ondata!: NonNullable<ZipInputFile["ondata"]>;
  filename: string;

  #stream = new CompressionStream("deflate-raw");
  #writer = this.#stream.writable.getWriter();
  #pump?: Promise<void>;

  constructor(filename: string) {
    this.filename = filename;
  }

  /** Hold one chunk back so the last can be flagged final. */
  #start(): Promise<void> {
    const reader = this.#stream.readable.getReader();
    return (async () => {
      let held: Bytes | undefined;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        if (held) this.ondata(null, held, false);
        held = value as Bytes;
      }
      // size and crc are final: the writer closes only after the last push.
      this.ondata(null, held ?? new Uint8Array(0), true);
    })();
  }

  async push(bytes: Uint8Array): Promise<void> {
    const chunk = bytes as Bytes;
    this.#pump ??= this.#start();
    this.size += chunk.length;
    this.crc = Bun.hash.crc32(chunk, this.crc) >>> 0;
    await this.#writer.write(chunk);
  }

  async end(): Promise<void> {
    this.#pump ??= this.#start();
    await this.#writer.close();
    await this.#pump;
  }
}

/**
 * Stream `entries` as a DEFLATE zip. Driven from `pull`: one source chunk per
 * read, so peak memory tracks the chunk in flight, not the archive.
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
  let current: { file: NativeDeflate; reader: ChunkReader } | null = null;
  let ended = false;

  /** Advance one step. False once everything has been written. */
  async function step(): Promise<boolean> {
    if (ended) return false;

    if (!current) {
      const next = await source.next();
      if (next.done) {
        zip.end();
        ended = true;
        return false;
      }
      const file = new NativeDeflate(next.value.name);
      zip.add(file);
      current = { file, reader: next.value.data.getReader() };
      return true;
    }

    const { value, done } = await current.reader.read();
    if (done) {
      await current.file.end();
      current = null;
    } else if (value) {
      await current.file.push(value);
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
