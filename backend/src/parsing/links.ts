import { isIP } from "node:net";
import { domainToASCII } from "node:url";
import { DomUtils, parseDocument } from "htmlparser2";
import { getDomain } from "tldts";
import type { LinkObservation } from "../domain/types.js";

const URL_PATTERN = /https?:\/\/[^\s<>"']+/giu;

export function extractLinks(text: string, html: string, maximum: number): LinkObservation[] {
  const candidates: Array<{ original: string; displayedText: string | null; source: "plain" | "html" }> = [];
  for (const match of text.matchAll(URL_PATTERN)) {
    candidates.push({ original: trimUrl(match[0]), displayedText: null, source: "plain" });
  }
  if (html) {
    const document = parseDocument(html, { decodeEntities: true });
    for (const element of DomUtils.findAll((node) => node.type === "tag" && node.name === "a", document.children)) {
      const href = element.attribs?.href;
      if (href && /^https?:\/\//iu.test(href.trim())) {
        candidates.push({ original: href.trim(), displayedText: DomUtils.textContent(element).trim() || null, source: "html" });
      }
    }
  }

  const unique = new Map<string, LinkObservation>();
  for (const candidate of candidates) {
    const key = `${candidate.source}\u0000${candidate.original}\u0000${candidate.displayedText ?? ""}`;
    if (unique.has(key)) continue;
    const index = unique.size;
    unique.set(key, parseLink(candidate, index));
    if (unique.size > maximum) throw new Error("url_limit_exceeded");
  }
  return [...unique.values()];
}

function parseLink(
  candidate: { original: string; displayedText: string | null; source: "plain" | "html" },
  index: number,
): LinkObservation {
  try {
    const url = new URL(candidate.original);
    const hostname = domainToASCII(url.hostname.replace(/^\[|\]$/g, "")).toLowerCase();
    url.hostname = hostname;
    return {
      evidenceRef: `url:${index}`,
      source: candidate.source,
      original: candidate.original,
      normalized: url.toString(),
      displayedText: candidate.displayedText,
      hostname,
      registrableDomain: getDomain(hostname, { allowPrivateDomains: true }),
      hasUserInfo: Boolean(url.username || url.password),
      isIpHost: isIP(hostname) !== 0,
      parseError: null,
    };
  } catch {
    return {
      evidenceRef: `url:${index}`,
      source: candidate.source,
      original: candidate.original,
      normalized: null,
      displayedText: candidate.displayedText,
      hostname: null,
      registrableDomain: null,
      hasUserInfo: false,
      isIpHost: false,
      parseError: "URL could not be parsed safely",
    };
  }
}

function trimUrl(value: string): string {
  let trimmed = value.replace(/[.;!?]+$/u, "");
  while (trimmed.endsWith(")") && count(trimmed, "(") < count(trimmed, ")")) trimmed = trimmed.slice(0, -1);
  while (trimmed.endsWith("]") && count(trimmed, "[") < count(trimmed, "]")) trimmed = trimmed.slice(0, -1);
  return trimmed;
}

function count(value: string, token: string): number {
  return [...value].filter((character) => character === token).length;
}
