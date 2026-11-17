"use client";

import Link from "next/link";
import { managementHref, WORKFLOW_STEPS } from "@/app/utils/tournament-workflow";

export default function TournamentSetupHeader({ family = "teams", step = "prepare", tournaments = [], selected, onSelect, onFamilyChange, onStepChange, disabled = false, summary = {} }) {
  const yellow = family === "giallo";
  return <div className="mb-6 space-y-4 text-[#0a1628]">
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-slate-500">Organizzazione torneo</p>
      <h1 className="staff-page-title">Gestione torneo</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{yellow
        ? "Un percorso dedicato agli atleti singoli: compagni a rotazione, classifica individuale e coppie fisse dalle semifinali."
        : "Configura i gironi delle squadre iscritte, inserisci i risultati e prepara il tabellone finale."}</p>
    </div>
    <nav aria-label="Tipo di torneo" className="grid gap-3 sm:grid-cols-2">
      {[{ id: "teams", title: "Tornei a squadre", caption: "Coppie già formate · Maschile, femminile e misto", icon: "02" },
        { id: "giallo", title: "Tornei gialli", caption: "Atleti singoli · Compagni a rotazione", icon: "↻" }].map((item) => {
          const active = family === item.id;
          return <Link key={item.id} href={managementHref({ family: item.id, tour: active ? selected : undefined, step: active ? step : "prepare" })}
            aria-disabled={disabled} onClick={(event) => { if (disabled || onFamilyChange) event.preventDefault(); if (!disabled) onFamilyChange?.(item.id); }}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl border p-4 transition-colors ${active ? "border-[#0a1628] bg-[#0a1628] text-white" : "border-slate-200 bg-white hover:border-slate-400"}`}>
            <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-black ${active ? "bg-[#FFD700] text-[#0a1628]" : "bg-slate-100 text-slate-500"}`}>{item.icon}</span>
            <span><span className="block text-base font-bold">{item.title}</span><span className={`mt-1 block text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>{item.caption}</span></span>
          </Link>;
        })}
    </nav>
    <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-end sm:justify-between">
      <label className="block w-full sm:max-w-md"><span className="mb-2 block text-sm font-bold">{yellow ? "Seleziona il torneo giallo" : "Seleziona il torneo a squadre"}</span>
        <select aria-label={yellow ? "Torneo giallo" : "Torneo a squadre"} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm font-semibold" value={selected || ""} onChange={(event) => onSelect(event.target.value)} disabled={disabled || !tournaments.length}>
          {!tournaments.length && <option value="">Nessun torneo disponibile</option>}
          {tournaments.map((t) => <option key={t.id || t.nome} value={t.nome}>{t.nome}</option>)}
        </select>
      </label>
      {selected && <div className="flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-slate-100 px-3 py-2">{tournaments.find((t) => t.nome === selected)?.stato}</span>
        <span className={`rounded-full px-3 py-2 ${summary.groupsPublished ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>Gironi: {summary.groupsPublished === undefined ? "verifica…" : summary.groupsPublished ? "pubblicati" : "bozza"}</span>
        <span className={`rounded-full px-3 py-2 ${summary.finalsPublished ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>Finali: {summary.finalsPublished === undefined ? "verifica…" : summary.finalsPublished ? "pubblicate" : "bozza"}</span>
      </div>}
    </div>
    {selected && <nav aria-label="Passaggi di gestione torneo" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {WORKFLOW_STEPS.map((phase, i) => <Link key={phase.id} href={managementHref({ family, tour: selected, step: phase.id })}
        aria-current={step === phase.id ? "step" : undefined} aria-disabled={disabled}
        onClick={(event) => { if (disabled || onStepChange) event.preventDefault(); if (!disabled) onStepChange?.(phase.id); }}
        className={`flex items-start gap-3 rounded-xl border p-4 ${step === phase.id ? "border-[#0a1628] bg-[#0a1628] text-white" : "border-slate-200 bg-white"}`}>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${step === phase.id ? "bg-yellow-300 text-[#0a1628]" : "bg-slate-100"}`}>{i + 1}</span>
        <span><strong className="block text-sm">{phase.label}</strong><span className={`mt-1 block text-xs ${step === phase.id ? "text-slate-300" : "text-slate-500"}`}>{phase.detail}</span></span>
      </Link>)}
    </nav>}
    {!tournaments.length && <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">Non ci sono tornei di questo tipo disponibili. <Link className="font-bold underline" href="/staff/tornei/nuovo">Crea un torneo</Link> oppure controlla la categoria e lo stato dei tornei esistenti.</p>}
  </div>;
}
