import { useEffect, useState } from "react";
import { ApiError, api } from "./api";
import { AnalysisView } from "./components/AnalysisView";
import { HistoryView } from "./components/HistoryView";
import { LoginView } from "./components/LoginView";
import { UploadView } from "./components/UploadView";
import type { Analysis, Job, User } from "./types";

type View = "upload" | "history" | "analysis";
const pendingJobKey = "etd.pendingJob";

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [view, setView] = useState<View>("upload");
  const [job, setJob] = useState<Job | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.session()
      .then(({ user: current }) => {
        if (!active) return;
        setUser(current);
        const pending = sessionStorage.getItem(pendingJobKey);
        if (pending) void monitorJob(pending, active);
      })
      .catch(() => undefined)
      .finally(() => active && setCheckingSession(false));
    return () => { active = false; };
  }, []);

  async function monitorJob(jobId: string, active = true): Promise<void> {
    sessionStorage.setItem(pendingJobKey, jobId);
    setView("upload");
    for (let attempt = 0; attempt < 180 && active; attempt += 1) {
      try {
        const current = await api.job(jobId);
        if (!active) return;
        setJob(current);
        if (["completed", "partial"].includes(current.status) && current.analysisId) {
          const result = await api.analysis(current.analysisId);
          if (!active) return;
          setAnalysis(result);
          setView("analysis");
          sessionStorage.removeItem(pendingJobKey);
          return;
        }
        if (["failed", "cancelled"].includes(current.status)) {
          sessionStorage.removeItem(pendingJobKey);
          return;
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          setUser(null);
          sessionStorage.removeItem(pendingJobKey);
          return;
        }
        setNotice("Job status is temporarily unknown. Reload to check the persisted job; the email will not be uploaded again.");
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, Math.min(5000, 750 + attempt * 150)));
    }
    if (active) setNotice("Job status is still unknown. Reload to check the persisted job; the email will not be uploaded again.");
  }

  async function signOut() {
    try { await api.logout(); } finally {
      setUser(null);
      setAnalysis(null);
      setJob(null);
      sessionStorage.removeItem(pendingJobKey);
    }
  }

  if (checkingSession) return <main className="grid min-h-screen place-items-center p-6"><p role="status">Checking local session...</p></main>;
  if (!user) return <LoginView onLogin={setUser} />;

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/10 bg-panel/95">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-moss">SIH26106 / Member A</p>
            <h1 className="text-xl font-bold tracking-tight">Email Threat Detector</h1>
          </div>
          <nav aria-label="Primary" className="flex items-center gap-2">
            <button className="button-secondary" aria-current={view === "upload" ? "page" : undefined} onClick={() => setView("upload")}>Upload</button>
            <button className="button-secondary" aria-current={view === "history" ? "page" : undefined} onClick={() => setView("history")}>History</button>
            <button className="button-secondary" onClick={() => void signOut()}>Sign out</button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {notice && <div className="mb-5 rounded-lg border border-amber/30 bg-orange-50 p-4 text-sm" role="status">{notice}</div>}
        {view === "upload" && <UploadView job={job} onAccepted={(id) => void monitorJob(id)} />}
        {view === "history" && <HistoryView onOpen={(id) => { void api.analysis(id).then((result) => { setAnalysis(result); setView("analysis"); }).catch(() => setNotice("The selected analysis could not be loaded.")); }} />}
        {view === "analysis" && analysis && <AnalysisView analysis={analysis} onReanalysis={(id) => void monitorJob(id)} />}
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-sm text-ink/65 sm:px-6">
        Local evidence review only. No link is fetched and no attachment is executed.
      </footer>
    </div>
  );
}
