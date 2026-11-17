"use client";

import { useState } from "react";
import Link from "next/link";
import StaffHeader from "@/app/components/StaffHeader";
import TourJourney from "@/app/components/TourJourney";
import TourStandings from "@/app/components/TourStandings";
import { getTourOverview, isTourPublished, tourHref } from "@/app/utils/tour-view";
import { getTornei, getIscrizioni, saveTornei } from "@/app/utils/db";
import { circuitAthleteKey, findCircuitAthlete, getCircuitFinalists, getRegistrationPlayers, GIALLO_CIRCUIT_POINT_TABLE, isGialloCircuitEvent, normalizeCircuitName } from "@/app/utils/circuit";

const buttonClass = "rounded-xl bg-[#0a1628] px-4 py-3 text-sm font-bold text-white disabled:opacity-40";

export default function GialloTourManagement({ tournaments, registrations, selectedCircuit, circuits, onSelect, onRefresh, refreshing = false }) {
  const [view, setView] = useState("overview");
  const [table, setTable] = useState({ ...GIALLO_CIRCUIT_POINT_TABLE });
  const [selections, setSelections] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const sameTour = (t) => normalizeCircuitName(t.circuitName) === normalizeCircuitName(selectedCircuit);
  const stages = tournaments.filter((t) => sameTour(t) && t.circuitRole === "tappa");
  const finals = tournaments.filter((t) => sameTour(t) && t.circuitRole === "finale");
  const primary = finals[0] || { categoria: "Giallo", circuitName: selectedCircuit, circuitQualifiers: 16 };
  const ranking = getCircuitFinalists(tournaments, registrations, primary);
  const overview = getTourOverview(tournaments, registrations, selectedCircuit);
  const published = isTourPublished(tournaments, selectedCircuit);
  const changePublication = async () => {
    if (!published && !window.confirm("Pubblicare il tour? Calendario, nomi degli atleti, punti e stato di qualificazione saranno visibili nella pagina pubblica. Email, account e comandi dello staff resteranno esclusi.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const latest = await getTornei();
      if (!latest.some((t) => sameTour(t) && isGialloCircuitEvent(t))) throw new Error("Tour non trovato. Aggiorna i dati.");
      await saveTornei(latest.map((t) => sameTour(t) && ["tappa", "finale"].includes(t.circuitRole) ? { ...t, circuitPublic: !published } : t));
      setMessage(published ? "Tour nascosto al pubblico." : "Tour pubblicato. Le impostazioni di visibilità di gironi e tabelloni non sono cambiate."); onRefresh();
    } catch (reason) { setError(reason.message || "Aggiornamento della visibilità non riuscito."); }
    finally { setBusy(false); }
  };
  const createHref = (role) => `/staff/tornei/nuovo?${new URLSearchParams({ tour: selectedCircuit, ruolo: role, categoria: "Giallo", nome: role === "finale" ? `${selectedCircuit} · Finale` : `${selectedCircuit} · Tappa ${stages.length + 1}` })}`;
  const savePoints = async () => {
    if (!window.confirm("Applicare questa scala a tutte le tappe del tour e alla finale? Anche i punti delle tappe già concluse saranno ricalcolati. I piazzamenti non cambiano.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      if (Object.values(table).some((n) => !Number.isSafeInteger(Number(n)) || Number(n) < 0)) throw new Error("Usa punti interi maggiori o uguali a zero per tutti i 24 posti.");
      for (let i = 1; i < 24; i++) if (Number(table[i]) < Number(table[i + 1])) throw new Error("Un piazzamento migliore non può assegnare meno punti del successivo.");
      const [latest, entries] = await Promise.all([getTornei(), getIscrizioni()]);
      const updated = latest.map((t) => sameTour(t) && isGialloCircuitEvent(t) && ["tappa", "finale"].includes(t.circuitRole) ? {
        ...t, circuitPointTable: Object.fromEntries(Object.entries(table).map(([k, v]) => [k, Number(v)])),
        ...(t.circuitRole === "finale" ? { circuitQualifiers: 16, maxSquadre: 16 } : {}),
      } : t);
      checkExistingFinalists(updated, entries);
      await saveTornei(updated); setMessage("Scala punti salvata per tutte le tappe del tour. Classifica ricalcolata."); onRefresh();
    } catch (reason) { setError(reason.message || "Salvataggio non riuscito."); }
    finally { setBusy(false); }
  };
  const checkExistingFinalists = (next, entries) => {
    for (const final of next.filter((t) => sameTour(t) && t.circuitRole === "finale")) {
      const data = getCircuitFinalists(next, entries, final);
      const enrolled = entries.filter((r) => normalizeCircuitName(r.torneo) === normalizeCircuitName(final.nome) && r.stato !== "Annullata");
      if (enrolled.some((r) => getRegistrationPlayers(r).some((a) => !findCircuitAthlete(data.athletes, a.userId, a.email)?.qualificato))) throw new Error("La modifica cambierebbe la qualificazione di atleti già iscritti alla finale. Verifica prima queste iscrizioni con lo staff: nessuno verrà escluso automaticamente.");
    }
  };
  const savePlayoff = async (final, shown) => {
    const keys = selections[String(final.id)] || (shown.playoff.resolved ? final.circuitPlayoffDecision?.athleteKeys : []) || [];
    setBusy(true); setError(""); setMessage("");
    try {
      const [latest, entries] = await Promise.all([getTornei(), getIscrizioni()]);
      const current = latest.find((t) => String(t.id) === String(final.id));
      if (!current) throw new Error("Finale non trovata. Aggiorna il tour.");
      const fresh = getCircuitFinalists(latest, entries, current);
      if (!fresh.ready || fresh.playoff.fingerprint !== shown.playoff.fingerprint) throw new Error("La classifica è cambiata. Aggiorna il tour prima di confermare lo spareggio.");
      if (new Set(keys).size !== fresh.playoff.places || keys.length !== fresh.playoff.places || keys.some((key) => !fresh.playoff.athletes.some((a) => circuitAthleteKey(a) === key))) throw new Error(`Seleziona esattamente ${fresh.playoff.places} vincitori tra gli atleti a pari merito.`);
      const updated = latest.map((t) => String(t.id) === String(final.id) ? { ...t, circuitPlayoffDecision: { fingerprint: fresh.playoff.fingerprint, athleteKeys: keys }, circuitQualifiers: 16 } : t);
      checkExistingFinalists(updated, entries);
      await saveTornei(updated); setMessage("Esito dello spareggio salvato. I qualificati sono aggiornati."); onRefresh();
    } catch (reason) { setError(reason.message || "Salvataggio non riuscito."); }
    finally { setBusy(false); }
  };

  return <main className="min-h-screen bg-[#f5f7fa] pb-20 text-[#0a1628]">
    <StaffHeader />
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-8 sm:px-6" inert={refreshing || busy || undefined} aria-busy={refreshing || busy}>
      <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-slate-500">3 tappe + finale</p><h1 className="mt-2 text-3xl font-black">Gestione tour giallo</h1><p className="mt-2 text-sm text-slate-500">Un solo posto per calendario, punti, classifica individuale e qualificati.</p></div><button type="button" disabled={busy} onClick={onRefresh} className="rounded-xl border bg-white px-4 py-3 text-sm font-bold">Aggiorna dati</button></header>
      <label className="block max-w-md text-sm font-bold">Tour<select value={selectedCircuit} disabled={busy} onChange={(e) => onSelect(e.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3">{circuits.map((name) => <option key={name}>{name}</option>)}</select></label>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-800">{message}</p>}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5" aria-label="Pubblicazione del tour"><div><p className="font-bold">{published ? "Tour visibile al pubblico" : "Tour non pubblicato"}</p><p className="mt-1 text-sm text-slate-500">La pagina del tour è separata dalla pubblicazione di gironi e tabelloni delle singole tappe.</p></div><div className="flex flex-wrap gap-3">{published && <Link href={tourHref(selectedCircuit)} className="rounded-xl border px-4 py-3 text-sm font-bold">Apri pagina pubblica ↗</Link>}<button type="button" disabled={busy} onClick={changePublication} className={buttonClass}>{published ? "Nascondi tour" : "Pubblica tour"}</button></div></section>
      <nav aria-label="Gestione tour" className="flex flex-wrap gap-2">{[{ id: "overview", label: "Panoramica" }, { id: "stages", label: "Tappe" }, { id: "rules", label: "Regole e punti" }, { id: "ranking", label: "Classifica" }, { id: "final", label: "Finale e qualificati" }].map((tab) => <button type="button" key={tab.id} disabled={busy} aria-pressed={view === tab.id} onClick={() => setView(tab.id)} className={`rounded-xl border px-4 py-3 text-sm font-bold ${view === tab.id ? "border-[#0a1628] bg-[#0a1628] text-white" : "border-slate-200 bg-white"}`}>{tab.label}</button>)}</nav>
      <section hidden={view !== "overview"} aria-label="Panoramica del tour" className="space-y-5">
        <div className="rounded-2xl bg-[#0a1628] p-6 text-white sm:p-8"><p className="text-xs font-bold uppercase tracking-widest text-yellow-300">{overview.status}</p><h2 className="mt-3 text-2xl font-black">{selectedCircuit}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Tre tappe per qualificarsi, una finale per il titolo. Contano i migliori due risultati; la finale parte da zero.</p><div className="mt-5">{overview.action.href ? <Link href={overview.action.href} className="inline-block rounded-xl bg-[#FFD700] px-5 py-3 text-sm font-bold text-[#0a1628]">{overview.action.label} →</Link> : <button type="button" onClick={() => setView(overview.action.view)} className="rounded-xl bg-[#FFD700] px-5 py-3 text-sm font-bold text-[#0a1628]">{overview.action.label} →</button>}</div></div>
        <div className="grid gap-3 sm:grid-cols-3">{[{ label: "Tappe concluse", value: `${overview.completed}/3` }, { label: "Atleti in classifica", value: overview.athleteCount }, { label: "Qualificati confermati", value: `${overview.qualifiedCount}/16` }].map((item) => <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-black">{item.value}</p></div>)}</div>
        <TourJourney stages={overview.stages} finals={overview.finals} staff />
        {overview.warnings.length > 0 && <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><h3 className="font-bold text-amber-900">Da completare</h3><ul className="mt-3 list-inside list-disc space-y-2 text-sm text-amber-900">{overview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>}
      </section>
      <section hidden={view !== "stages"} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">Calendario delle tappe</h2>{stages.length < 3 && <Link href={createHref("tappa")} className={buttonClass}>Aggiungi tappa {stages.length + 1}</Link>}</div>
        {stages.length !== 3 && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Il tour prevede esattamente 3 tappe di qualificazione: attualmente ne risultano {stages.length}. La qualificazione definitiva rimane sospesa finché il calendario e i piazzamenti non sono completi.</p>}
        {stages.map((t, i) => <article key={t.id} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold text-slate-500">Tappa {i + 1} · {t.stato}</p><h3 className="mt-2 text-lg font-bold">{t.nome}</h3><p className="mt-2 text-sm text-slate-500">{[t.data, t.location].filter(Boolean).join(" · ")}</p><div className="mt-4 flex flex-wrap gap-3"><Link href={`/staff/gestione-torneo?${new URLSearchParams({ tipo: "giallo", tour: t.nome })}`} className={buttonClass}>Gestisci torneo</Link><Link href={`/staff/tornei/modifica/${t.id}`} className="rounded-xl border px-4 py-3 text-sm font-bold">Modifica tappa</Link></div></article>)}
      </section>
      <section hidden={view !== "rules"} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
        <h2 className="text-xl font-bold">Regolamento del tour</h2><p className="text-sm leading-6 text-slate-600">Si sommano i migliori 2 risultati delle 3 tappe. Per qualificarsi servono almeno 2 tappe concluse con piazzamento assegnato. A parità: maggior numero di tappe, poi miglior risultato singolo conteggiato. Se la parità attraversa il limite dei 16 posti, serve uno spareggio: nessuna precedenza alfabetica. La finale non aggiunge punti alla classifica di qualificazione e parte da zero.</p>
        <h3 className="font-bold">Scala punti per 24 atleti</h3><p className="text-sm text-slate-500">Questa è la nuova scala concordata. Le tabelle già salvate nelle tappe restano invariate finché non premi Applica; applicandola vengono ricalcolati anche i risultati delle tappe concluse.</p>
        <fieldset disabled={busy} className="grid grid-cols-3 gap-3 sm:grid-cols-6">{Array.from({ length: 24 }, (_, i) => i + 1).map((place) => <label key={place} className="rounded-xl bg-slate-50 p-3 text-xs font-bold">{place}° posto<input type="number" min="0" step="1" aria-label={`Punti tour ${place}° posto`} value={table[place]} onChange={(e) => setTable((old) => ({ ...old, [place]: e.target.value }))} className="mt-2 w-full rounded-lg border bg-white p-2 text-base" /></label>)}</fieldset>
        <button type="button" disabled={busy} onClick={savePoints} className={buttonClass}>{busy ? "Salvataggio…" : "Applica scala a tutto il tour"}</button>
      </section>
      <section hidden={view !== "ranking"}><TourStandings athletes={ranking.athletes} stages={overview.stages} /></section>
      <section hidden={view !== "final"} className="space-y-4">
        <h2 className="text-xl font-bold">Quarta tappa · Finale a 16</h2>
        {!finals.length && <div className="rounded-2xl border bg-white p-5"><p className="mb-4 text-sm text-slate-600">La finale non è ancora collegata al tour.</p><Link href={createHref("finale")} className={buttonClass}>Crea la finale</Link></div>}
        {!ranking.ready && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Qualificazioni ancora provvisorie: occorrono esattamente 3 tappe gialle concluse e tutti i piazzamenti approvati. {ranking.missingPlacements.length > 0 && `Piazzamenti da completare: ${ranking.missingPlacements.join(", ")}.`}</p>}
        {ranking.ready && ranking.eligibleCount < 16 && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Solo {ranking.eligibleCount} atleti hanno almeno 2 tappe valide. I posti restanti non vengono assegnati automaticamente a chi ha una sola tappa: gli eventuali ripescaggi devono ancora essere concordati.</p>}
        {finals.length > 1 && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm">Ci sono più finali collegate: verifica quale mantenere per questo tour.</p>}
        {finals.map((final) => {
          const data = getCircuitFinalists(tournaments, registrations, final);
          const toReview = registrations.filter((r) => normalizeCircuitName(r.torneo) === normalizeCircuitName(final.nome) && r.stato !== "Annullata" && getRegistrationPlayers(r).some((a) => !findCircuitAthlete(data.athletes, a.userId, a.email)?.qualificato));
          const selected = selections[String(final.id)] || (data.playoff.resolved ? final.circuitPlayoffDecision?.athleteKeys : []) || [];
          return <article key={final.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-lg font-bold">{final.nome}</h3><p className="text-sm text-slate-500">16 posti · almeno 2 tappe · finale con punteggio iniziale azzerato</p><div className="flex flex-wrap gap-3"><Link href={`/staff/gestione-torneo?${new URLSearchParams({ tipo: "giallo", tour: final.nome })}`} className={buttonClass}>Gestisci la finale</Link><Link href={`/staff/tornei/modifica/${final.id}`} className="rounded-xl border px-4 py-3 text-sm font-bold">Modifica evento finale</Link></div>
            <p className="text-sm font-bold">Qualificati confermati: {data.athletes.filter((a) => a.qualificato).length}/16</p>
            {toReview.length > 0 && <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Ci sono {toReview.length} iscrizioni alla finale da verificare rispetto alla classifica attuale. Nessuna iscrizione esistente è stata annullata automaticamente.</p>}
            <ol className="grid list-inside list-decimal gap-2 text-sm sm:grid-cols-2">{data.athletes.filter((a) => a.qualificato).map((a) => <li key={circuitAthleteKey(a)}>{a.nome} · {a.punti} punti</li>)}</ol>
            {data.playoff.athletes.length > 0 && <fieldset disabled={busy || !data.ready} className="space-y-3 rounded-xl bg-amber-50 p-4"><legend className="font-bold">{data.playoff.resolved ? "Esito spareggio confermato" : "Spareggio al limite dei posti"}</legend><p className="text-sm">{data.playoff.athletes.length} atleti a pari merito per {data.playoff.places} posti. Dopo aver disputato lo spareggio, seleziona esattamente {data.playoff.places} vincitori.</p>{data.playoff.athletes.map((a) => { const key = circuitAthleteKey(a); return <label key={key} className="flex items-center gap-3 text-sm"><input type="checkbox" checked={selected.includes(key)} onChange={(e) => setSelections((old) => ({ ...old, [String(final.id)]: e.target.checked ? [...selected, key] : selected.filter((id) => id !== key) }))} />{a.nome}</label>; })}<button type="button" disabled={selected.length !== data.playoff.places} onClick={() => savePlayoff(final, data)} className={buttonClass}>Conferma esito dello spareggio</button></fieldset>}
          </article>;
        })}
      </section>
    </div>
  </main>;
}
