import { useState, type FormEvent } from "react";
import { ApiError, api } from "../api";
import type { User } from "../types";

export function LoginView({ onLogin }: { onLogin(user: User): void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.login(username, password);
      onLogin(result.user);
    } catch (failure) {
      setError(failure instanceof ApiError ? `${failure.message}${failure.requestId ? ` Request ${failure.requestId}.` : ""}` : "Sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="panel grid w-full max-w-4xl overflow-hidden md:grid-cols-[1.15fr_1fr]">
        <div className="bg-ink p-8 text-paper sm:p-12">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#8dd5bc]">Local analysis lab</p>
          <h1 className="mt-5 max-w-md text-4xl font-black leading-tight sm:text-5xl">Inspect the evidence, not just the verdict.</h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-paper/75">Upload authorized or synthetic original email files. Results preserve uncertainty, rule evidence, and processing failures.</p>
          <div className="mt-10 border-l-2 border-[#8dd5bc] pl-4 text-sm leading-6 text-paper/70">This detector does not visit links, execute attachments, or guarantee that low-risk email is safe.</div>
        </div>
        <form className="p-8 sm:p-12" onSubmit={(event) => void submit(event)}>
          <h2 className="text-2xl font-bold">Analyst sign in</h2>
          <p className="mt-2 text-sm leading-6 text-ink/65">Use a provisioned disposable lab account. Public registration is disabled.</p>
          <label className="mt-8 block font-semibold" htmlFor="username">Username</label>
          <input className="field mt-2" id="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
          <label className="mt-5 block font-semibold" htmlFor="password">Password</label>
          <input className="field mt-2" id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          {error && <p className="mt-4 rounded-lg border border-danger/30 bg-red-50 p-3 text-sm text-danger" role="alert">{error}</p>}
          <button className="button-primary mt-6 w-full" disabled={submitting}>{submitting ? "Signing in..." : "Sign in"}</button>
        </form>
      </section>
    </main>
  );
}
