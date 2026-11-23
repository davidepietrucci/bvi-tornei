"use client";
import { useRef, useState } from "react";

export default function GialloCompletionPanel({ config, slug, editable = false, disabled = false, onComplete, onBusyChange }) {
  const [review, setReview] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const currentReview = review?.baseline === config ? review : null;
  const official = config.completion;
  const rows = official?.rows || currentReview?.preview.rows || [];
  async function run(action) {
    if (lock.current || disabled || action !== "preview" && !currentReview || action === "close" && !currentReview.preview.ready) return;
    if (action !== "preview" && !window.confirm(action === "close" ? "Confermare classifica, piazzamenti e chiusura del torneo? Risultati e visibilità non cambieranno." : "Riaprire il torneo? Saranno ripristinati i piazzamenti precedenti alla chiusura. I risultati delle partite saranno conservati.")) return;
    lock.current = true; setPending(true); setError(""); onBusyChange?.(true);
    try {
      const response = await fetch("/api/staff/giallo/chiusura", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, action, ...(action === "preview" ? { baseline: config } : { fingerprint: currentReview.fingerprint }) }) });
      const result = await response.json();
      if (!response.ok || result.success !== true) throw new Error(result.error || "Operazione non confermata.");
      if (action === "preview") {
        if (!result.preview || !Array.isArray(result.preview.rows) || typeof result.preview.ready !== "boolean" || typeof result.fingerprint !== "string") throw new Error("Riepilogo non valido. Aggiorna e riprova.");
        setReview({ ...result, baseline: config });
      } else {
        if (!result.config || !result.tournament) throw new Error("Conferma incompleta dal server. Aggiorna i dati.");
        onComplete?.(result); setReview(null);
      }
    } catch (reason) { setError(reason.message || "Operazione non confermata."); }
    finally { lock.current = false; setPending(false); onBusyChange?.(false); }
  }
  if (!editable && !official) return null;
  return <section aria-label="Classifica finale e chiusura torneo" className="staff-panel space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
    <div><h3 className="text-lg font-bold">Classifica finale {official ? "confermata" : "e chiusura torneo"}</h3><p className="mt-2 text-sm text-slate-600">Stesso piazzamento e stessi punti ai compagni. Eliminati nello stesso turno a pari merito: 5° ai quarti; 9° agli spareggi prima dei quarti, oppure 5° prima delle semifinali. Su 15 iscritti, i tre non qualificati sono 13° ex aequo.</p></div>
    {official && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">Torneo chiuso. Riapri il torneo per correggere i risultati.</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {editable && <button type="button" disabled={disabled || pending} onClick={() => run("preview")} className="staff-button disabled:opacity-40">{pending ? "Verifica in corso…" : official ? "Verifica dati per riaprire" : "Verifica classifica e chiudi torneo"}</button>}
    {currentReview && !official && <div role="status" className="text-sm text-slate-600">{currentReview.preview.ready ? <p>Risultati completi. Controlla la classifica: i piazzamenti presenti nelle iscrizioni verranno aggiornati.</p> : <ul className="list-inside list-disc text-amber-800">{currentReview.preview.problems.map(problem => <li key={problem}>{problem}</li>)}</ul>}<p className="mt-2">{currentReview.preview.awardsTourPoints ? `Punti assegnati al tour ${currentReview.preview.tourName}.` : "Nessun punto tour: il torneo non è una tappa collegata a un tour."}</p></div>}
    {rows.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{["Piazzamento", "Atleta", "Fase", "Punti tour"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{rows.map(row => <tr key={row.registrationId} className="border-t border-slate-200"><td className="p-3 font-bold">{row.placement ? `${row.placement}°` : "Da definire"}</td><td className="p-3">{row.name}</td><td className="p-3">{row.stage}</td><td className="p-3">{row.points || "—"}</td></tr>)}</tbody></table></div>}
    {editable && currentReview && <div className="flex flex-wrap gap-3"><button type="button" disabled={disabled || pending || !official && !currentReview.preview.ready} onClick={() => run(official ? "reopen" : "close")} className="staff-button staff-button-yellow disabled:opacity-40">{official ? "Conferma riapertura torneo" : "Conferma classifica e chiudi torneo"}</button><button type="button" disabled={pending} onClick={() => setReview(null)} className="staff-button">Annulla</button></div>}
  </section>;
}
