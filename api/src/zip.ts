import { Zip, ZipDeflate } from "fflate";

export type ZipEntry = { name: string; data: Uint8Array };

/**
 * Stream a DEFLATE-compressed zip built from `entries`, matching the Python
 * implementation's `zipfile.ZIP_DEFLATED` output. Entries are compressed as they
 * arrive so the response starts flowing before the whole archive exists.
 */
export function zipStream(entries: AsyncIterable<ZipEntry>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const zip = new Zip((err, chunk, final) => {
        if (err) {
          controller.error(err);
          return;
        }
        if (chunk.length) controller.enqueue(chunk);
        if (final) controller.close();
      });

      void (async () => {
        try {
          for await (const { name, data } of entries) {
            const file = new ZipDeflate(name, { level: 6 });
            zip.add(file);
            file.push(data, true);
          }
          zip.end();
        } catch (e) {
          controller.error(e);
        }
      })();
    },
  });
}
