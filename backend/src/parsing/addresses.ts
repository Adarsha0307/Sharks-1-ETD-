import { domainToASCII } from "node:url";
import type { AddressObservation, HeaderObservation } from "../domain/types.js";

export function parseAddress(header: HeaderObservation | undefined): AddressObservation | null {
  if (!header) return null;
  const value = header.normalizedValue;
  const bracketMatch = /^(?:"([^"]*)"|([^<]*?))?\s*<([^<>\s]+@[^<>\s]+)>\s*$/.exec(value);
  const bareMatch = /([^\s<>,;]+@[^\s<>,;]+)/.exec(value);
  const address = (bracketMatch?.[3] ?? bareMatch?.[1] ?? "").trim().toLowerCase();
  const at = address.lastIndexOf("@");
  const rawDomain = at > 0 ? address.slice(at + 1).replace(/[.]+$/, "") : "";
  let domain: string | null = null;
  try {
    domain = rawDomain ? domainToASCII(rawDomain).toLowerCase() || rawDomain.toLowerCase() : null;
  } catch {
    domain = rawDomain || null;
  }
  const displayName = (bracketMatch?.[1] ?? bracketMatch?.[2] ?? "").trim().replace(/^"|"$/g, "") || null;
  return {
    address: address || null,
    displayName,
    domain,
    evidenceRef: header.evidenceRef,
  };
}

export function parseAddressList(header: HeaderObservation | undefined): AddressObservation[] {
  if (!header) return [];
  return splitAddresses(header.normalizedValue)
    .map((value, index) =>
      parseAddress({ ...header, evidenceRef: `${header.evidenceRef}:address:${index}`, normalizedValue: value }),
    )
    .filter((value): value is AddressObservation => value !== null);
}

function splitAddresses(value: string): string[] {
  const results: string[] = [];
  let quoted = false;
  let angleDepth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '"' && value[index - 1] !== "\\") quoted = !quoted;
    if (!quoted && character === "<") angleDepth += 1;
    if (!quoted && character === ">") angleDepth = Math.max(0, angleDepth - 1);
    if (!quoted && angleDepth === 0 && character === ",") {
      results.push(value.slice(start, index));
      start = index + 1;
    }
  }
  results.push(value.slice(start));
  return results;
}
