"use client";

import { tournamentNextAction } from "@/app/utils/tournament-workflow";

export default function TournamentOverview({ tournament, summary, onNavigate, disabled = false }) {
  const next = tournamentNextAction(summary);
  const checks = [
    { label: "Gironi configurati", done: summary.groupsConfigured, step: "groups" },
    { label: "Risultati dei gironi completi", done: summary.groupMatches > 0 && summary.groupCompleted === summary.groupMatches, step: "ranking" },
    { label: "Fase finale preparata", done: summary.finalsConfigured, step: "finals" },
  ];
  return <section aria-label="Riepilogo preparazione torneo" className="staff-tournament-overview space-y-5">
    <div className="staff-panel">
      <h2 className="text-xl font-bold">Il torneo, a colpo d’occhio</h2>
      <p className="mt-2 text-sm text-slate-600">{tournament.nome} · Puoi iniziare dai gironi e preparare il tabellone dopo i risultati. Pubblicazione e salvataggio restano separati.</p>
      <ul className="mt-5 divide-y divide-slate-100">{checks.map(check => <li key={check.step} className="flex flex-wrap items-center justify-between gap-3 py-4">
        <span className="text-sm font-semibold">{check.label}<span className={`ml-3 inline-block rounded-full px-3 py-1 text-xs ${check.done ? "bg-green-50 text-green-800" : "bg-slate-100 text-slate-600"}`}>{check.done ? "Completato" : "Da completare"}</span></span>
        <button type="button" disabled={disabled} onClick={() => onNavigate(check.step, "prepare")} className="staff-button disabled:opacity-40">{check.step === "ranking" ? "Controlla classifica" : "Apri configurazione"}</button>
      </li>)}</ul>
    </div>
    <div className="staff-panel">
      <h2 className="font-bold">Visibilità pubblica</h2>
      <p className="mt-2 text-sm text-slate-600">Lo stato del torneo non decide cosa vede il pubblico. Puoi gestire la visibilità anche a torneo concluso.</p>
      <div className="mt-4 flex flex-wrap gap-3">{[{ label: "Gironi", value: summary.groupsPublished, step: "groups" }, { label: "Finali", value: summary.finalsPublished, step: "finals" }].map(item => <button key={item.step} type="button" disabled={disabled} onClick={() => onNavigate(item.step, "prepare")} className="staff-button disabled:opacity-40">{item.label}: {item.value ? "visibili" : "nascosti"} · Gestisci</button>)}</div>
    </div>
    {next && <div className="staff-panel staff-tournament-next"><div><p className="staff-tournament-eyebrow">Prossima azione</p><h2 className="mt-2 text-lg font-bold">{next.label}</h2><p className="staff-page-description">{next.detail}</p></div><button type="button" disabled={disabled} onClick={() => onNavigate(next.step, next.mode)} className="staff-button staff-button-yellow disabled:opacity-40">Continua →</button></div>}
  </section>;
}
