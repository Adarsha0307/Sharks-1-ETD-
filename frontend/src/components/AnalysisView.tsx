import { useState } from "react";
import { api, defangUrl } from "../api";
import type { Analysis, Finding } from "../types";

export function AnalysisView({ analysis, onReanalysis }: { analysis: Analysis; onReanalysis(jobId: string): void }) {
  const [working, setWorking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const categories = ["sender", "authentication", "url", "content", "attachment"];

  async function reanalyze() {
    setWorking(true);
    setActionError(null);
    try { onReanalysis((await api.reanalyze(analysis.emailId)).jobId); } catch { setActionError("Reanalysis could not be queued."); } finally { setWorking(false); }
  }

  async function exportAnalysis() {
    setExporting(true);
    setActionError(null);
    try {
      const payload = await api.exportAnalysis(analysis.analysisId);
      const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `analysis-${analysis.analysisId}.json`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch { setActionError("The sanitized export could not be generated."); } finally { setExporting(false); }
  }

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="grid gap-6 bg-ink p-6 text-paper sm:p-9 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8dd5bc]">Rules-based risk index</p>
            <div className="mt-3 flex items-end gap-3">
              <span className="text-6xl font-black tabular-nums">{analysis.riskIndex ?? "--"}</span>
              <span className="pb-2 text-lg font-bold uppercase tracking-wider text-paper/70">{analysis.riskBand ?? "Inconclusive"}</span>
            </div>
            <p className="mt-3 max-w-sm text-sm leading-6 text-paper/65">A ranking score, not a probability. Low risk is not a safety guarantee.</p>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Metric label="Completeness" value={analysis.completeness} />
            <Metric label="Confidence" value={analysis.evidenceConfidence} />
            <Metric label="Model" value={analysis.mlResult.status} />
            <Metric label="Version" value={`v${analysis.version}`} />
          </dl>
        </div>
        <div className="flex flex-wrap gap-3 p-5">
          <button className="button-primary" disabled={exporting} onClick={() => void exportAnalysis()}>{exporting ? "Exporting..." : "Export JSON"}</button>
          <button className="button-secondary" disabled={working} onClick={() => void reanalyze()}>{working ? "Queuing..." : "Reanalyze"}</button>
          <span className="self-center break-all font-mono text-xs text-ink/55">Analysis {analysis.analysisId}</span>
          {actionError && <p className="w-full text-sm text-danger" role="alert">{actionError}</p>}
        </div>
      </section>

      {analysis.scoreBreakdown.contradictoryEvidence.length > 0 && (
        <section className="rounded-xl border border-amber/30 bg-orange-50 p-5" aria-labelledby="contradiction-heading">
          <h2 className="font-bold" id="contradiction-heading">Contradictory evidence</h2>
          {analysis.scoreBreakdown.contradictoryEvidence.map((item) => <p className="mt-2 text-sm leading-6" key={item}>{item}</p>)}
        </section>
      )}

      <section className="panel p-6 sm:p-8" aria-labelledby="message-heading">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-moss">Extracted evidence</p>
        <h2 className="mt-2 text-2xl font-bold" id="message-heading">{analysis.observations.subject || "(No subject)"}</h2>
        <p className="mt-2 text-sm text-ink/65">From: {analysis.observations.from?.displayName || "Unknown"} &lt;{analysis.observations.from?.address || "missing"}&gt;</p>
        <div className="mt-6 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-ink/10 bg-white p-5 font-mono text-sm leading-6">{analysis.observations.textBody || "No plain-text body was extracted."}</div>
        {analysis.observations.parserWarnings.length > 0 && <div className="mt-4 text-sm text-amber"><strong>Parser warnings:</strong> {analysis.observations.parserWarnings.join("; ")}</div>}
      </section>

      <section aria-labelledby="findings-heading">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-moss">Rule output</p>
        <h2 className="mt-2 text-2xl font-bold" id="findings-heading">Evidence-backed findings</h2>
        {analysis.findings.length === 0 && <div className="panel mt-4 p-6"><strong>No configured rule produced a finding.</strong><p className="mt-2 text-sm text-ink/65">This does not establish that the email is safe.</p></div>}
        <div className="mt-4 space-y-6">
          {categories.map((category) => {
            const findings = analysis.findings.filter((finding) => finding.category === category);
            if (findings.length === 0) return null;
            return <div key={category}><h3 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-ink/60">{category}</h3><div className="grid gap-4 lg:grid-cols-2">{findings.map((finding) => <FindingCard finding={finding} key={finding.findingId} />)}</div></div>;
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="panel p-6">
          <h2 className="text-xl font-bold">Authentication checks</h2>
          <div className="mt-4 space-y-3">{analysis.authentication.checks.map((check, index) => <div className="rounded-lg border border-ink/10 bg-white p-4" key={`${check.mechanism}-${index}`}><div className="flex flex-wrap items-center gap-2"><strong className="uppercase">{check.mechanism}</strong><StatusPill value={check.state} />{check.simulated && <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-bold text-violet-800">Test fixture</span>}</div><p className="mt-2 text-sm leading-6">{check.explanation}</p>{check.limitation && <p className="mt-2 text-xs leading-5 text-ink/60">Limitation: {check.limitation}</p>}</div>)}</div>
        </div>
        <div className="panel p-6">
          <h2 className="text-xl font-bold">ML content classifier</h2>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-3 text-sm"><dt className="text-ink/60">Status</dt><dd><StatusPill value={analysis.mlResult.status} /></dd><dt className="text-ink/60">Output</dt><dd className="font-semibold">{analysis.mlResult.label ?? "Unavailable"}</dd><dt className="text-ink/60">Model</dt><dd className="break-all font-mono text-xs">{analysis.mlResult.modelVersion ?? "Not loaded"}</dd><dt className="text-ink/60">Language</dt><dd>{analysis.mlResult.language}</dd></dl>
          {analysis.mlResult.score !== null && <p className="mt-5 text-sm">Classifier score: <strong>{analysis.mlResult.score.toFixed(3)}</strong>. This is displayed separately from the rules index.</p>}
          {analysis.mlResult.limitation && <p className="mt-4 rounded-lg bg-paper p-3 text-sm leading-6">{analysis.mlResult.limitation}</p>}
        </div>
      </section>

      <section className="panel p-6" aria-labelledby="coverage-heading">
        <h2 className="text-xl font-bold" id="coverage-heading">Check coverage and limitations</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {analysis.observations.checkStatuses.map((check) => (
            <div className="rounded-lg border border-ink/10 bg-white p-4" key={check.check}>
              <div className="flex items-center justify-between gap-2"><strong className="capitalize">{check.check}</strong><StatusPill value={check.status} /></div>
              {check.limitation && <p className="mt-2 text-xs leading-5 text-ink/60">{check.limitation}</p>}
            </div>
          ))}
        </div>
        {analysis.limitations.map((limitation) => <p className="mt-3 text-sm text-ink/65" key={limitation}>{limitation}</p>)}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="panel p-6"><h2 className="text-xl font-bold">URLs (defanged)</h2>{analysis.observations.links.length === 0 ? <p className="mt-3 text-sm text-ink/60">No HTTP(S) URL was extracted.</p> : <ul className="mt-4 space-y-3">{analysis.observations.links.map((link) => <li className="break-all rounded-lg bg-paper p-3 font-mono text-xs" key={link.evidenceRef}>{defangUrl(link.original)}</li>)}</ul>}</div>
        <div className="panel p-6"><h2 className="text-xl font-bold">Attachment metadata</h2>{analysis.observations.attachments.length === 0 ? <p className="mt-3 text-sm text-ink/60">No attachment was extracted.</p> : <div className="mt-4 space-y-3">{analysis.observations.attachments.map((item) => <dl className="rounded-lg bg-paper p-3 text-sm" key={item.evidenceRef}><dt className="font-bold break-all">{item.filename || "Unnamed attachment"}</dt><dd className="mt-1">{item.declaredContentType} / {item.detectedContentType ?? "unknown signature"}</dd><dd className="mt-1 break-all font-mono text-xs">SHA-256 {item.sha256}</dd></dl>)}</div>}<p className="mt-4 text-xs leading-5 text-ink/60">Metadata only. Files were not opened, executed, or unpacked.</p></div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-paper/15 bg-white/5 p-3"><dt className="text-paper/55">{label}</dt><dd className="mt-1 break-words font-bold capitalize">{value.replaceAll("_", " ")}</dd></div>; }
function StatusPill({ value }: { value: string }) { return <span className="rounded-full border border-ink/15 bg-paper px-2 py-1 text-xs font-bold uppercase tracking-wide">{value.replaceAll("_", " ")}</span>; }
function FindingCard({ finding }: { finding: Finding }) { return <article className="panel border-l-4 p-5" style={{ borderLeftColor: finding.severity === "high" ? "#9f2f2f" : finding.severity === "medium" ? "#b45f18" : "#1f5b49" }}><div className="flex flex-wrap items-center gap-2"><StatusPill value={finding.severity} /><code className="text-xs">{finding.ruleId} / {finding.ruleVersion}</code></div><p className="mt-4 font-semibold leading-6">{finding.explanation}</p><details className="mt-4"><summary className="cursor-pointer font-semibold">Evidence and limitations</summary><ul className="mt-3 space-y-2 text-sm">{finding.evidenceRefs.map((evidence) => <li key={`${finding.findingId}-${evidence.ref}`}><code>{evidence.ref}</code>: {evidence.summary}</li>)}</ul>{finding.limitations.map((item) => <p className="mt-2 text-sm text-ink/60" key={item}>Limitation: {item}</p>)}</details><p className="mt-4 border-t border-ink/10 pt-4 text-sm"><strong>Recommended action:</strong> {finding.recommendedAction}</p></article>; }
