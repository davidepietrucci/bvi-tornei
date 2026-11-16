"use client";

import { useEffect, useState } from "react";
import {
  approvedGialloAthletes, createGiallo, gialloRanking, gialloSlug, gialloStages,
  groupGames, groupsComplete, setGialloScore, startGialloFinals, supportedGialloCount,
} from "@/app/utils/giallo";

const buttonClass = "rounded-xl bg-[#0a1628] px-4 py-3 text-sm font-bold text-white disabled:opacity-40";

async function readData(type, slug) {
  const params = new URLSearchParams({ type });
  if (slug) params.set("slug", slug);
  if (type === "iscrizioni") params.set("public", "true");
  const response = await fetch(`/api/db?${params}`, { cache: "no-store" });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || "Caricamento non riuscito. Riprova.");
  return json.data;
}

function Match({ game, score, editable, busy, onScore }) {
  const [left, setLeft] = useState(score?.[0] ?? "");
  const [right, setRight] = useState(score?.[1] ?? "");
  return <form className="rounded-xl border border-gray-200 bg-white p-4" onSubmit={(event) => {
    event.preventDefault();
    if (left === "" || right === "") return;
    onScore(game.id, [Number(left), Number(right)]);
  }}>
    <p className="mb-3 text-xs font-bold text-gray-500">Partita {Number(game.id.split("-").at(-1)) + 1} · Set unico a 21</p>
    {[game.left, game.right].map((pair, side) => <div key={side} className="my-2 flex items-center justify-between gap-3">
      <span className="font-semibold">{pair.map((athlete) => athlete.name).join(" + ")}</span>
      {editable ? <input aria-label={`Punti ${side === 0 ? "prima" : "seconda"} coppia ${game.id}`} type="number" min="0" step="1" required
        className="w-20 rounded-lg border p-2 text-center" value={side === 0 ? left : right} disabled={busy}
        onChange={(event) => (side === 0 ? setLeft : setRight)(event.target.value)} />
        : <span className="text-xl font-black">{score?.[side] ?? "—"}</span>}
    </div>)}
    {editable && <div className="mt-4 flex gap-2">
      <button disabled={busy || left === "" || right === ""} className={buttonClass}>Salva risultato</button>
      {score && <button type="button" disabled={busy} className="rounded-lg border px-3 text-sm" onClick={() => onScore(game.id, null)}>Cancella risultato</button>}
    </div>}
  </form>;
}

function GialloPanel({ tournament, editable, workflowView, onWorkflowViewChange, onSummary }) {
  const [internalView, setInternalView] = useState("prepare");
  const view = workflowView ?? internalView;
  const setView = onWorkflowViewChange || setInternalView;
  const [activeGroup, setActiveGroup] = useState("A");
  const [config, setConfig] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const [conflict, setConflict] = useState(false);
  const slug = gialloSlug(tournament.nome);
  useEffect(() => {
    onSummary?.({ groupsPublished: Boolean(config?.published), finalsPublished: Boolean(config?.published),
      busy: loading || busy, groupCount: config?.groups.length || 0, approvedCount: athletes.length });
  }, [onSummary, config, loading, busy, athletes.length]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [data, registrations] = await Promise.all([
          readData("giallo", slug), editable ? readData("iscrizioni") : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setConfig(editable || data?.published ? data : null);
        if (registrations) setAthletes(approvedGialloAthletes(registrations, tournament.nome));
        setError(""); setConflict(false);
      } catch (reason) {
        if (!cancelled) setError(reason.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    // Never poll editable state: it could erase a score being entered by staff.
    const timer = editable ? null : setInterval(load, 10000);
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [slug, tournament.nome, editable, reload]);

  const persist = async (next) => {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/db", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "giallo", slug, data: next, baseline: config }),
      });
      const json = await response.json();
      if (!response.ok) {
        if (response.status === 409) setConflict(true);
        throw new Error(json.error || "Salvataggio non riuscito.");
      }
      setConfig(next); setMessage("Salvato sul server.");
      return true;
    } catch (reason) { setError(reason.message); return false; }
    finally { setBusy(false); }
  };

  const generate = async () => {
    if (config && !window.confirm("Rigenerare i gironi? Tutti i risultati e il tabellone giallo attuale verranno cancellati. Nessun altro torneo sarà modificato.")) return;
    setBusy(true); setError("");
    try {
      const current = approvedGialloAthletes(await readData("iscrizioni"), tournament.nome);
      setAthletes(current);
      if (await persist(createGiallo(current))) { setActiveGroup("A"); setView("groups"); }
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  };

  const recordScore = (id, score) => {
    if (JSON.stringify(config.results[id] ?? config.finals?.results[id] ?? null) === JSON.stringify(score)) return;
    const isGroup = id.startsWith("group-");
    if ((isGroup && config.finals || !isGroup && Object.keys(config.finals?.results || {}).length > 0) &&
      !window.confirm(isGroup ? "La modifica annullerà il tabellone finale e i suoi risultati. Continuare?"
        : "La modifica cancellerà i risultati dei turni successivi, che saranno ricalcolati. Continuare?")) return;
    try { persist(setGialloScore(config, id, score)); } catch (reason) { setError(reason.message); }
  };

  if (loading) return <p className="p-6" role="status">Caricamento torneo giallo…</p>;
  const ranking = gialloRanking(config);
  const stages = gialloStages(config);
  const count = ranking.length;
  const generatedIds = ranking.map((a) => a.id).sort().join(",");
  const currentIds = athletes.map((a) => a.id).sort().join(",");
  const changed = editable && config && generatedIds !== currentIds;
  const disabled = busy || conflict;
  const target = count ? 2 ** Math.floor(Math.log2(count)) : 0;
  const playoffCount = 2 * (count - target);
  const completedGames = config ? Object.keys(config.results).length : 0;
  const groupGameCount = config ? config.groups.length * 3 : 0;
  const show = (stage) => !editable || view === stage;

  return <div className="space-y-6 text-[#0a1628]">
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-widest text-slate-500">{editable ? "Percorso guidato" : "Torneo giallo"}</p><h2 className="mt-2 text-2xl font-black">{tournament.nome}</h2></div>
        <span className={`rounded-full px-3 py-2 text-xs font-bold ${config?.published ? "bg-green-50 text-green-800" : "bg-slate-100 text-slate-600"}`}>{config?.published ? "Visibile al pubblico" : "Bozza"}</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[{ label: editable ? "Atleti approvati" : "Atleti", value: editable ? athletes.length : count },
          { label: "Gironi da 4", value: config?.groups.length ?? (supportedGialloCount(athletes.length) ? athletes.length / 4 : "—") },
          { label: "Risultati dei gironi", value: `${completedGames} / ${groupGameCount}` },
          { label: "Formato", value: "1 set a 21" }].map((stat) => <div key={stat.label} className="rounded-xl bg-slate-50 p-3"><span className="block text-xs text-slate-500">{stat.label}</span><strong className="mt-1 block text-lg">{stat.value}</strong></div>)}
      </div>
      <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold text-slate-600">Come funziona questa formula?</summary>
        <div className="mt-3 space-y-2 leading-6 text-slate-600">
          <p>Gironi da 4: tre partite a testa, ogni atleta gioca con tutti e contro tutti nel proprio girone. Set unico a 21 con due punti di vantaggio.</p>
          <p>Classifica individuale: vittorie, quoziente punti, differenza punti, punti fatti. A parità completa vale l’ordine del sorteggio iniziale.</p>
          <p>Coppie libere: migliore + peggiore disponibile secondo la classifica dei gironi, evitando di ripetere i compagni della fase finale. Dalle semifinali le coppie restano fisse.</p>
        </div>
      </details>
    </div>
    {editable && workflowView === undefined && <nav aria-label="Passaggi del torneo giallo" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {[{ id: "prepare", label: "Prepara i gironi", detail: "Controlla atleti e formula" },
        { id: "groups", label: "Gioca i gironi", detail: "Inserisci i risultati" },
        { id: "ranking", label: "Controlla la classifica", detail: "Verifica le qualificazioni" },
        { id: "finals", label: "Crea il tabellone", detail: "Gestisci la fase finale" }].map((step, i) => <button key={step.id} type="button" disabled={busy || (step.id !== "prepare" && !config)} aria-current={view === step.id ? "step" : undefined}
          onClick={() => setView(step.id)} className={`flex items-start gap-3 rounded-xl border p-4 text-left disabled:opacity-40 ${view === step.id ? "border-[#0a1628] bg-[#0a1628] text-white" : "border-slate-200 bg-white"}`}>
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${view === step.id ? "bg-yellow-300 text-[#0a1628]" : "bg-slate-100"}`}>{i + 1}</span>
          <span><strong className="block text-sm">{step.label}</strong><span className={`mt-1 block text-xs ${view === step.id ? "text-slate-300" : "text-slate-500"}`}>{step.detail}</span></span>
        </button>)}
    </nav>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-green-50 p-4 text-green-800">{message}</p>}
    {editable && <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">I risultati si salvano dal pulsante della singola partita. La pubblicazione è una scelta separata.</p>
        <div className="flex flex-wrap gap-2">
          {config && <button className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-40" disabled={disabled} onClick={() => persist({ ...config, published: !config.published })}>{config.published ? "Nascondi al pubblico" : "Pubblica torneo"}</button>}
          <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 disabled:opacity-40" disabled={busy} onClick={() => {
            if (!window.confirm("Aggiornare dal server? Eventuali punteggi digitati ma non salvati andranno persi.")) return;
            setMessage(""); setLoading(true); setReload((n) => n + 1);
          }}>Aggiorna dati</button>
        </div>
      </div>
      <div hidden={!show("prepare")} className="space-y-4 border-t border-slate-100 pt-5">
      <div><h3 className="text-xl font-bold">1. Controlla i partecipanti</h3><p className="mt-2 text-sm leading-6 text-slate-500">Vengono utilizzate soltanto le iscrizioni approvate. Il numero di gironi viene calcolato automaticamente, senza escludere nessuno.</p></div>
      <p><strong>{athletes.length} atleti approvati</strong> · {supportedGialloCount(athletes.length) ? `${athletes.length / 4} gironi da 4` : "Numero non supportato: servono 12, 16, 20 o 24. Nessuno viene escluso."}</p>
      {changed && <p className="text-amber-800">Gli approvati differiscono dal sorteggio salvato. I gironi non vengono cambiati automaticamente: verifica gli iscritti prima di rigenerare.</p>}
      {athletes.length > 0 && <details className="rounded-xl bg-slate-50 p-4"><summary className="cursor-pointer text-sm font-semibold">Vedi i {athletes.length} partecipanti approvati</summary><ol className="mt-3 grid list-inside list-decimal gap-2 text-sm sm:grid-cols-2">{athletes.map((a) => <li key={a.id}>{a.name}</li>)}</ol></details>}
      {!config ? <button className={buttonClass} disabled={disabled || !supportedGialloCount(athletes.length)} onClick={generate}>Genera {supportedGialloCount(athletes.length) ? athletes.length / 4 : ""} gironi da 4</button>
        : <><p className="rounded-xl bg-green-50 p-4 text-sm text-green-800">I gironi sono già salvati. Puoi passare ai risultati senza ripetere il sorteggio.</p><button className={buttonClass} onClick={() => setView("groups")}>Vai ai risultati dei gironi →</button>
          <details className="pt-3"><summary className="cursor-pointer text-sm font-semibold text-slate-600">Modifica il sorteggio · azzera risultati</summary><p className="my-3 text-sm text-slate-500">Rigenerare cancella tutti i risultati e il tabellone giallo. L’operazione richiede conferma.</p><button className="rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-700 disabled:opacity-40" disabled={disabled || !supportedGialloCount(athletes.length)} onClick={generate}>Rigenera gironi e azzera risultati</button></details></>}
      </div>
    </div>}
    {!config && <p className="rounded-xl bg-white p-5">Gironi e tabellone giallo non ancora {editable ? "generati" : "pubblicati"}.</p>}
    {config && <>
      <p hidden={editable && view === "prepare"} className="rounded-xl bg-slate-100 p-4 text-sm leading-6">{count} atleti · {config.groups.length} gironi · {config.groups.length * 3} partite nei gironi
        {playoffCount > 0 ? ` · primi ${count - playoffCount} direttamente ${target === 16 ? "ai quarti" : "alle semifinali"}, altri ${playoffCount} agli spareggi` : " · tutti ai quarti"}.
      </p>
      <div hidden={!show("groups")} className="space-y-5">
        {editable && <><div><h3 className="text-xl font-bold">2. Inserisci i risultati dei gironi</h3><p className="mt-2 text-sm text-slate-500">Scegli un girone e salva il punteggio di ogni partita. Ogni atleta gioca tre volte.</p></div>
          <nav aria-label="Girone da gestire" className="flex flex-wrap gap-2">{config.groups.map((g) => <button key={g.id} type="button" aria-pressed={activeGroup === g.id} onClick={() => setActiveGroup(g.id)} className={`rounded-xl border px-4 py-3 text-sm font-bold ${activeGroup === g.id ? "border-[#0a1628] bg-[#0a1628] text-white" : "border-slate-200 bg-white"}`}>Girone {g.id}</button>)}</nav></>}
      <div className={editable ? "space-y-5" : "grid gap-5 lg:grid-cols-2"}>
        {config.groups.map((group) => <section hidden={editable && activeGroup !== group.id} key={group.id} className="space-y-3 rounded-2xl bg-slate-100 p-4">
          <h3 className="text-xl font-black">Girone {group.id}</h3>
          <p className="text-sm">{group.athletes.map((a) => a.name).join(" · ")}</p>
          {groupGames(group).map((game) => <Match key={`${game.id}-${JSON.stringify(config.results[game.id])}`} game={game} score={config.results[game.id]} editable={editable} busy={disabled} onScore={recordScore} />)}
        </section>)}
      </div>
      {editable && <button className={buttonClass} onClick={() => setView("ranking")}>Controlla la classifica →</button>}
      </div>
      <section hidden={!show("ranking")} className="overflow-x-auto rounded-2xl border bg-white p-4 sm:p-6">
        {editable && <p className="mb-4 text-sm leading-6 text-slate-500">3. Controlla la classifica. {groupsComplete(config) ? "Tutti i risultati sono completi: puoi preparare il tabellone." : `Mancano ${groupGameCount - completedGames} risultati prima di poter generare il tabellone.`}</p>}
        <h3 className="mb-4 text-xl font-black">Classifica unica individuale {groupsComplete(config) ? "· completa" : "· provvisoria"}</h3>
        <table className="w-full text-left text-sm"><thead><tr>{["#", "Atleta", "Girone", "Giocate", "Vittorie", "PF", "PS", "Quoz."].map((label) => <th key={label} className="p-2">{label}</th>)}</tr></thead>
          <tbody>{ranking.map((a, i) => <tr key={a.id} className="border-t"><td className="p-2">{i + 1}</td><td className="p-2 font-bold">{a.name}</td><td className="p-2">{a.group}</td><td className="p-2">{a.played}</td><td className="p-2">{a.wins}</td><td className="p-2">{a.pf}</td><td className="p-2">{a.ps}</td><td className="p-2">{a.ps ? (a.pf / a.ps).toFixed(3) : a.pf ? "∞" : "—"}</td></tr>)}</tbody>
        </table>
        {editable && <button className={`${buttonClass} mt-5`} onClick={() => setView("finals")}>Vai al tabellone finale →</button>}
      </section>
      <section hidden={!show("finals")} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h3 className="text-2xl font-black">{editable ? "4. " : ""}Tabellone a eliminazione diretta</h3>
        {editable && <p className="text-sm leading-6 text-slate-500">Genera gli abbinamenti dalla classifica completa. Poi salva i risultati: i turni successivi compariranno solo quando tutti gli incontri precedenti sono conclusi.</p>}
        {editable && <button className={buttonClass} disabled={disabled || !groupsComplete(config)} onClick={() => {
          if (config.finals && !window.confirm("Rigenerare il tabellone cancellando tutti i risultati delle finali?")) return;
          try { persist(startGialloFinals(config)); } catch (reason) { setError(reason.message); }
        }}>{config.finals ? "Rigenera tabellone" : "Genera tabellone dalla classifica"}</button>}
        {!config.finals && <p>{groupsComplete(config) ? "Tabellone non ancora generato dallo staff." : "Prima occorre completare tutti i risultati dei gironi."}</p>}
        {stages.map((stage) => <section key={stage.id} className="space-y-3">
          <h4 className="text-xl font-bold">{stage.title}</h4>
          {stage.byes && <p className="text-sm">Qualificati direttamente: {stage.byes.map((a) => a.name).join(" · ")}</p>}
          <div className="grid gap-3 md:grid-cols-2">{stage.games.map((game) => <Match key={`${game.id}-${JSON.stringify(config.finals.results[game.id])}-${game.left.map((a) => a.id).join()}`} game={game} score={config.finals.results[game.id]} editable={editable} busy={disabled} onScore={recordScore} />)}</div>
        </section>)}
        {config.finals && <p className="text-sm text-gray-600">Il turno successivo appare solo dopo il completamento di tutte le partite del turno precedente. Le semifinali non sono precompilate.</p>}
        {config.finals?.results["final-0"] && <p className="text-lg font-black">Vincitori: {(() => {
          const final = stages.find((s) => s.id === "final").games[0];
          return (config.finals.results["final-0"][0] > config.finals.results["final-0"][1] ? final.left : final.right).map((a) => a.name).join(" + ");
        })()}</p>}
      </section>
    </>}
  </div>;
}

export default function GialloTournament({ tournament, editable = false, tournaments, onSelect, embedded = false, workflowView, onWorkflowViewChange, onSummary }) {
  return <section className={embedded ? "space-y-5" : "mx-auto max-w-7xl space-y-5 px-4 py-8"}>
    {tournaments && <label className="block font-bold">Torneo
      <select className="ml-3 max-w-full rounded-xl border bg-white p-3" value={tournament.nome} onChange={(event) => onSelect(event.target.value)}>
        {tournaments.map((t) => <option key={t.id || t.nome} value={t.nome}>{t.nome}</option>)}
      </select>
    </label>}
    <GialloPanel key={`${tournament.nome}-${editable}`} tournament={tournament} editable={editable} workflowView={workflowView} onWorkflowViewChange={onWorkflowViewChange} onSummary={onSummary} />
  </section>;
}
