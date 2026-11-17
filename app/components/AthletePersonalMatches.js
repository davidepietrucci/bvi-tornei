"use client";

import { useEffect, useState } from "react";
import AthleteHeader from "@/app/components/AthleteHeader";
import AthleteBottomNav from "@/app/components/AthleteBottomNav";
import LiveMatchCard from "@/app/components/LiveMatchCard";
import { fetchAthleteData } from "@/app/utils/athlete-area";
import { publicLiveModel, filterLiveMatches } from "@/app/utils/public-live";
import { personalMatchGroups, tournamentRegistrations } from "@/app/utils/athlete-matches";
import { gialloSlug, isGiallo } from "@/app/utils/giallo";

export default function AthletePersonalMatches({ userId, selectedTorneo, onSelect, viewControl }) {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let request = 0;
    const load = async () => {
      const current = ++request;
      try {
        const [tournaments, response] = await Promise.all([
          fetchAthleteData("tornei", { array: true, signal: controller.signal }),
          fetch("/api/atleta/iscrizioni", { cache: "no-store", signal: controller.signal }),
        ]);
        if (!response.ok) throw new Error("Non è stato possibile caricare le tue iscrizioni.");
        const { data: registrations } = await response.json();
        if (!Array.isArray(registrations)) throw new Error("Risposta iscrizioni non valida.");
        const urlTour = new URLSearchParams(window.location.search).get("tour");
        const selected = tournaments.find((t) => t.nome === selectedTorneo)
          || tournaments.find((t) => t.nome === urlTour)
          || tournaments.find((t) => tournamentRegistrations(registrations, t.nome).length && !["Concluso", "Annullato"].includes(t.stato))
          || tournaments.find((t) => tournamentRegistrations(registrations, t.nome).length) || tournaments[0];
        let model = { groups: [], finals: [] };
        if (selected) {
          const slug = gialloSlug(selected.nome);
          if (isGiallo(selected)) model = publicLiveModel(null, null, await fetchAthleteData("giallo", { slug, signal: controller.signal }));
          else {
            const [groups, finals] = await Promise.all(["gironi", "bracket"].map((type) => fetchAthleteData(type, { slug, signal: controller.signal })));
            model = publicLiveModel(groups, finals, null);
          }
        }
        if (cancelled || current !== request) return;
        setSnapshot({ userId, tournament: selected?.nome || "", tournaments, registrations, model });
        if (selected && selected.nome !== selectedTorneo) onSelect(selected.nome);
        setError("");
      } catch (reason) { if (!cancelled && current === request) setError(reason.message); }
    };
    load();
    const timer = setInterval(load, 10000);
    return () => { cancelled = true; controller.abort(); clearInterval(timer); };
  }, [userId, selectedTorneo, onSelect, reload]);

  const current = snapshot?.userId === userId && (!selectedTorneo || snapshot.tournament === selectedTorneo) ? snapshot : null;
  const groups = current ? personalMatchGroups(current.model, current.registrations, current.tournament) : [];
  const matches = filterLiveMatches(groups);
  const registered = current && tournamentRegistrations(current.registrations, current.tournament).length > 0;
  return <main className="min-h-screen bg-[#f8faff] pb-28 xl:pl-72">
    <AthleteHeader />
    <div className="mx-auto max-w-4xl space-y-5 px-4 py-6">
      <h1 className="text-3xl font-black text-[#0a1628]">Gironi & Calendario</h1>
      {viewControl}
      <p className="text-sm text-slate-600">Le partite delle tue iscrizioni approvate, dai gironi alle finali. Aggiornamento automatico ogni 10 secondi.</p>
      <label className="block text-sm font-bold">Torneo
        <select className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3" value={selectedTorneo} onChange={(event) => onSelect(event.target.value)}>
          {!snapshot && <option value="">Caricamento…</option>}
          {snapshot?.tournaments.map((t) => <option key={t.nome} value={t.nome}>{t.nome}</option>)}
        </select>
      </label>
      {error ? <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error} Non usare eventuali risultati precedenti come aggiornati.<button className="ml-3 font-bold underline" onClick={() => setReload((n) => n + 1)}>Riprova</button></div>
        : !current ? <p role="status">Caricamento delle tue partite…</p>
        : !matches.length ? <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-600">{!current.tournaments.length ? "Non ci sono tornei disponibili." : !registered ? "Non risultano iscrizioni approvate per il tuo account in questo torneo. Puoi comunque consultare la vista Intero torneo." : "Non ci sono ancora partite pubblicate e abbinate alla tua iscrizione. Le fasi successive appariranno quando saranno pubblicate e il tuo abbinamento sarà definito. Puoi consultare l’intero torneo."}</div>
        : <><p className="text-sm font-semibold text-slate-600">{matches.length} partite · Prima quelle in corso e da giocare</p><div className="space-y-3">{matches.map((match) => <LiveMatchCard key={`${match.group}-${match.id}`} match={match} group={`${match.group}${match.label ? ` · ${match.label}` : ""}`} />)}</div></>}
    </div>
    <AthleteBottomNav />
  </main>;
}
