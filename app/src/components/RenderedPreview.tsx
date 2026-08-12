import { marked } from "marked";
import { useMemo } from "react";
import type { DualPreviewKind } from "@/lib/file-utils";

interface RenderedPreviewProps {
  kind: DualPreviewKind;
  content: string;
  title: string;
}

const DOCUMENT_HEAD = '<!doctype html><meta charset="utf-8">';

const SVG_STYLES = `<style>
  html,body{margin:0;height:100%}
  body{display:grid;place-items:center;background:#fff}
  svg{max-width:100%;max-height:100%}
</style>`;

const MARKDOWN_STYLES = `<style>
  body{margin:0 auto;padding:1.5rem;max-width:48rem;background:#fff;color:#0f172a;
    font:16px/1.7 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;word-wrap:break-word}
  :first-child{margin-top:0}
  h1,h2,h3,h4,h5,h6{font-weight:600;line-height:1.25;margin:1.5em 0 .6em}
  h1{font-size:1.75em;border-bottom:1px solid #e2e8f0;padding-bottom:.3em}
  h2{font-size:1.4em;border-bottom:1px solid #e2e8f0;padding-bottom:.3em}
  h3{font-size:1.2em}
  h4{font-size:1em}
  h5,h6{font-size:.9em;color:#64748b}
  p,blockquote,ul,ol,pre,table{margin:0 0 1em}
  ul,ol{padding-left:1.6em}
  li{margin:.25em 0}
  li>ul,li>ol{margin-bottom:0}
  a{color:#2563eb}
  blockquote{border-left:4px solid #e2e8f0;color:#64748b;padding:0 1em}
  code{background:#f1f5f9;border-radius:4px;padding:.15em .35em;
    font:.875em/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
  pre{background:#f1f5f9;border-radius:6px;overflow-x:auto;padding:1em}
  pre code{background:none;padding:0;font-size:.85em}
  table{border-collapse:collapse;display:block;overflow-x:auto;width:max-content;max-width:100%}
  th,td{border:1px solid #e2e8f0;padding:.4em .8em}
  th{background:#f1f5f9}
  hr{border:0;border-top:1px solid #e2e8f0;margin:1.5em 0}
  img{max-width:100%}
</style>`;

export function RenderedPreview({ kind, content, title }: RenderedPreviewProps) {
  const srcDoc = useMemo(() => {
    if (kind === "html") return content;
    if (kind === "svg") return `${DOCUMENT_HEAD}${SVG_STYLES}${content}`;
    return `${DOCUMENT_HEAD}${MARKDOWN_STYLES}${marked(content, { async: false, gfm: true })}`;
  }, [kind, content]);

  return (
    <iframe title={`${title} (rendered)`} sandbox="" srcDoc={srcDoc} className="h-full w-full border-0 bg-white" />
  );
}
