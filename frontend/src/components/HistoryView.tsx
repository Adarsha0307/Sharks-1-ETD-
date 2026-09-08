import { useEffect, useState } from "react";
import { api } from "../api";
import type { HistoryItem } from "../types";

export function HistoryView({ onOpen }: { onOpen(analysisId: string): void }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    api.history().then((result) => active && setItems(result.items)).catch(() => active && setError("History could not be loaded.")).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);
  return <section><p className="text-xs font-bold uppercase tracking-[0.2em] text-moss">Permitted records</p><h2 className="mt-2 text-3xl font-black">Analysis history</h2><p className="mt-3 text-ink/65">Only evidence owned by the signed-in lab account appears here.</p>{loading && <p className="mt-6" role="status">Loading history...</p>}{error && <p className="mt-6 text-danger" role="alert">{error}</p>}<div className="mt-6 grid gap-4">{items.map((item) => <article className="panel flex flex-col justify-between gap-5 p-5 sm:flex-row sm:items-center" key={item.emailId}><div className="min-w-0"><h3 className="truncate font-bold">{item.subject || "(No subject extracted)"}</h3><p className="mt-1 truncate text-sm text-ink/60">{item.originalFilename}</p><p className="mt-2 text-xs text-ink/50">{new Date(item.createdAt).toLocaleString()} / {item.state}</p></div><div className="flex items-center gap-4"><div className="text-right"><div className="text-2xl font-black tabular-nums">{item.riskIndex ?? "--"}</div><div className="text-xs font-bold uppercase text-ink/55">{item.riskBand ?? item.completeness ?? "pending"}</div></div>{item.analysisId ? <button className="button-secondary" onClick={() => onOpen(item.analysisId!)}>Open</button> : <span className="rounded-full bg-paper px-3 py-2 text-sm font-semibold">Processing</span>}</div></article>)}{!loading && items.length === 0 && <div className="panel p-8 text-center text-ink/60">No email has been uploaded by this account.</div>}</div></section>;
}
