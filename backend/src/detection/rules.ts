import { domainToUnicode } from "node:url";
import { getDomain } from "tldts";
import type { Config } from "../config.js";
import { stableUuid } from "../domain/ids.js";
import type { EvidenceReference, Finding, FindingCategory, FindingSeverity, ParsedEmail } from "../domain/types.js";

export const RULES_VERSION = "2026.09.1";

const credentialTerms = /\b(password|passcode|credential|sign[ -]?in|log[ -]?in|verify (?:your )?account|one[- ]time password|otp)\b/iu;
const paymentTerms = /\b(bank account|payment account|wire transfer|invoice payment|beneficiary|routing number|change (?:the )?account)\b/iu;
const financialTerms = /\b(payment|invoice|wire|transfer|bank|gift card|crypto|funds)\b/iu;
const urgencyTerms = /\b(urgent|immediately|right away|within (?:an )?hour|today only|final notice|act now)\b/iu;
const secrecyTerms = /\b(confidential|do not tell|keep this secret|between us|do not call|privately)\b/iu;
const executableExtensions = new Set(["exe", "com", "scr", "msi", "bat", "cmd", "ps1", "vbs", "js", "jse", "wsf", "hta", "sh"]);
const documentExtensions = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "jpg", "jpeg", "png"]);

interface RuleContext {
  parsed: ParsedEmail;
  config: Config;
}

export function runDeterministicRules(parsed: ParsedEmail, config: Config): Finding[] {
  const context = { parsed, config };
  return [
    ...senderRules(context),
    ...urlRules(context),
    ...contentRules(context),
    ...attachmentRules(context),
  ].sort((left, right) => left.ruleId.localeCompare(right.ruleId));
}

function senderRules({ parsed, config }: RuleContext): Finding[] {
  const findings: Finding[] = [];
  const from = parsed.from;
  if (!from?.domain) return findings;
  const fromRegistrable = getDomain(from.domain, { allowPrivateDomains: true }) ?? from.domain;
  const replyDomain = parsed.replyTo?.domain;
  if (replyDomain) {
    const replyRegistrable = getDomain(replyDomain, { allowPrivateDomains: true }) ?? replyDomain;
    if (replyRegistrable !== fromRegistrable) {
      findings.push(
        finding(
          "ETD-SENDER-001",
          "sender",
          "low",
          [reference(from.evidenceRef, `From domain ${fromRegistrable}`), reference(parsed.replyTo!.evidenceRef, `Reply-To domain ${replyRegistrable}`)],
          "The Reply-To destination uses a different registrable domain than the visible sender.",
          ["Mailing lists, ticketing systems, and delegated senders can use a legitimate different Reply-To address."],
          "Confirm the reply destination through a known channel before responding.",
          6,
        ),
      );
    }
  }

  const claimedProtected = config.protectedOrganizations.find((name) =>
    from.displayName?.toLocaleLowerCase("en-US").includes(name.toLocaleLowerCase("en-US")),
  );
  const isProtectedDomain = config.protectedDomains.some((domain) => sameOrSubdomain(from.domain!, domain));
  const authorizedClaims = config.authorizedSenders.get(fromRegistrable) ?? [];
  const exceptionApplies = authorizedClaims.some((domain) => config.protectedDomains.includes(domain));
  if (claimedProtected && !isProtectedDomain && !exceptionApplies) {
    findings.push(
      finding(
        "ETD-SENDER-002",
        "sender",
        "medium",
        [reference(from.evidenceRef, `Display name claims ${claimedProtected}; sender domain is ${fromRegistrable}`)],
        "The display name claims a protected organization while the sender domain is neither protected nor an approved sender.",
        ["A display name is user-controlled. A legitimate new vendor may require configuration before it is recognized."],
        "Verify the sender using an independently obtained organization contact.",
        16,
      ),
    );
  }

  for (const protectedDomain of config.protectedDomains) {
    const protectedRegistrable = getDomain(protectedDomain, { allowPrivateDomains: true }) ?? protectedDomain;
    if (fromRegistrable !== protectedRegistrable && looksLike(fromRegistrable, protectedRegistrable)) {
      findings.push(
        finding(
          "ETD-SENDER-003",
          "sender",
          "medium",
          [reference(from.evidenceRef, `Sender domain ${fromRegistrable} resembles ${protectedRegistrable}`)],
          "The sender registrable domain is visually or typographically close to a protected domain.",
          ["Edit-distance checks are an indicator, not proof of control or intent."],
          "Do not use message links; navigate to the known organization domain separately.",
          18,
        ),
      );
      break;
    }
  }

  if (from.domain.includes("xn--") || /[^\x00-\x7f]/u.test(domainToUnicode(from.domain))) {
    findings.push(
      finding(
        "ETD-SENDER-004",
        "sender",
        "low",
        [reference(from.evidenceRef, `Sender domain uses internationalized form: ${from.domain}`)],
        "The sender domain uses punycode or non-ASCII characters that warrant visual review.",
        ["Internationalized domains are valid and commonly legitimate."],
        "Compare the decoded domain carefully with the expected organization domain.",
        5,
      ),
    );
  }

  const returnDomain = parsed.returnPath?.domain;
  if (returnDomain && (getDomain(returnDomain, { allowPrivateDomains: true }) ?? returnDomain) !== fromRegistrable) {
    findings.push(
      finding(
        "ETD-SENDER-005",
        "sender",
        "info",
        [reference(from.evidenceRef, `From domain ${fromRegistrable}`), reference(parsed.returnPath!.evidenceRef, `Return-Path domain ${returnDomain}`)],
        "The envelope return domain reported in the message differs from the visible sender domain.",
        ["Delegated delivery and bounce handling commonly produce this difference; uploaded headers are not trusted SMTP context."],
        "Use this only as supporting evidence alongside verified authentication or content findings.",
        2,
      ),
    );
  }
  return findings;
}

function urlRules({ parsed, config }: RuleContext): Finding[] {
  const findings: Finding[] = [];
  for (const link of parsed.links) {
    if (!link.hostname) continue;
    if (link.displayedText && /^https?:\/\//iu.test(link.displayedText.trim())) {
      const displayed = safeHostname(link.displayedText.trim());
      const displayedDomain = displayed ? getDomain(displayed, { allowPrivateDomains: true }) ?? displayed : null;
      if (displayedDomain && displayedDomain !== link.registrableDomain) {
        findings.push(
          finding(
            `ETD-URL-001:${link.evidenceRef}`,
            "url",
            "medium",
            [reference(link.evidenceRef, `Displayed domain ${displayedDomain}; destination domain ${link.registrableDomain ?? link.hostname}`)],
            "The URL shown to the reader differs from the actual link destination.",
            ["Some legitimate marketing and security gateways rewrite links; the destination was not fetched."],
            "Navigate independently rather than selecting the message link.",
            14,
          ),
        );
      }
    }
    if (link.isIpHost) {
      findings.push(
        finding(
          `ETD-URL-002:${link.evidenceRef}`,
          "url",
          "medium",
          [reference(link.evidenceRef, `Destination uses IP host ${link.hostname}`)],
          "The link uses a numeric IP address instead of a domain name.",
          ["Private appliances and test systems can legitimately use IP URLs; no destination request was made."],
          "Do not open the link until its purpose and owner are verified.",
          11,
        ),
      );
    }
    if (link.hasUserInfo) {
      findings.push(
        finding(
          `ETD-URL-003:${link.evidenceRef}`,
          "url",
          "medium",
          [reference(link.evidenceRef, "Destination includes user-info before the host")],
          "The link uses URL user-info syntax, which can disguise the actual hostname after an @ character.",
          ["User-info is legal URL syntax but is rarely needed in email links; no destination request was made."],
          "Read the hostname after the @ character and avoid opening the link.",
          12,
        ),
      );
    }
    if (link.hostname.includes("xn--") || /%[0-9a-f]{2}/iu.test(link.original)) {
      findings.push(
        finding(
          `ETD-URL-004:${link.evidenceRef}`,
          "url",
          "low",
          [reference(link.evidenceRef, `Encoded or internationalized destination ${link.hostname}`)],
          "The destination contains punycode or percent encoding that can make visual inspection harder.",
          ["Encoding and internationalized domains are valid; this signal alone is weak."],
          "Review the normalized hostname before deciding whether to navigate.",
          5,
        ),
      );
    }
    for (const protectedDomain of config.protectedDomains) {
      const destination = link.registrableDomain ?? link.hostname;
      const expected = getDomain(protectedDomain, { allowPrivateDomains: true }) ?? protectedDomain;
      if (destination !== expected && looksLike(destination, expected)) {
        findings.push(
          finding(
            `ETD-URL-005:${link.evidenceRef}`,
            "url",
            "medium",
            [reference(link.evidenceRef, `Destination ${destination} resembles protected domain ${expected}`)],
            "The destination domain closely resembles a protected organization domain.",
            ["Similarity is heuristic and the destination was not contacted."],
            "Use a saved bookmark or independently type the protected domain.",
            17,
          ),
        );
        break;
      }
    }
  }
  return findings;
}

function contentRules({ parsed, config }: RuleContext): Finding[] {
  const findings: Finding[] = [];
  const content = `${parsed.subject ?? ""}\n${parsed.textBody}\n${parsed.htmlText}`;
  const deceptiveLink = parsed.links.find((link) => {
    if (link.hasUserInfo || link.isIpHost || link.hostname?.includes("xn--")) return true;
    if (link.displayedText && /^https?:\/\//iu.test(link.displayedText.trim())) {
      return safeHostname(link.displayedText.trim()) !== link.hostname;
    }
    return config.protectedDomains.some((domain) => {
      if (!link.registrableDomain) return false;
      const expected = getDomain(domain, { allowPrivateDomains: true }) ?? domain;
      return link.registrableDomain !== expected && looksLike(link.registrableDomain, expected);
    });
  });
  if (credentialTerms.test(content) && deceptiveLink) {
    findings.push(
      finding(
        "ETD-CONTENT-001",
        "content",
        "high",
        [reference("body:text", "Message asks for credentials or sign-in"), reference(deceptiveLink.evidenceRef, "A deceptive-link indicator is present")],
        "A credential or account-verification request is combined with a deceptive link indicator.",
        ["Keyword and URL heuristics do not determine the sender's intent."],
        "Do not submit credentials. Reach the service through a known address and report the message for review.",
        28,
      ),
    );
  }

  const identityInconsistency = senderRules({ parsed, config }).find((item) => item.severity === "medium");
  if (paymentTerms.test(content) && identityInconsistency) {
    findings.push(
      finding(
        "ETD-CONTENT-002",
        "content",
        "high",
        [reference("body:text", "Message requests payment-account action"), ...identityInconsistency.evidenceRefs],
        "A payment-account change request is combined with sender-identity inconsistency.",
        ["Financial terminology may occur in legitimate workflows; independent verification is required."],
        "Pause the transaction and confirm instructions using a known telephone number or established workflow.",
        30,
      ),
    );
  }

  if (urgencyTerms.test(content) && secrecyTerms.test(content) && financialTerms.test(content)) {
    findings.push(
      finding(
        "ETD-CONTENT-003",
        "content",
        "high",
        [reference("body:text", "Urgency, secrecy, and financial instructions occur together")],
        "The message combines urgency, secrecy, and a financial request, a social-engineering pattern.",
        ["The terms are contextual heuristics; urgency alone is deliberately not a finding."],
        "Stop and verify the request with an authorized person through a separate channel.",
        26,
      ),
    );
  }
  return findings;
}

function attachmentRules({ parsed }: RuleContext): Finding[] {
  const findings: Finding[] = [];
  for (const attachment of parsed.attachments) {
    const filename = attachment.filename?.toLocaleLowerCase("en-US") ?? "";
    const parts = filename.split(".").filter(Boolean);
    const extension = parts.at(-1) ?? "";
    const previousExtension = parts.at(-2) ?? "";
    if (parts.length >= 3 && executableExtensions.has(extension) && documentExtensions.has(previousExtension)) {
      findings.push(
        finding(
          `ETD-ATTACHMENT-001:${attachment.evidenceRef}`,
          "attachment",
          "high",
          [reference(attachment.evidenceRef, `Attachment filename ${attachment.filename}`)],
          "The attachment uses a document-like extension followed by an executable or script extension.",
          ["Only the filename and inert metadata were inspected; the attachment was not executed or unpacked."],
          "Do not open the attachment; preserve the email and escalate it for controlled review.",
          24,
        ),
      );
    } else if (executableExtensions.has(extension) || attachment.detectedContentType === "application/x-dosexec" || attachment.detectedContentType === "application/x-elf") {
      findings.push(
        finding(
          `ETD-ATTACHMENT-002:${attachment.evidenceRef}`,
          "attachment",
          "high",
          [reference(attachment.evidenceRef, `Executable or script indicator for ${attachment.filename ?? "unnamed attachment"}`)],
          "The attachment extension or safely inspected leading signature indicates executable or script content.",
          ["This is metadata inspection, not malware scanning; the attachment was not executed."],
          "Do not run the attachment. Escalate it under the organization's file-handling process.",
          22,
        ),
      );
    }
    if (
      attachment.detectedContentType &&
      !contentTypesCompatible(attachment.declaredContentType, attachment.detectedContentType)
    ) {
      findings.push(
        finding(
          `ETD-ATTACHMENT-003:${attachment.evidenceRef}`,
          "attachment",
          "medium",
          [reference(attachment.evidenceRef, `Declared ${attachment.declaredContentType}; signature indicates ${attachment.detectedContentType}`)],
          "The declared attachment content type does not match its safely detected leading signature.",
          ["Signature coverage is intentionally small and does not inspect complete file structure."],
          "Treat the attachment as its detected type and obtain specialist review before opening it.",
          14,
        ),
      );
    }
  }
  return findings;
}

function finding(
  ruleKey: string,
  category: FindingCategory,
  severity: FindingSeverity,
  evidenceRefs: EvidenceReference[],
  explanation: string,
  limitations: string[],
  recommendedAction: string,
  scoreContribution: number,
): Finding {
  return {
    findingId: stableUuid(`${RULES_VERSION}:${ruleKey}`),
    ruleId: ruleKey,
    ruleVersion: RULES_VERSION,
    category,
    severity,
    evidenceRefs,
    explanation,
    limitations,
    recommendedAction,
    scoreContribution,
  };
}

function reference(ref: string, summary: string): EvidenceReference {
  return { ref, summary };
}

function safeHostname(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function sameOrSubdomain(candidate: string, expected: string): boolean {
  return candidate === expected || candidate.endsWith(`.${expected}`);
}

function looksLike(candidate: string, expected: string): boolean {
  const left = candidate.toLocaleLowerCase("en-US").replace(/[-.]/g, "");
  const right = expected.toLocaleLowerCase("en-US").replace(/[-.]/g, "");
  if (left === right) return true;
  return levenshtein(left, right) <= (right.length >= 10 ? 2 : 1);
}

function levenshtein(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      current[column] = Math.min(
        current[column - 1]! + 1,
        previous[column]! + 1,
        previous[column - 1]! + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length]!;
}

function contentTypesCompatible(declared: string, detected: string): boolean {
  if (declared === detected || declared === "application/octet-stream") return true;
  if (detected === "application/zip" && /officedocument|opendocument/iu.test(declared)) return true;
  return false;
}
