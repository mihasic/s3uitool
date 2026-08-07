/**
 * Pydantic v2 renders UTC datetimes with microsecond precision and drops the
 * fractional part entirely when it is zero: `2026-08-08T12:00:00Z` /
 * `...:00.123000Z`. `Date#toISOString` always emits exactly three digits, so
 * reshape it to keep responses byte-identical with the FastAPI implementation.
 */
export function isoUtc(value: Date | undefined): string | null {
  if (!value) return null;
  return value.toISOString().replace(/\.(\d{3})Z$/, (_, ms) => (ms === "000" ? "Z" : `.${ms}000Z`));
}

/** Build a Content-Disposition header value safely (RFC 5987).
 *
 * Emits an ASCII fallback plus a UTF-8 `filename*` so quotes and non-ASCII
 * characters in keys don't break the header.
 */
export function contentDisposition(disposition: string, filename: string): string {
  // Python's `str.encode("ascii", "replace")` substitutes one `?` per non-ASCII code point.
  const asciiFallback = Array.from(filename, (ch) => ((ch.codePointAt(0) ?? 0) > 0x7f ? "?" : ch))
    .join("")
    .replaceAll('"', "'");
  // `urllib.parse.quote(..., safe="")` also escapes these, unlike encodeURIComponent.
  const encoded = encodeURIComponent(filename).replace(
    /[!'()*]/g,
    (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`;
}
