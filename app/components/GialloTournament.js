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
    <p className="mb-3 text-xs font-bold text-gray-500">{game.id}</p>
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

function GialloPanel({ tournament, editable }) {
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
    } catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  };

  const generate = async () => {
    if (config && !window.confirm("Rigenerare i gironi? Tutti i risultati e il tabellone giallo attuale verranno cancellati. Nessun altro torneo sarà modificato.")) return;
    setBusy(true); setError("");
    try {
      const current = approvedGialloAthletes(await readData("iscrizioni"), tournament.nome);
      setAthletes(current);
      await persist(createGiallo(current));
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

  return <div className="space-y-6 text-[#0a1628]">
    <div className="rounded-2xl bg-yellow-100 p-5">
      <h2 className="text-2xl font-black">Giallo · {tournament.nome}</h2>
      <p className="mt-2">Gironi da 4: tre partite a testa, ogni atleta gioca con tutti e contro tutti nel proprio girone. Set unico a 21 con due punti di vantaggio.</p>
      <p className="mt-2">Classifica individuale: vittorie, quoziente punti, differenza punti, punti fatti. A parità completa vale l’ordine del sorteggio iniziale.</p>
      <p className="mt-2">Coppie libere: migliore + peggiore disponibile secondo la classifica dei gironi, evitando di ripetere i compagni della fase finale. Dalle semifinali le coppie restano fisse.</p>
    </div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-green-50 p-4 text-green-800">{message}</p>}
    {editable && <div className="space-y-3 rounded-2xl border bg-white p-5">
      <p><strong>{athletes.length} atleti approvati</strong> · {supportedGialloCount(athletes.length) ? `${athletes.length / 4} gironi da 4` : "Numero non supportato: servono 12, 16, 20 o 24. Nessuno viene escluso."}</p>
      {changed && <p className="text-amber-800">Gli approvati differiscono dal sorteggio salvato. I gironi non vengono cambiati automaticamente: verifica gli iscritti prima di rigenerare.</p>}
      <div className="flex flex-wrap gap-3">
        <button className={buttonClass} disabled={busy} onClick={() => {
          if (!window.confirm("Aggiornare dal server? Eventuali punteggi digitati ma non salvati andranno persi.")) return;
          setMessage(""); setLoading(true); setReload((n) => n + 1);
        }}>Aggiorna dati dal server</button>
        <button className={buttonClass} disabled={disabled} onClick={generate}>{config ? "Rigenera gironi e azzera risultati" : "Genera gironi dagli approvati"}</button>
        {config && <button className={buttonClass} disabled={disabled} onClick={() => persist({ ...config, published: !config.published })}>
          {config.published ? "Nascondi al pubblico" : "Pubblica gironi e tabellone"}
        </button>}
      </div>
      <p className="text-sm text-gray-600">Ogni risultato viene salvato solo premendo il relativo pulsante. La rigenerazione richiede conferma e azzera anche le finali. {config && (config.published ? "Torneo pubblicato." : "Bozza non pubblicata.")}</p>
    </div>}
    {!config && <p className="rounded-xl bg-white p-5">Gironi e tabellone giallo non ancora {editable ? "generati" : "pubblicati"}.</p>}
    {config && <>
      <p className="font-bold">{count} atleti · {config.groups.length} gironi · {config.groups.length * 3} partite nei gironi
        {playoffCount > 0 ? ` · primi ${count - playoffCount} direttamente ${target === 16 ? "ai quarti" : "alle semifinali"}, altri ${playoffCount} agli spareggi` : " · tutti ai quarti"}.
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        {config.groups.map((group) => <section key={group.id} className="space-y-3 rounded-2xl bg-slate-100 p-4">
          <h3 className="text-xl font-black">Girone {group.id}</h3>
          <p className="text-sm">{group.athletes.map((a) => a.name).join(" · ")}</p>
          {groupGames(group).map((game) => <Match key={`${game.id}-${JSON.stringify(config.results[game.id])}`} game={game} score={config.results[game.id]} editable={editable} busy={disabled} onScore={recordScore} />)}
        </section>)}
      </div>
      <section className="overflow-x-auto rounded-2xl border bg-white p-4">
        <h3 className="mb-4 text-xl font-black">Classifica unica individuale {groupsComplete(config) ? "· completa" : "· provvisoria"}</h3>
        <table className="w-full text-left text-sm"><thead><tr>{["#", "Atleta", "Girone", "Giocate", "Vittorie", "PF", "PS", "Quoz."].map((label) => <th key={label} className="p-2">{label}</th>)}</tr></thead>
          <tbody>{ranking.map((a, i) => <tr key={a.id} className="border-t"><td className="p-2">{i + 1}</td><td className="p-2 font-bold">{a.name}</td><td className="p-2">{a.group}</td><td className="p-2">{a.played}</td><td className="p-2">{a.wins}</td><td className="p-2">{a.pf}</td><td className="p-2">{a.ps}</td><td className="p-2">{a.ps ? (a.pf / a.ps).toFixed(3) : a.pf ? "∞" : "—"}</td></tr>)}</tbody>
        </table>
      </section>
      <section className="space-y-5 rounded-2xl bg-yellow-50 p-5">
        <h3 className="text-2xl font-black">Tabellone a eliminazione diretta</h3>
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

export default function GialloTournament({ tournament, editable = false, tournaments, onSelect }) {
  return <section className="mx-auto max-w-7xl space-y-5 px-4 py-8">
    {tournaments && <label className="block font-bold">Torneo
      <select className="ml-3 max-w-full rounded-xl border bg-white p-3" value={tournament.nome} onChange={(event) => onSelect(event.target.value)}>
        {tournaments.map((t) => <option key={t.id || t.nome} value={t.nome}>{t.nome}</option>)}
      </select>
    </label>}
    <GialloPanel key={`${tournament.nome}-${editable}`} tournament={tournament} editable={editable} />
  </section>;
}
