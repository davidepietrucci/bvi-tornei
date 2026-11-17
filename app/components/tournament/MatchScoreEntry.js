"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { completedMatch, matchIdentity, matchStatus, validateMatchDetails, validateMatchSets } from "@/app/utils/match-scoring";

const seedDraft = (match) => Array.from({ length: match.bestOf || 1 }, (_, i) => [match.score?.[i]?.[0] ?? "", match.score?.[i]?.[1] ?? ""]);
const serialize = (value) => JSON.stringify(value.map((pair) => pair.map((n) => String(n))));
const seedDetails = (match) => ({ court: match.court || "", time: match.time || "", status: matchStatus(match) });
const detailsChanged = (details, match) => JSON.stringify(details) !== JSON.stringify(seedDetails(match));
const statusLabel = (status) => ({ scheduled: "Da giocare", in_progress: "In corso", finished: "Terminata" })[status];

export default function MatchScoreEntry({ groups, onSave, onClear, onSaveDetails, disabled = false, onDirtyChange }) {
  const [groupId, setGroupId] = useState(groups[0]?.id || "");
  const [matchId, setMatchId] = useState("");
  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [advanceFrom, setAdvanceFrom] = useState(null);
  const [detailDrafts, setDetailDrafts] = useState({});
  const saveLock = useRef(false);
  const group = groups.find((g) => g.id === groupId) || groups[0];
  const matches = group?.matches || [];
  const match = matches.find((m) => m.id === matchId) || matches.find((m) => m.ready !== false && !completedMatch(m)) || matches[0];
  const identity = match ? matchIdentity(match) : "";
  const draft = match ? drafts[identity] || seedDraft(match) : [];
  const details = match ? detailDrafts[identity] || seedDetails(match) : {};
  const detailsDirty = match && detailsChanged(details, match);
  const dirty = match && serialize(draft) !== serialize(seedDraft(match));
  const saved = match && completedMatch(match);
  const completed = matches.filter(completedMatch).length;
  const identities = useMemo(() => new Map(groups.flatMap((g) => g.matches.map((m) => [matchIdentity(m), m]))), [groups]);
  const dirtyCount = new Set([
    ...Object.entries(drafts).filter(([key, value]) => identities.has(key) && serialize(value) !== serialize(seedDraft(identities.get(key)))).map(([key]) => key),
    ...Object.entries(detailDrafts).filter(([key, value]) => identities.has(key) && detailsChanged(value, identities.get(key))).map(([key]) => key),
  ]).size;
  useEffect(() => { onDirtyChange?.(dirtyCount); }, [dirtyCount, onDirtyChange]);
  useEffect(() => {
    if (!dirtyCount) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyCount]);
  useEffect(() => {
    if (!advanceFrom) return;
    const currentGroup = groups.find((g) => g.id === advanceFrom.group);
    const next = currentGroup?.matches.find((m) => m.id !== advanceFrom.id && m.ready !== false && !completedMatch(m));
    if (next) { setMatchId(next.id); setMessage("Risultato salvato. Puoi inserire la prossima partita."); }
    else setMessage(currentGroup?.matches.every(completedMatch) ? "Girone completato: tutti i risultati sono salvati." : "Risultato salvato. Seleziona un’altra partita o un altro girone.");
    setAdvanceFrom(null);
  }, [groups, advanceFrom]);

  const select = (nextGroup, nextMatch = "") => {
    if (saving) return;
    setGroupId(nextGroup); setMatchId(nextMatch); setError(""); setMessage("");
  };
  const save = async (advance) => {
    if (!match || saveLock.current || disabled || match.ready === false) return;
    setError(""); setMessage("");
    let score, validatedDetails;
    try { score = validateMatchSets(draft, match.bestOf || 1, match.target || null); validatedDetails = validateMatchDetails(match, details, score); }
    catch (reason) { setError(reason.message); return; }
    saveLock.current = true; setSaving(true);
    try {
      const confirmed = await onSave(match, score, validatedDetails);
      if (confirmed !== true) { setError("Salvataggio non confermato. Il punteggio resta in bozza: controlla l’avviso e riprova."); return; }
      setGroupId(group.id); setMatchId(match.id);
      setDrafts((previous) => { const next = { ...previous }; delete next[identity]; return next; });
      setDetailDrafts((previous) => { const next = { ...previous }; delete next[identity]; return next; });
      setMessage("Risultato salvato sul server.");
      if (advance) setAdvanceFrom({ id: match.id, group: group.id });
    } catch (reason) { setError(reason.message || "Salvataggio non riuscito. Il punteggio non è stato perso."); }
    finally { saveLock.current = false; setSaving(false); }
  };
  const saveDetails = async () => {
    if (!match || !onSaveDetails || saveLock.current || disabled) return;
    setError(""); setMessage("");
    let validated;
    try { validated = validateMatchDetails(match, details); } catch (reason) { setError(reason.message); return; }
    saveLock.current = true; setSaving(true);
    try {
      if (await onSaveDetails(match, validated) !== true) { setError("Salvataggio non confermato. Le modifiche alla partita restano in bozza."); return; }
      setGroupId(group.id); setMatchId(match.id);
      setDetailDrafts((previous) => { const next = { ...previous }; delete next[identity]; return next; });
      setMessage("Campo, orario e stato salvati. I punteggi non sono stati modificati.");
    } catch (reason) { setError(reason.message || "Salvataggio della partita non riuscito."); }
    finally { saveLock.current = false; setSaving(false); }
  };
  const clear = async () => {
    if (!onClear || saveLock.current || disabled || !window.confirm("Rimuovere il risultato salvato di questa partita? La classifica verrà aggiornata.")) return;
    saveLock.current = true; setSaving(true); setError(""); setMessage("");
    try {
      if (await onClear(match) !== true) { setError("Rimozione non confermata. Il risultato salvato non è stato modificato."); return; }
      setMatchId(match.id);
      setDrafts((previous) => { const next = { ...previous }; delete next[identity]; return next; });
      setMessage("Risultato rimosso. La partita è di nuovo da giocare.");
      setDetailDrafts((previous) => previous[identity] ? { ...previous, [identity]: { ...previous[identity], status: "scheduled" } } : previous);
    } catch (reason) { setError(reason.message || "Rimozione non riuscita."); }
    finally { saveLock.current = false; setSaving(false); }
  };

  if (!match) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-600">Non ci sono partite da segnare. Completa prima la composizione dei gironi.</div>;
  return <section aria-label="Segna risultati delle partite" className="space-y-5 text-[#0a1628]">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[.18em] text-slate-500">Risultati dei gironi</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">Segna risultati</h2><p className="mt-2 text-sm text-slate-500">Una partita alla volta. La classifica cambia solo dopo il salvataggio.</p></div>
      <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm"><strong>{completed} / {matches.length}</strong> salvate in {group.label}</span>
    </div>
    <nav aria-label="Scegli il girone" className="flex flex-wrap gap-2">{groups.map((g) => <button key={g.id} type="button" disabled={saving || disabled} aria-pressed={group.id === g.id} onClick={() => select(g.id)}
      className={`rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-40 ${group.id === g.id ? "border-[#0a1628] bg-[#0a1628] text-white" : "border-slate-200 bg-white text-slate-600"}`}>{g.label}<span className="ml-2 text-xs opacity-60">{g.matches.filter(completedMatch).length}/{g.matches.length}</span></button>)}</nav>
    {dirtyCount > 0 && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <span>{dirtyCount === 1 ? "Una partita ha modifiche non salvate." : `${dirtyCount} partite hanno modifiche non salvate.`} Le bozze restano disponibili cambiando partita o girone.</span>
      <button type="button" disabled={saving} className="font-bold underline" onClick={() => {
        if (window.confirm("Scartare tutte le modifiche non salvate a punteggi, campo, orario e stato? I dati già salvati non cambieranno.")) { setDrafts({}); setDetailDrafts({}); setError(""); }
      }}>Scarta le bozze</button>
    </div>}
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">{message}</p>}
    <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Scegli la partita" className="flex gap-2 overflow-x-auto pb-2 lg:flex-col">{matches.map((m, i) => {
        const done = completedMatch(m);
        const hasDraft = (drafts[matchIdentity(m)] && serialize(drafts[matchIdentity(m)]) !== serialize(seedDraft(m))) || (detailDrafts[matchIdentity(m)] && detailsChanged(detailDrafts[matchIdentity(m)], m));
        return <button type="button" key={m.id} disabled={saving || disabled} aria-pressed={match.id === m.id} onClick={() => select(group.id, m.id)}
          className={`min-w-36 rounded-xl border p-4 text-left disabled:opacity-40 ${match.id === m.id ? "border-[#0a1628] bg-slate-100 ring-1 ring-[#0a1628]" : "border-slate-200 bg-white"}`}>
          <span className="block text-sm font-bold">Partita {i + 1}</span><span className={`mt-2 block text-xs ${hasDraft ? "text-amber-800" : done ? "text-green-700" : "text-slate-500"}`}>{hasDraft ? "Bozza da salvare" : m.ready === false ? "In attesa di squadre" : statusLabel(matchStatus(m))}</span>
          {(m.court || m.time) && <span className="mt-2 block text-xs text-slate-500">{[m.court && `Campo ${m.court}`, m.time].filter(Boolean).join(" · ")}</span>}
          {done && <span className="mt-2 block text-sm font-black">{m.score.filter((s) => s.every((n) => n !== "" && n !== null && n !== undefined)).map((s) => s.join("–")).join(" · ")}</span>}
        </button>;
      })}</nav>
      <form noValidate onSubmit={(event) => { event.preventDefault(); return save(true); }} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-7">
          <div><h3 className="text-lg font-bold">{group.label} · Partita {matches.indexOf(match) + 1} di {matches.length}</h3><p className="mt-1 text-xs text-slate-500">{match.bestOf === 3 ? "Due set su tre" : "Set unico"}{match.target ? ` a ${match.target} · vantaggio di 2` : " · punteggio secondo il regolamento del torneo"}</p></div>
          <span className={`rounded-full px-3 py-2 text-xs font-bold ${dirty || detailsDirty ? "bg-amber-50 text-amber-800" : saved ? "bg-green-50 text-green-800" : "bg-slate-100 text-slate-500"}`}>{saving ? "Salvataggio…" : dirty || detailsDirty ? "Modifiche non salvate" : statusLabel(matchStatus(match))}</span>
        </div>
        <div className="space-y-6 p-5 sm:p-7">
          {onSaveDetails && <fieldset disabled={saving || disabled} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <legend className="px-2 text-sm font-bold">Gestione della partita</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              {[{ key: "court", label: "Campo", type: "text", placeholder: "Es. 1 o Sabbia A" }, { key: "time", label: "Orario", type: "time" }].map((field) => <label key={field.key} className="text-sm font-semibold">{field.label}<input aria-label={field.label} type={field.type} placeholder={field.placeholder} maxLength={field.key === "court" ? 40 : undefined} value={details[field.key]} onChange={(event) => { setGroupId(group.id); setMatchId(match.id); setDetailDrafts((previous) => ({ ...previous, [identity]: { ...details, [field.key]: event.target.value } })); setError(""); setMessage(""); }} className="mt-2 block w-full min-w-0 rounded-xl border border-slate-300 bg-white p-3" /></label>)}
              <label className="text-sm font-semibold">Stato<select aria-label="Stato partita" value={details.status} onChange={(event) => { setGroupId(group.id); setMatchId(match.id); setDetailDrafts((previous) => ({ ...previous, [identity]: { ...details, status: event.target.value } })); setError(""); setMessage(""); }} className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3">
                <option value="scheduled" disabled={saved}>Da giocare</option><option value="in_progress" disabled={saved || match.ready === false}>In corso</option><option value="finished" disabled={!saved}>Terminata</option>
              </select></label>
            </div>
            <p className="mt-3 text-xs text-slate-500">Salva questi dati anche senza punteggio. Un risultato valido imposta automaticamente Terminata; per riaprire una partita rimuovi il risultato.</p>
            <button type="button" disabled={!detailsDirty} onClick={saveDetails} className="mt-4 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold disabled:opacity-40">Salva gestione partita</button>
          </fieldset>}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-3 sm:gap-5">
            {[match.left, match.right].map((pair, side) => <div key={side} className={side === 0 ? "col-start-1 row-start-1 rounded-xl bg-[#0a1628] p-4 text-white sm:p-5" : "col-start-3 row-start-1 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5"}>
              <p className={`mb-3 text-[10px] font-bold uppercase tracking-widest ${side === 0 ? "text-slate-300" : "text-slate-500"}`}>Coppia {side + 1}</p>
              {pair.map((name, i) => <p key={i} className="break-words text-base font-bold leading-6 sm:text-xl sm:leading-8">{name}</p>)}
            </div>)}
            <span aria-hidden="true" className="col-start-2 row-start-1 self-center text-xs font-black text-slate-400">VS</span>
          </div>
          {match.ready === false && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Le coppie non sono ancora definite. Completa la composizione o le partite precedenti prima di inserire il risultato.</p>}
          <fieldset disabled={saving || disabled || match.ready === false} className="space-y-3">
            <legend className="mb-3 text-sm font-bold">Punteggio finale</legend>
            {draft.map((pair, set) => <div key={set} className="grid grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] items-center gap-3 rounded-xl bg-slate-50 p-3 sm:px-8">
              {[0, 1].map((side) => <input key={side} type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder="—" aria-label={`Punti coppia ${side + 1}, set ${set + 1}`} value={pair[side]}
                className={`h-20 min-w-0 w-full rounded-xl border-2 border-slate-200 bg-white text-center text-4xl font-black text-[#0a1628] outline-none focus:border-[#0a1628] focus:ring-2 focus:ring-yellow-200 disabled:opacity-50 sm:text-5xl ${side === 1 ? "col-start-3 row-start-1" : "col-start-1 row-start-1"}`}
                onChange={(event) => { const value = event.target.value; setMatchId(match.id); setGroupId(group.id); setDrafts((previous) => ({ ...previous, [identity]: draft.map((row, i) => i === set ? row.map((n, j) => j === side ? value : n) : [...row]) })); setError(""); setMessage(""); }} />)}
              <span className="col-start-2 row-start-1 text-center text-xs font-bold uppercase tracking-widest text-slate-500">{match.bestOf === 3 ? `Set ${set + 1}` : "Punti"}</span>
            </div>)}
            {match.bestOf === 3 && <p className="text-xs text-slate-500">Compila il terzo set solo se le coppie hanno vinto un set a testa.</p>}
          </fieldset>
          <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-5">
            <button disabled={saving || disabled || match.ready === false} className="rounded-xl bg-[#FFD700] px-5 py-3 text-sm font-black text-[#0a1628] disabled:opacity-40">{saving ? "Salvataggio…" : "Salva e prossima partita →"}</button>
            <button type="button" disabled={saving || disabled || match.ready === false} onClick={() => save(false)} className="rounded-xl bg-[#0a1628] px-5 py-3 text-sm font-bold text-white disabled:opacity-40">Salva risultato</button>
            {(dirty || detailsDirty) && <button type="button" disabled={saving} onClick={() => { setDrafts((previous) => { const next = { ...previous }; delete next[identity]; return next; }); setDetailDrafts((previous) => { const next = { ...previous }; delete next[identity]; return next; }); setError(""); }} className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600">Annulla modifiche</button>}
          </div>
          <p className="text-xs leading-5 text-slate-500">Nessun salvataggio mentre digiti. Puoi correggere un risultato selezionando nuovamente la partita.</p>
          {saved && onClear && <details className="border-t border-slate-100 pt-3"><summary className="cursor-pointer text-xs font-semibold text-slate-500">Rimuovi un risultato inserito per errore</summary><button type="button" disabled={saving || disabled} onClick={clear} className="mt-3 rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-40">Rimuovi risultato salvato</button></details>}
        </div>
      </form>
    </div>
  </section>;
}
