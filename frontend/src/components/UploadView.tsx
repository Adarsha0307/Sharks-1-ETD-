import { useState, type FormEvent } from "react";
import { ApiError, api } from "../api";
import type { Job } from "../types";

export function UploadView({ job, onAccepted }: { job: Job | null; onAccepted(jobId: string): void }) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError("The selected file exceeds the 10 MB upload limit."); return; }
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.upload(file);
      onAccepted(result.jobId);
    } catch (failure) {
      setError(failure instanceof ApiError ? `${failure.message}${failure.requestId ? ` Request ${failure.requestId}.` : ""}` : "Upload failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="panel p-6 sm:p-9">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-moss">New analysis</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight">Preserve and inspect an original email</h2>
        <p className="mt-3 max-w-2xl leading-7 text-ink/70">Choose one authorized or synthetic <code>.eml</code> file. The server validates structure, hashes original bytes, stores evidence under a generated name, and queues bounded analysis.</p>
        <form className="mt-8" onSubmit={(event) => void submit(event)}>
          <label className="block rounded-xl border-2 border-dashed border-moss/35 bg-emerald-50/50 p-6 text-center transition-colors hover:border-moss" htmlFor="email-file">
            <span className="block text-lg font-bold">Select an .eml file</span>
            <span className="mt-2 block text-sm text-ink/65">Maximum original size: 10 MB</span>
            <input className="mt-5 block w-full cursor-pointer text-sm" id="email-file" type="file" accept=".eml,message/rfc822" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required />
          </label>
          {file && <p className="mt-4 break-all text-sm"><strong>Selected:</strong> {file.name} ({formatBytes(file.size)})</p>}
          {error && <p className="mt-4 rounded-lg border border-danger/30 bg-red-50 p-3 text-sm text-danger" role="alert">{error}</p>}
          <button className="button-primary mt-6" disabled={!file || submitting}>{submitting ? "Preserving evidence..." : "Upload for analysis"}</button>
        </form>
      </section>
      <aside className="panel p-6 sm:p-8" aria-labelledby="job-heading">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber">Persisted job</p>
        <h2 className="mt-3 text-2xl font-bold" id="job-heading">Processing state</h2>
        {!job && <p className="mt-4 leading-7 text-ink/65">No job is currently being monitored.</p>}
        {job && (
          <div className="mt-5" aria-live="polite">
            <div className="flex items-center gap-3"><span className={`h-3 w-3 rounded-full ${["failed", "cancelled"].includes(job.status) ? "bg-danger" : ["completed", "partial"].includes(job.status) ? "bg-moss" : "animate-pulse bg-amber"}`} aria-hidden="true" /><strong className="capitalize">{job.stage}</strong></div>
            <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-ink/60">Status</dt><dd className="font-medium">{job.status}</dd>
              <dt className="text-ink/60">Attempt</dt><dd className="font-medium">{job.attemptCount} / {job.maxAttempts}</dd>
              <dt className="text-ink/60">Job ID</dt><dd className="break-all font-mono text-xs">{job.jobId}</dd>
            </dl>
            {job.errorMessage && <p className="mt-5 rounded-lg border border-danger/30 bg-red-50 p-3 text-sm text-danger" role="alert">{job.errorMessage} {job.errorCode && <code>({job.errorCode})</code>}</p>}
          </div>
        )}
      </aside>
    </div>
  );
}

function formatBytes(value: number): string {
  return value < 1024 * 1024 ? `${(value / 1024).toFixed(1)} KB` : `${(value / 1024 / 1024).toFixed(2)} MB`;
}
