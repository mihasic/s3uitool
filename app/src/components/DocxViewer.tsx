import { renderAsync } from "docx-preview";
import { useEffect, useRef, useState } from "react";
import { reportError } from "@/lib/errors";

interface DocxViewerProps {
  url: string;
}

export function DocxViewer({ url }: DocxViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    const loadDocx = async () => {
      try {
        setLoading(true);
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error("Failed to download file");

        const blob = await response.blob();
        if (controller.signal.aborted) return;

        if (containerRef.current) {
          containerRef.current.replaceChildren();
          await renderAsync(blob, containerRef.current, containerRef.current, {
            inWrapper: false, // We handle the wrapper
            ignoreWidth: false,
          });
        }
      } catch (err) {
        if (!controller.signal.aborted) reportError("Failed to render DOCX preview", err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadDocx();

    return () => {
      controller.abort();
    };
  }, [url]);

  return (
    <div className="w-full h-full overflow-auto bg-gray-100 p-4 relative">
      {loading && <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">Loading...</div>}
      <div ref={containerRef} className="bg-white shadow-lg mx-auto min-h-screen" />
    </div>
  );
}
