"use client";

import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import StaffHeader from "@/app/components/StaffHeader";

const ENDPOINT = "/api/staff/notifiche";
const inputClass = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-[#0a1628] focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50";
const buttonClass = "rounded-xl bg-[#0a1628] px-4 py-3 text-sm font-bold text-white hover:bg-blue-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50";
const types = {
  info: { label: "Informazione", className: "bg-blue-50 text-blue-800" },
  avviso: { label: "Avviso", className: "bg-yellow-100 text-yellow-900" },
  urgente: { label: "Urgente", className: "bg-red-50 text-red-800" },
};

async function request(url, options = {}) {
  const response = await fetch(url, { cache: "no-store", ...options });
  let json;
  try {
    json = await response.json();
  } catch {
    throw new Error(`Risposta non valida dal server (HTTP ${response.status}).`);
  }
  if (!response.ok || !json || typeof json !== "object" || json.error || options.method === "POST" && json.success !== true) {
    throw new Error(typeof json?.error === "string" ? json.error : `Richiesta non riuscita (HTTP ${response.status}).`);
  }
  return json;
}

function audienceLabel(audience) {
  if (audience?.type === "all") return "Tutti gli atleti";
  if (audience?.type === "tournament") return `Torneo: ${audience.tournamentName || audience.label || "non specificato"}`;
  if (audience?.type === "athlete") return `Atleta: ${audience.label || audience.userId || "non specificato"}`;
  if (audience?.type === "registrations") return audience.label || `Iscrizioni${audience.tournamentName ? ` · ${audience.tournamentName}` : ""}`;
  return audience?.label || "Destinatari non specificati";
}

function formatDate(value) {
  if (!value) return "Data non disponibile";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data non disponibile" : date.toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" });
}

export default function StaffNotifichePage() {
  const { user, isLoaded } = useUser();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [pending, setPending] = useState("");
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [titolo, setTitolo] = useState("");
  const [messaggio, setMessaggio] = useState("");
  const [tipo, setTipo] = useState("info");
  const [audienceType, setAudienceType] = useState("all");
  const [tournamentId, setTournamentId] = useState("");
  const [athlete, setAthlete] = useState(null);
  const [query, setQuery] = useState("");
  const [athletes, setAthletes] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searched, setSearched] = useState(false);
  const [source, setSource] = useState("all");
  const [archived, setArchived] = useState("active");

  useEffect(() => {
    if (!isLoaded || !user) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError("");
    request(ENDPOINT, { signal: controller.signal })
      .then((json) => {
        if (!Array.isArray(json.data) || !Array.isArray(json.tournaments) || typeof json.settings?.automaticEnabled !== "boolean") {
          throw new Error("Dati notifiche non validi: impossibile aggiornare la pagina.");
        }
        if (!controller.signal.aborted) setSnapshot(json);
      })
      .catch((err) => { if (!controller.signal.aborted) setLoadError(err.message || "Caricamento non riuscito."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [isLoaded, user, reload]);

  useEffect(() => {
    const controller = new AbortController();
    setAthletes([]);
    setSearchError("");
    setSearched(false);
    setSearching(false);
    if (!user || audienceType !== "athlete" || athlete || query.trim().length < 3 || pending) return () => controller.abort();
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const json = await request(`${ENDPOINT}?${new URLSearchParams({ search: query.trim() })}`, { signal: controller.signal });
        if (!Array.isArray(json.athletes)) throw new Error("Risultati della ricerca non validi.");
        if (!controller.signal.aborted) { setAthletes(json.athletes); setSearched(true); }
      } catch (err) {
        if (!controller.signal.aborted) setSearchError(err.message || "Ricerca non riuscita.");
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, audienceType, athlete, user, pending]);

  const disabled = !isLoaded || !user || loading || !snapshot || Boolean(loadError) || Boolean(pending);

  async function save(payload, key, message, onSaved) {
    if (lock.current || disabled) return;
    lock.current = true;
    setPending(key);
    setError("");
    setSuccess("");
    try {
      await request(ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      onSaved?.();
      setSuccess(message);
      setReload((value) => value + 1);
    } catch (err) {
      setError(err.message || "Salvataggio non riuscito. Nessuna conferma ricevuta dal server.");
    } finally {
      lock.current = false;
      setPending("");
    }
  }

  function createNotification(event) {
    event.preventDefault();
    if (disabled || lock.current) return;
    setError("");
    setSuccess("");
    if (!titolo.trim() || titolo.length > 120 || !messaggio.trim() || messaggio.length > 2000) {
      setError("Inserisci titolo (massimo 120 caratteri) e messaggio (massimo 2000 caratteri).");
      return;
    }
    const tournament = snapshot.tournaments.find((item) => String(item.id) === tournamentId);
    if ((audienceType === "tournament" && !tournament) || (audienceType === "athlete" && !athlete?.id)) {
      setError("Seleziona un destinatario valido prima di creare la notifica.");
      return;
    }
    const target = audienceType === "all" ? "TUTTI GLI ATLETI del portale" : audienceType === "tournament" ? `gli atleti del torneo «${tournament.nome}»` : `l’atleta ${athlete.name || athlete.email}`;
    if (!window.confirm(`Creare la notifica «${titolo.trim()}» per ${target}?\n\nSarà visibile solo nel portale. Non verranno inviate email o notifiche push.`)) return;
    const audience = { type: audienceType };
    if (audienceType === "tournament") audience.tournamentId = tournament.id;
    if (audienceType === "athlete") audience.userId = athlete.id;
    save({ action: "create", titolo: titolo.trim(), messaggio: messaggio.trim(), tipo, audience }, "create", "Notifica creata nel portale.", () => {
      setTitolo(""); setMessaggio(""); setTipo("info"); setAthlete(null); setQuery("");
    });
  }

  const notifications = (snapshot?.data || [])
    .filter((item) => (source === "all" || item.source === source) && (archived === "all" || Boolean(item.archived) === (archived === "archived")))
    .slice().sort((a, b) => (Date.parse(b.data) || 0) - (Date.parse(a.data) || 0));

  return (
    <main className="min-h-screen bg-[#f8faff] pb-12 text-[#0a1628]">
      <StaffHeader />
      <div className="mx-auto mt-6 max-w-6xl space-y-6 px-4 md:mt-10 md:px-6">
        <header>
          <h1 className="staff-page-title">Notifiche</h1>
          <p className="staff-page-description">Comunicazioni e aggiornamenti per gli atleti nel portale.</p>
        </header>
        <p className="rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm">
          <strong>Solo nel portale.</strong> Nessun invio email. Le notifiche push non sono attive.
        </p>
        {isLoaded && !user && <p role="alert">Accedi all’area staff per gestire le notifiche.</p>}
        {loadError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p>{loadError} {snapshot ? "I dati mostrati potrebbero non essere aggiornati." : ""}</p>
          <button type="button" className={`${buttonClass} mt-3`} disabled={loading || Boolean(pending)} onClick={() => setReload((value) => value + 1)}>Riprova caricamento</button>
        </div>}
        {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        {success && <p role="status" className="rounded-xl bg-green-50 p-4 text-sm text-green-800">{success}</p>}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <section aria-labelledby="create-title" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 id="create-title" className="mb-5 text-lg font-bold">Nuova notifica</h2>
            <form onSubmit={createNotification}>
              <fieldset disabled={disabled} className="space-y-4 disabled:opacity-60">
                <div>
                  <label htmlFor="notification-title" className="mb-1 block text-sm font-semibold">Titolo</label>
                  <input id="notification-title" required maxLength={120} value={titolo} onChange={(event) => setTitolo(event.target.value)} className={inputClass} aria-describedby="title-count" />
                  <p id="title-count" className="mt-1 text-right text-xs text-slate-500">{titolo.length}/120</p>
                </div>
                <div>
                  <label htmlFor="notification-message" className="mb-1 block text-sm font-semibold">Messaggio</label>
                  <textarea id="notification-message" required maxLength={2000} rows={5} value={messaggio} onChange={(event) => setMessaggio(event.target.value)} className={`${inputClass} resize-y`} aria-describedby="message-count" />
                  <p id="message-count" className="mt-1 text-right text-xs text-slate-500">{messaggio.length}/2000</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label htmlFor="notification-type" className="mb-1 block text-sm font-semibold">Tipo</label>
                    <select id="notification-type" value={tipo} onChange={(event) => setTipo(event.target.value)} className={inputClass}>
                      {Object.entries(types).map(([value, type]) => <option key={value} value={value}>{type.label}</option>)}
                    </select>
                  </div>
                  <div><label htmlFor="notification-audience" className="mb-1 block text-sm font-semibold">Destinatari</label>
                    <select id="notification-audience" value={audienceType} onChange={(event) => { setAudienceType(event.target.value); setAthlete(null); setQuery(""); setAthletes([]); }} className={inputClass}>
                      <option value="all">Tutti gli atleti</option><option value="tournament">Un torneo</option><option value="athlete">Un atleta</option>
                    </select>
                  </div>
                </div>
                {audienceType === "all" && <p className="rounded-lg bg-yellow-50 p-3 text-sm text-yellow-900">Attenzione: la notifica sarà rivolta a tutti gli atleti del portale.</p>}
                {audienceType === "tournament" && <div>
                  <label htmlFor="notification-tournament" className="mb-1 block text-sm font-semibold">Torneo</label>
                  <select id="notification-tournament" required value={tournamentId} onChange={(event) => setTournamentId(event.target.value)} className={inputClass}>
                    <option value="">Seleziona un torneo</option>
                    {(snapshot?.tournaments || []).map((item) => <option key={item.id} value={String(item.id)}>{item.nome}</option>)}
                  </select>
                  {snapshot && !snapshot.tournaments.length && <p className="mt-2 text-sm text-slate-500">Nessun torneo disponibile.</p>}
                </div>}
                {audienceType === "athlete" && <div>
                  <label htmlFor="notification-athlete" className="mb-1 block text-sm font-semibold">Cerca e seleziona atleta</label>
                  <input id="notification-athlete" type="search" value={query} autoComplete="off" placeholder="Nome o email, almeno 3 caratteri" aria-describedby="athlete-help" className={inputClass} onChange={(event) => { setQuery(event.target.value); setAthlete(null); setAthletes([]); setSearched(false); }} />
                  <p id="athlete-help" className="mt-1 text-xs text-slate-500">La ricerca parte dopo almeno 3 caratteri. Seleziona un risultato per confermare il destinatario.</p>
                  <div aria-live="polite" className="mt-2 text-sm">
                    {athlete && <p className="break-words rounded-lg bg-blue-50 p-3">Selezionato: <strong>{athlete.name}</strong> · {athlete.email}</p>}
                    {searching && <p>Ricerca in corso…</p>}
                    {searchError && <p role="alert" className="text-red-700">{searchError}</p>}
                    {searched && !athletes.length && <p>Nessun atleta trovato.</p>}
                  </div>
                  {athletes.length > 0 && <ul aria-label="Risultati ricerca atleti" className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-200">
                    {athletes.map((item) => <li key={item.id}><button type="button" className="w-full break-words border-b border-slate-100 px-3 py-3 text-left text-sm hover:bg-blue-50 focus-visible:bg-blue-50" onClick={() => { setAthlete(item); setQuery(item.name || item.email); setAthletes([]); }}><span className="block font-semibold">{item.name}</span><span className="text-slate-500">{item.email}</span></button></li>)}
                  </ul>}
                </div>}
                <button type="submit" disabled={disabled || !titolo.trim() || !messaggio.trim() || (audienceType === "athlete" && !athlete) || (audienceType === "tournament" && !tournamentId)} className="w-full rounded-xl bg-[#FFD700] px-4 py-3 text-sm font-bold text-[#0a1628] hover:bg-yellow-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50">{pending === "create" ? "Creazione in corso…" : "Crea notifica nel portale"}</button>
              </fieldset>
            </form>
          </section>

          <section aria-labelledby="settings-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <h2 id="settings-title" className="mb-3 text-lg font-bold">Notifiche automatiche</h2>
            <p id="automatic-help" className="mb-4 text-sm text-slate-600">Abilita gli aggiornamenti automatici nel portale. Questa impostazione non attiva email o push.</p>
            <label className="flex items-start gap-3 text-sm font-semibold">
              <input type="checkbox" checked={snapshot?.settings.automaticEnabled ?? false} disabled={disabled} aria-describedby="automatic-help" className="mt-0.5 h-5 w-5 accent-blue-900" onChange={(event) => {
                const automaticEnabled = event.target.checked;
                save({ action: "settings", automaticEnabled }, "settings", "Impostazioni salvate.", () => setSnapshot((previous) => ({ ...previous, settings: { ...previous.settings, automaticEnabled } })));
              }} />
              Abilita notifiche automatiche
            </label>
            {pending === "settings" && <p role="status" className="mt-3 text-sm text-slate-500">Salvataggio impostazioni…</p>}
          </section>
        </div>

        <section aria-labelledby="list-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6" aria-busy={loading}>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div><h2 id="list-title" className="text-lg font-bold">Ultime notifiche</h2><p className="mt-1 text-sm text-slate-500">Ultimi 200 avvisi · {notifications.length} nei filtri selezionati</p></div>
            <div className="flex flex-wrap gap-3">
              <div><label htmlFor="filter-source" className="mb-1 block text-xs font-semibold">Origine</label><select id="filter-source" value={source} onChange={(event) => setSource(event.target.value)} className={inputClass}><option value="all">Tutte</option><option value="manual">Manuali</option><option value="automatic">Automatiche</option></select></div>
              <div><label htmlFor="filter-archived" className="mb-1 block text-xs font-semibold">Stato</label><select id="filter-archived" value={archived} onChange={(event) => setArchived(event.target.value)} className={inputClass}><option value="active">Attive</option><option value="archived">Archiviate</option><option value="all">Tutte</option></select></div>
            </div>
          </div>
          {loading ? <p role="status" className="py-6 text-sm text-slate-500">Caricamento notifiche…</p> : !snapshot ? <p className="py-6 text-sm text-slate-500">Notifiche non disponibili.</p> : !notifications.length ? <p className="py-6 text-sm text-slate-500">Nessuna notifica nei filtri selezionati.</p> : <ul className="divide-y divide-slate-200">
            {notifications.map((item) => <li key={item.id} className="py-5 first:pt-0 last:pb-0">
              <article className="flex flex-col items-start justify-between gap-4 md:flex-row">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap gap-2 text-xs font-semibold">
                    <span className={`rounded-full px-2.5 py-1 ${(types[item.tipo] || types.info).className}`}>{(types[item.tipo] || types.info).label}</span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{item.source === "automatic" ? "Automatica" : "Manuale"}</span>
                    {item.archived && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">Archiviata</span>}
                  </div>
                  <h3 className="break-words font-bold">{item.titolo}</h3>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{item.messaggio}</p>
                  <p className="mt-3 break-words text-xs text-slate-500">{formatDate(item.data)} · {audienceLabel(item.audience)}</p>
                </div>
                {!item.archived && <button type="button" disabled={disabled} className={`${buttonClass} shrink-0`} aria-label={`Archivia ${item.titolo}`} onClick={() => {
                  if (window.confirm(`Archiviare la notifica «${item.titolo}»?`)) save({ action: "archive", id: item.id }, `archive:${item.id}`, "Notifica archiviata.");
                }}>{pending === `archive:${item.id}` ? "Archiviazione…" : "Archivia"}</button>}
              </article>
            </li>)}
          </ul>}
        </section>
      </div>
    </main>
  );
}
