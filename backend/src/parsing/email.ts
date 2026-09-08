import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { MailParser } from "mailparser";
import { DomUtils, parseDocument } from "htmlparser2";
import type { Config } from "../config.js";
import type { AttachmentObservation, ParsedEmail } from "../domain/types.js";
import { AppError } from "../errors.js";
import { parseAddress, parseAddressList } from "./addresses.js";
import { parseRawHeaders } from "./headers.js";
import { extractLinks } from "./links.js";

interface MailTextPart {
  type: "text";
  text?: string;
  html?: string | false;
}

interface MailAttachmentPart {
  type: "attachment";
  filename?: string;
  contentType?: string;
  content: NodeJS.ReadableStream & { destroy(error?: Error): void };
  release(): void;
}

export async function parseEmailFile(path: string, config: Config): Promise<ParsedEmail> {
  const raw = await readBounded(path, config.uploadMaxBytes);
  const headers = parseRawHeaders(raw);
  if (!headers.some((header) => ["from", "date", "message-id", "mime-version"].includes(header.name))) {
    throw new AppError(400, "invalid_eml", "Input does not contain recognizable email headers");
  }

  const parser = new MailParser({
    skipHtmlToText: true,
    skipTextToHtml: true,
    skipImageLinks: true,
    maxHtmlLengthToParse: config.decodedMaxBytes,
  });
  let textBody = "";
  let html = "";
  let decodedBytes = 0;
  const attachments: AttachmentObservation[] = [];
  let seenAttachmentCount = 0;
  const parserWarnings: string[] = [];

  const completed = new Promise<void>((resolve, reject) => {
    parser.on("data", (part: MailTextPart | MailAttachmentPart) => {
      if (part.type === "text") {
        const text = part.text ?? "";
        const htmlPart = typeof part.html === "string" ? part.html : "";
        textBody += text;
        html += htmlPart;
        decodedBytes += Buffer.byteLength(text, "utf8") + Buffer.byteLength(htmlPart, "utf8");
        if (decodedBytes > config.decodedMaxBytes) parser.destroy(new Error("decoded_limit_exceeded"));
        return;
      }

      seenAttachmentCount += 1;
      if (seenAttachmentCount > config.maxAttachments) {
        part.release();
        parser.destroy(new Error("attachment_limit_exceeded"));
        return;
      }
      const index = seenAttachmentCount - 1;
      const hash = createHash("sha256");
      const signatureChunks: Buffer[] = [];
      let signatureBytes = 0;
      let size = 0;
      part.content.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.byteLength;
        decodedBytes += buffer.byteLength;
        hash.update(buffer);
        if (signatureBytes < 16) {
          const slice = buffer.subarray(0, 16 - signatureBytes);
          signatureChunks.push(slice);
          signatureBytes += slice.byteLength;
        }
        if (decodedBytes > config.decodedMaxBytes) {
          part.content.destroy(new Error("decoded_limit_exceeded"));
          parser.destroy(new Error("decoded_limit_exceeded"));
        }
      });
      part.content.once("error", (error) => parser.destroy(error as Error));
      part.content.once("end", () => {
        const signature = Buffer.concat(signatureChunks).subarray(0, 16);
        attachments.push({
          evidenceRef: `attachment:${index}`,
          index,
          filename: part.filename ?? null,
          declaredContentType: part.contentType ?? "application/octet-stream",
          detectedContentType: detectContentType(signature),
          size,
          sha256: hash.digest("hex"),
        });
        part.release();
      });
    });
    parser.once("error", reject);
    parser.once("end", resolve);
  });
  createReadStream(path).once("error", (error) => parser.destroy(error)).pipe(parser);

  try {
    await completed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "parser_error";
    if (message.includes("limit_exceeded")) throw new AppError(413, message, "Decoded email content exceeds a processing limit");
    throw new AppError(400, "parse_failed", "The email could not be parsed safely");
  }

  const mimeDepth = estimateMimeDepth(raw);
  if (mimeDepth > config.maxMimeDepth) throw new AppError(413, "mime_depth_exceeded", "MIME nesting exceeds the processing limit");
  let links;
  try {
    links = extractLinks(textBody, html, config.maxUrls);
  } catch (error) {
    if (error instanceof Error && error.message === "url_limit_exceeded") {
      throw new AppError(413, "url_limit_exceeded", "Extracted URL count exceeds the processing limit");
    }
    throw error;
  }
  const htmlText = html ? DomUtils.textContent(parseDocument(html)).replace(/\s+/g, " ").trim() : "";
  const first = (name: string) => headers.find((header) => header.name === name);
  const all = (name: string) => headers.filter((header) => header.name === name);
  if (!first("from")) parserWarnings.push("From header is missing");
  if (!first("date")) parserWarnings.push("Date header is missing");

  return {
    headers,
    subject: first("subject")?.normalizedValue ?? null,
    from: parseAddress(first("from")),
    replyTo: parseAddress(first("reply-to")),
    returnPath: parseAddress(first("return-path")),
    recipients: ["to", "cc", "bcc"].flatMap((name) => all(name).flatMap(parseAddressList)),
    messageId: first("message-id")?.normalizedValue ?? null,
    date: first("date")?.normalizedValue ?? null,
    received: all("received"),
    authenticationResults: all("authentication-results"),
    dkimSignatures: all("dkim-signature"),
    textBody,
    htmlText,
    bodyTruncated: false,
    links,
    attachments,
    parserWarnings,
    checkStatuses: [
      { check: "headers", status: "completed", limitation: null },
      { check: "bodies", status: "completed", limitation: null },
      { check: "urls", status: "completed", limitation: "Destinations were extracted but never fetched." },
      { check: "attachments", status: "completed", limitation: "Metadata and leading signatures only; no execution or archive expansion." },
    ],
    decodedBytes,
    mimeDepth,
  };
}

async function readBounded(path: string, maximumBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of createReadStream(path, { highWaterMark: 64 * 1024 })) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > maximumBytes) throw new AppError(413, "email_too_large", "Email exceeds upload limit");
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, total);
}

function detectContentType(signature: Buffer): string | null {
  const ascii = signature.toString("ascii");
  if (signature.subarray(0, 2).equals(Buffer.from("MZ"))) return "application/x-dosexec";
  if (signature.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) return "application/x-elf";
  if (ascii.startsWith("%PDF-")) return "application/pdf";
  if (signature.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) return "application/zip";
  if (signature.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (signature.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  return null;
}

function estimateMimeDepth(raw: Buffer): number {
  const source = raw.toString("latin1");
  const boundaries = [...source.matchAll(/boundary\s*=\s*(?:"([^"]+)"|([^\s;]+))/giu)].map((match) => match[1] ?? match[2] ?? "");
  if (boundaries.length === 0) return 1;
  const events = boundaries.flatMap((boundary) => {
    const escaped = boundary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return [...source.matchAll(new RegExp(`^--${escaped}(--)?\\s*$`, "gmu"))].map((match) => ({ index: match.index, close: Boolean(match[1]) }));
  }).sort((left, right) => left.index - right.index);
  let depth = 1;
  let maximum = 1;
  for (const event of events) {
    depth += event.close ? -1 : 1;
    maximum = Math.max(maximum, depth);
  }
  return maximum;
}
