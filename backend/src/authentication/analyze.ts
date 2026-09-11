import { readFile } from "node:fs/promises";
import type { Config } from "../config.js";
import { getDomain } from "tldts";
import type { AuthenticationAnalysis, AuthenticationCheck, ParsedEmail, SmtpContext } from "../domain/types.js";

type Resolver = (name: string, type: string) => Promise<unknown>;

interface MailauthResult {
  results?: Array<{
    signingDomain?: string;
    status?: { result?: string; comment?: string };
  }>;
}

export async function analyzeAuthentication(
  originalPath: string,
  parsed: ParsedEmail,
  config: Config,
  resolver?: Resolver,
  smtpContext?: SmtpContext,
): Promise<AuthenticationAnalysis> {
  const checks: AuthenticationCheck[] = [];
  for (const header of parsed.authenticationResults) {
    checks.push({
      mechanism: "reported",
      state: "untrusted_reported_result",
      explanation: "An uploaded Authentication-Results header is a historical claim and has no trusted receiver provenance.",
      evidenceRefs: [header.evidenceRef],
      simulated: false,
      limitation: "The detector does not treat a familiar authserv-id or a reported pass as independent verification.",
    });
  }
  if (parsed.authenticationResults.length === 0) {
    checks.push({
      mechanism: "reported",
      state: "missing",
      explanation: "No Authentication-Results header was present.",
      evidenceRefs: [],
      simulated: false,
      limitation: null,
    });
  }

  const fixtureResolver = resolver ?? (await loadFixtureResolver(config.dnsFixturePath));
  const fixtureSource = resolver || fixtureResolver ? "injected_local_dns" : null;
  if (parsed.dkimSignatures.length === 0) {
    checks.push(check("dkim", "missing", "No DKIM-Signature header was present.", [], false, null));
  } else if (!fixtureResolver) {
    checks.push(
      check(
        "dkim",
        "unverifiable",
        "A DKIM signature is present, but no approved offline DNS evidence is available.",
        parsed.dkimSignatures.map((header) => header.evidenceRef),
        false,
        "The isolated test VM does not query public DNS.",
      ),
    );
  } else {
    const dkimChecks = await verifyDkim(originalPath, parsed, fixtureResolver, Boolean(fixtureSource));
    for (const dkimCheck of dkimChecks) {
      if (dkimCheck.state === "pass" && !dkimCheck.domain) {
        dkimCheck.state = "unverifiable";
        dkimCheck.explanation = "DKIM cryptographic verification passed but did not return a signing domain required for identity alignment.";
        dkimCheck.limitation = "No authentication pass is asserted without the signing identity.";
      }
      checks.push(dkimCheck);
    }
  }

  const spfCheck = smtpContext && fixtureResolver
    ? await verifySpf(smtpContext, fixtureResolver)
    : check(
        "spf",
        "unverifiable",
        "SPF was not evaluated because an uploaded email has no reliable connecting IP, HELO, and envelope identity context.",
        parsed.returnPath ? [parsed.returnPath.evidenceRef] : [],
        false,
        "Visible or uploaded headers do not establish trusted SMTP-session context.",
      );
  checks.push(spfCheck);

  const fromDomain = parsed.from?.domain ?? null;
  const dkimPasses = checks.filter((item) => item.mechanism === "dkim" && item.state === "pass");
  const alignedDkim = Boolean(fromDomain && dkimPasses.some((item) => item.domain && aligned(item.domain, fromDomain)));
  const smtpDomain = smtpContext?.envelopeFrom.split("@").at(-1)?.toLowerCase() ?? null;
  const alignedSpf = Boolean(fromDomain && smtpDomain && spfCheck.state === "pass" && aligned(smtpDomain, fromDomain));
  const dmarcAlignmentSupported = Boolean(fixtureResolver && fromDomain && (alignedDkim || alignedSpf));
  const dmarcEvidence = [
    ...(alignedDkim ? ["an independently verified DKIM signature aligned with the From domain"] : []),
    ...(alignedSpf ? ["an independently verified SPF result aligned with the From domain"] : []),
  ];
  checks.push(
    check(
      "dmarc",
      "unverifiable",
      dmarcAlignmentSupported
        ? `DMARC was not evaluated as pass or fail. Alignment evidence is available because ${dmarcEvidence.join(" and ")} was verified under the injected local DNS/SMTP fixture.`
        : "DMARC alignment was not evaluated because no independently verified aligned SPF or DKIM result is available.",
      parsed.from ? [parsed.from.evidenceRef] : [],
      dmarcAlignmentSupported,
      dmarcAlignmentSupported
        ? "This is fixture-scoped alignment evidence only. No DMARC policy record was evaluated and no DMARC verdict is asserted."
        : "DMARC is not inferred from an uploaded Authentication-Results header.",
    ),
  );

  return { checks, fixtureSource };
}

async function verifySpf(context: SmtpContext, resolver: Resolver): Promise<AuthenticationCheck> {
  try {
    const module = (await import("mailauth/lib/spf/index.js")) as {
      spf(options: { sender: string; ip: string; helo: string; mta: string; resolver: Resolver }): Promise<{ status?: { result?: string; comment?: string } }>;
    };
    const result = await module.spf({
      sender: context.envelopeFrom,
      ip: context.ip,
      helo: context.helo,
      mta: "etd.fixture.invalid",
      resolver,
    });
    const resultName = result.status?.result?.toLowerCase();
    const state = resultName === "pass" ? "pass" : resultName === "fail" ? "fail" : "unverifiable";
    const base = check(
      "spf",
      state,
      `SPF fixture verification result: ${resultName ?? "unverifiable"}${result.status?.comment ? ` (${result.status.comment})` : ""}.`,
      [],
      true,
      "SMTP context and DNS came from explicitly trusted local test fixtures, not the uploaded message or live delivery.",
    );
    const domain = context.envelopeFrom.split("@").at(-1)?.toLowerCase();
    return domain ? { ...base, domain } : base;
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    const lookup = ["ENOTFOUND", "ENODATA", "ETIMEOUT", "SERVFAIL", "REFUSED"].some((value) => code.includes(value));
    return check(
      "spf",
      lookup ? "lookup_error" : "unverifiable",
      lookup ? "SPF fixture DNS evidence could not be resolved." : "SPF fixture verification could not complete safely.",
      [],
      true,
      "No authentication pass was inferred from this error.",
    );
  }
}

function aligned(candidate: string, fromDomain: string): boolean {
  const left = getDomain(candidate, { allowPrivateDomains: true }) ?? candidate;
  const right = getDomain(fromDomain, { allowPrivateDomains: true }) ?? fromDomain;
  return left.toLowerCase() === right.toLowerCase();
}

async function verifyDkim(
  originalPath: string,
  parsed: ParsedEmail,
  resolver: Resolver,
  simulated: boolean,
): Promise<AuthenticationCheck[]> {
  try {
    const module = (await import("mailauth/lib/dkim/verify.js")) as {
      dkimVerify(message: Buffer, options: { resolver: Resolver; minBitLength: number }): Promise<MailauthResult>;
    };
    const result = await module.dkimVerify(await readFile(originalPath), { resolver, minBitLength: 1024 });
    if (!result.results?.length) {
      return [check("dkim", "unverifiable", "DKIM verification returned no signature result.", [], simulated, "The signature could not be evaluated.")];
    }
    return result.results.map((item, index) => {
      const resultName = item.status?.result?.toLowerCase();
      const state = resultName === "pass" ? "pass" : resultName === "fail" ? "fail" : "unverifiable";
      return {
        ...check(
          "dkim",
          state,
          `DKIM verification result: ${resultName ?? "unverifiable"}${item.status?.comment ? ` (${item.status.comment})` : ""}.`,
          parsed.dkimSignatures[index] ? [parsed.dkimSignatures[index]!.evidenceRef] : [],
          simulated,
          simulated ? "The DNS response came from an injected local test fixture, not live DNS." : null,
        ),
        ...(item.signingDomain ? { domain: item.signingDomain } : {}),
      };
    });
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
    const lookup = ["ENOTFOUND", "ENODATA", "ETIMEOUT", "SERVFAIL", "REFUSED"].some((value) => code.includes(value));
    return [
      check(
        "dkim",
        lookup ? "lookup_error" : "unverifiable",
        lookup ? "DKIM DNS evidence could not be resolved." : "DKIM verification could not complete safely.",
        parsed.dkimSignatures.map((header) => header.evidenceRef),
        simulated,
        "No authentication pass was inferred from this error.",
      ),
    ];
  }
}

async function loadFixtureResolver(path: string): Promise<Resolver | null> {
  try {
    const fixture = JSON.parse(await readFile(path, "utf8")) as Record<string, Record<string, unknown>>;
    return async (name, type) => {
      const value = fixture[name.toLowerCase()]?.[type.toUpperCase()];
      if (value === undefined) {
        const error = new Error(`No fixture DNS record for ${name} ${type}`) as Error & { code: string };
        error.code = "ENODATA";
        throw error;
      }
      return value;
    };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

function check(
  mechanism: AuthenticationCheck["mechanism"],
  state: AuthenticationCheck["state"],
  explanation: string,
  evidenceRefs: string[],
  simulated: boolean,
  limitation: string | null,
): AuthenticationCheck {
  return { mechanism, state, explanation, evidenceRefs, simulated, limitation };
}
