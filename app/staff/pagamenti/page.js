"use client";

import { useEffect, useRef, useState } from "react";
import StaffHeader from "@/app/components/StaffHeader";
import { euro, paymentModel, paymentVersion } from "@/app/utils/payments";

const labels = { unpaid: "Da pagare", partial: "Acconto", paid: "Saldato", review: "Da verificare" };
const colors = { unpaid: "bg-red-50 text-red-800", partial: "bg-amber-50 text-amber-800", paid: "bg-green-50 text-green-800", review: "bg-orange-50 text-orange-800" };
const inputClass = "mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-[#0a1628]";

function PaymentEditor({ model, tournaments, busy, error, onClose, onSave }) {
  const [mode, setMode] = useState(model.needsReview ? "allocate" : "add");
  const [amounts, setAmounts] = useState(model.players.map(() => "0"));
  const [reason, setReason] = useState("");
  const dialog = useRef(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const chooseMode = (next) => { setMode(next); setAmounts(next === "correct" ? model.paid.map((p) => (p / 100).toFixed(2)) : model.players.map(() => "0")); };
  return <dialog ref={dialog} aria-labelledby="payment-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%-3rem)] max-w-3xl overflow-y-auto rounded-2xl p-6 text-[#0a1628] shadow-xl backdrop:bg-slate-950/50">
    <form onSubmit={(event) => {
      event.preventDefault();
      if (mode === "correct" && !window.confirm("Confermi la correzione degli importi già registrati? L’operazione resterà nello storico.")) return;
      onSave({ id: model.registration.id, version: paymentVersion(model.registration, tournaments), mode, amounts, reason });
    }}>
      <div className="flex items-start justify-between gap-3"><div><h2 id="payment-title" className="text-xl font-black">Registra pagamento</h2><p className="mt-1 text-sm text-slate-600">{model.registration.giocatori} · {model.registration.torneo}</p></div><button type="button" aria-label="Chiudi pagamento" disabled={busy} onClick={onClose} className="min-h-11 px-3 text-xl">×</button></div>
      <p className="my-4 rounded-xl bg-slate-50 p-3 text-sm">Quota {euro(model.due ?? 0)} · Incassato {euro(model.total)} · Residuo {euro(model.remaining ?? 0)}</p>
      {model.needsReview && <p className="mb-4 rounded-xl bg-orange-50 p-3 text-sm text-orange-900">Il pagamento precedente richiede verifica. Attribuisci l’importo già incassato ai singoli atleti senza cambiare il totale, oppure usa una correzione motivata. Nessun importo verrà attribuito automaticamente.</p>}
      <label className="block text-sm font-bold">Operazione<select className={inputClass} value={mode} disabled={busy} onChange={(e) => chooseMode(e.target.value)}>{!model.needsReview && <option value="add">Nuovo versamento</option>}{model.needsReview && <option value="allocate">Attribuisci importo già incassato</option>}<option value="correct">Correggi importi registrati</option></select></label>
      <div className={`mt-4 grid gap-4 ${model.individual ? "grid-cols-1" : "md:grid-cols-2"}`}>{model.players.map((name, i) => <div key={i} className="rounded-xl border border-slate-200 p-4">
        <p className="font-bold">{name}</p><p className="mt-1 text-xs text-slate-600">Quota {euro(model.shares[i])} · Versato {euro(model.paid[i])} · Residuo {euro(Math.max(0, model.shares[i] - model.paid[i]))}</p>
        <label className="mt-3 block text-xs font-bold">{mode === "add" ? "Importo che versa ora (€)" : "Totale già versato da attribuire (€)"}<input autoFocus={i === 0} className={inputClass} inputMode="decimal" type="number" min="0" step="0.01" required disabled={busy} value={amounts[i]} onChange={(e) => setAmounts((old) => old.map((value, j) => j === i ? e.target.value : value))} /></label>
        {mode === "add" && <button type="button" disabled={busy} onClick={() => setAmounts((old) => old.map((value, j) => j === i ? (Math.max(0, model.shares[i] - model.paid[i]) / 100).toFixed(2) : value))} className="mt-2 min-h-11 text-xs font-bold underline">Inserisci saldo di {name}</button>}
      </div>)}</div>
      {mode === "correct" && <label className="mt-4 block text-sm font-bold">Motivo della correzione<textarea required maxLength={500} disabled={busy} className={`${inputClass} py-2`} value={reason} onChange={(e) => setReason(e.target.value)} /></label>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="mt-5 flex justify-end gap-3 border-t border-slate-200 pt-4"><button type="button" disabled={busy} className="min-h-11 rounded-xl border px-5 font-bold" onClick={onClose}>Annulla</button><button disabled={busy} className="min-h-11 rounded-xl bg-[#0a1628] px-6 font-bold text-white disabled:opacity-50">{busy ? "Salvataggio…" : mode === "add" ? "Conferma versamento" : "Salva attribuzione / correzione"}</button></div>
    </form>
  </dialog>;
}

export default function StaffPagamenti() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tournament, setTournament] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [inactive, setInactive] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [reload, setReload] = useState(0);
  const version = useRef(0);
  const locked = useRef(false);
  useEffect(() => {
    const controller = new AbortController(); let cancelled = false;
    const load = async () => {
      if (locked.current) return;
      const current = ++version.current;
      try {
        const response = await fetch("/api/staff/pagamenti", { cache: "no-store", signal: controller.signal });
        const json = await response.json();
        if (!response.ok || !Array.isArray(json.registrations) || !Array.isArray(json.tournaments)) throw new Error(json.error || "Dati pagamenti non validi.");
        if (!cancelled && current === version.current && !locked.current) { setData(json); setError(""); }
      } catch (reason) { if (!cancelled && current === version.current) setError(reason.message); }
    };
    load(); const timer = setInterval(load, 10000); window.addEventListener("focus", load);
    return () => { cancelled = true; controller.abort(); clearInterval(timer); window.removeEventListener("focus", load); };
  }, [reload]);
  const open = (model) => { locked.current = true; ++version.current; setSaveError(""); setMessage(""); setEditing(model); };
  const close = () => { locked.current = false; setEditing(null); setSaveError(""); setReload((n) => n + 1); };
  const save = async (body) => {
    if (busy) return;
    setBusy(true); setSaveError("");
    try {
      const response = await fetch("/api/staff/pagamenti", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Salvataggio non confermato.");
      setData((old) => ({ ...old, registrations: old.registrations.map((r) => String(r.id) === String(json.registration.id) ? json.registration : r) }));
      setMessage("Pagamento salvato sul server."); close();
    } catch (reason) { setSaveError(reason.message); }
    finally { setBusy(false); }
  };
  const all = data ? data.registrations.map((r) => paymentModel(r, data.tournaments)) : [];
  const filtered = all.filter((m) => (inactive ? m.inactive : !m.inactive) && (!tournament || m.registration.torneo === tournament) && (!search.trim() || `${m.registration.giocatori} ${m.registration.id} ${m.registration.torneo}`.toLocaleLowerCase("it-IT").includes(search.trim().toLocaleLowerCase("it-IT"))));
  const shown = filtered.filter((m) => status === "all" || m.status === status);
  const totals = filtered.reduce((sum, m) => ({ due: sum.due + (m.due ?? 0), paid: sum.paid + m.total, remaining: sum.remaining + (m.remaining ?? 0) }), { due: 0, paid: 0, remaining: 0 });
  const tournaments = [...new Set([...(data?.tournaments.map((t) => t.nome) || []), ...all.map((m) => m.registration.torneo)])];
  return <main className="min-h-screen bg-[#f8faff] pb-10"><StaffHeader /><div className="mx-auto max-w-[1600px] space-y-4 px-6 py-6 lg:px-8">
    <div className="flex items-center justify-between gap-3"><div><h1 className="text-3xl font-black text-[#0a1628]">Pagamenti</h1><p className="mt-2 text-sm text-slate-600">Gialli: quota individuale. Coppie: quota totale divisa tra i due atleti.</p></div><button className="min-h-11 rounded-xl border bg-white px-3 text-sm font-bold" disabled={!!editing} onClick={() => setReload((n) => n + 1)}>Aggiorna</button></div>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error} I dati precedenti non sono confermati come aggiornati.<button className="ml-2 underline" onClick={() => setReload((n) => n + 1)}>Riprova</button></div>}
    {message && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[minmax(220px,1fr)_minmax(260px,2fr)]"><label className="text-sm font-bold">Torneo<select value={tournament} onChange={(e) => setTournament(e.target.value)} className={inputClass}><option value="">Tutti i tornei</option>{tournaments.map((name) => <option key={name}>{name}</option>)}</select></label><label className="text-sm font-bold">Cerca atleta o coppia<input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome, cognome o iscrizione…" className={inputClass} /></label></div>
    {!data && !error && <p role="status">Caricamento pagamenti…</p>}
    {data && <><div className="grid grid-cols-3 gap-2">{[["Previsto", totals.due], ["Incassato", totals.paid], ["Residuo", totals.remaining]].map(([label, amount]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-5"><p className="text-xs text-slate-600">{label}</p><p className="mt-2 break-words text-lg font-black text-[#0a1628] sm:text-2xl">{euro(amount)}</p></div>)}</div><p className="text-xs text-slate-500">Totali riferiti a torneo e ricerca, indipendenti dal filtro pagamento. Quote mancanti escluse dal previsto.</p>
      <div role="group" aria-label="Stato pagamento" className="flex flex-wrap gap-2">{[["all", "Tutti"], ...Object.entries(labels)].map(([value, label]) => <button key={value} aria-pressed={status === value} onClick={() => setStatus(value)} className={`min-h-11 rounded-xl border px-3 text-sm font-bold ${status === value ? "bg-[#0a1628] text-white" : "bg-white text-slate-600"}`}>{label} ({value === "all" ? filtered.length : filtered.filter((m) => m.status === value).length})</button>)}</div>
      <label className="flex min-h-11 items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={inactive} onChange={(e) => setInactive(e.target.checked)} />Mostra solo annullate e rifiutate (consultazione)</label>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm"><h2 className="font-bold">Registro pagamenti</h2><span className="text-slate-500">{shown.length} iscrizioni · {shown.reduce((sum, m) => sum + m.players.length, 0)} atleti</span></div>
        <div role="region" aria-label="Registro pagamenti scorrevole" tabIndex={0} className="max-h-[65vh] overflow-auto focus-visible:outline-2 focus-visible:outline-[#0a1628]">
          <table className="w-full min-w-[1040px] border-separate border-spacing-0 text-sm">
            <caption className="sr-only">Pagamenti per iscrizione e singolo atleta. Gli importi della coppia si riferiscono all’intera iscrizione.</caption>
            <thead className="sticky top-0 z-20 bg-slate-100 text-xs text-slate-600"><tr>{["Iscrizione / torneo", "Atleta", "Quota atleta", "Versato atleta", "Residuo atleta", "Incassato / quota totale", "Stato", "Operazioni"].map((heading, i) => <th scope="col" key={heading} className={`border-b border-slate-200 px-4 py-3 font-bold ${i >= 2 && i <= 5 ? "text-right" : "text-left"}`}>{heading}</th>)}</tr></thead>
            {shown.map((model) => <tbody key={model.registration.id} className="group">{model.players.map((name, i) => <tr key={i} className="hover:bg-slate-50">
              {i === 0 && <th scope="rowgroup" rowSpan={model.players.length} className="w-64 min-w-48 border-b border-slate-200 px-4 py-3 text-left align-top font-normal"><p className="font-bold text-[#0a1628]">{model.registration.giocatori}</p><p className="mt-1 text-xs text-slate-500">{model.registration.torneo} · #{model.registration.id}</p><p className="mt-1 text-xs text-slate-500">{model.registration.stato}</p>
                {!!model.registration.paymentHistory?.length && <details className="mt-2 text-xs text-slate-500"><summary className="min-h-8 cursor-pointer font-semibold">Storico operazioni</summary><ul className="max-h-48 space-y-2 overflow-auto pt-2">{[...model.registration.paymentHistory].reverse().map((entry, j) => <li key={j}>{new Date(entry.at).toLocaleString("it-IT")} · {entry.mode === "add" ? "Versamento" : entry.mode === "allocate" ? "Attribuzione" : "Correzione"} · {euro(Math.round(entry.before * 100))} → {euro(Math.round(entry.after * 100))}{entry.reason && ` · ${entry.reason}`}</li>)}</ul></details>}
              </th>}
              <th scope="row" className="min-w-36 border-b border-slate-200 px-4 py-3 text-left font-semibold">{name}</th>
              <td className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-right tabular-nums">{model.due === null ? "Da configurare" : euro(model.shares[i])}</td>
              <td className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-right font-semibold tabular-nums">{euro(model.paid[i])}</td>
              <td className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-right tabular-nums">{model.needsReview ? <span className="text-xs text-orange-800">Da verificare</span> : euro(Math.max(0, model.shares[i] - model.paid[i]))}</td>
              {i === 0 && <><td rowSpan={model.players.length} className="whitespace-nowrap border-b border-slate-200 px-4 py-3 text-right align-top tabular-nums"><strong>{euro(model.total)}</strong><span className="text-slate-500"> / {model.due === null ? "—" : euro(model.due)}</span>{model.remaining !== null && <p className="mt-1 text-xs text-slate-500">Residuo {euro(model.remaining)}</p>}</td>
                <td rowSpan={model.players.length} className="border-b border-slate-200 px-4 py-3 align-top"><span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${colors[model.status]}`}>{labels[model.status]}</span></td>
                <td rowSpan={model.players.length} className="sticky right-0 border-b border-l border-slate-200 bg-white px-4 py-3 align-top"><button disabled={!!error || model.inactive || model.due === null} className="min-h-11 whitespace-nowrap rounded-lg bg-[#0a1628] px-3 text-xs font-bold text-white disabled:opacity-40" onClick={() => open(model)}>{model.needsReview ? "Verifica pagamento" : "Registra pagamento"}</button></td></>}
            </tr>)}</tbody>)}
          </table>
          {!shown.length && <p className="p-6 text-sm text-slate-500">Nessuna iscrizione con questi filtri.</p>}
        </div>
      </div><p className="text-xs text-slate-500">Su tablet puoi scorrere la tabella orizzontalmente; il pulsante di pagamento resta visibile sulla destra.</p></>}
    {editing && <PaymentEditor key={editing.registration.id} model={editing} tournaments={data.tournaments} busy={busy} error={saveError} onClose={close} onSave={save} />}
  </div></main>;
}
