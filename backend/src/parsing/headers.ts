import type { HeaderObservation } from "../domain/types.js";
import { AppError } from "../errors.js";

const MAX_HEADER_BYTES = 256 * 1024;

export function parseRawHeaders(raw: Buffer): HeaderObservation[] {
  const separator = findHeaderSeparator(raw);
  if (separator < 0) throw new AppError(400, "invalid_eml", "Email headers are not terminated");
  if (separator > MAX_HEADER_BYTES) throw new AppError(413, "headers_too_large", "Email headers exceed the limit");

  const headerSource = raw.subarray(0, separator).toString("latin1");
  const lines = headerSource.split(/\r?\n/);
  const unfolded: Array<{ value: string; offset: number }> = [];
  let lineOffset = 0;
  for (const line of lines) {
    const separatorLength = headerSource.slice(lineOffset + line.length, lineOffset + line.length + 2) === "\r\n" ? 2 : 1;
    if (/^[ \t]/.test(line) && unfolded.length > 0) {
      unfolded[unfolded.length - 1]!.value += `\r\n${line}`;
    } else {
      unfolded.push({ value: line, offset: lineOffset });
    }
    lineOffset += Buffer.byteLength(line, "latin1") + separatorLength;
  }

  return unfolded.flatMap(({ value: line, offset }, index) => {
    const colon = line.indexOf(":");
    if (colon <= 0) return [];
    const rawName = line.slice(0, colon);
    if (!/^[\x21-\x39\x3b-\x7e]+$/.test(rawName)) return [];
    const rawValue = line.slice(colon + 1);
    return [
      {
        evidenceRef: `header:${index}:offset:${offset}`,
        index,
        name: rawName.toLowerCase(),
        rawName,
        rawValue,
        normalizedValue: rawValue.replace(/\r?\n[ \t]+/g, " ").trim(),
      },
    ];
  });
}

export function findHeaderSeparator(raw: Buffer): number {
  const crlf = raw.indexOf("\r\n\r\n");
  const lf = raw.indexOf("\n\n");
  if (crlf < 0) return lf;
  if (lf < 0) return crlf;
  return Math.min(crlf, lf);
}
