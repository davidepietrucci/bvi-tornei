"use client";

import Link from "next/link";

export default function TournamentSetupHeader({ family = "teams", step = "groups", tournaments = [], selected, onSelect }) {
  const yellow = family === "giallo";
  const query = selected ? `?tour=${encodeURIComponent(selected)}` : "";
  return <div className="mb-7 space-y-6 text-[#0a1628]">
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-slate-500">Organizzazione torneo</p>
      <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{yellow ? "Il tuo torneo giallo" : "Gironi e fase finale"}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{yellow
        ? "Un percorso dedicato agli atleti singoli: compagni a rotazione, classifica individuale e coppie fisse dalle semifinali."
        : "Configura i gironi delle squadre iscritte, inserisci i risultati e prepara il tabellone finale."}</p>
    </div>
    <nav aria-label="Tipo di torneo" className="grid gap-3 sm:grid-cols-2">
      {[{ id: "teams", href: "/staff/gironi", title: "Tornei a squadre", caption: "Coppie già formate · Maschile, femminile e misto", icon: "02" },
        { id: "giallo", href: "/staff/giallo", title: "Torneo giallo", caption: "Atleti singoli · Compagni a rotazione", icon: "↻" }].map((item) => {
          const active = family === item.id;
          return <Link key={item.id} href={active ? `${yellow ? "/staff/giallo" : "/staff/gironi"}${query}` : item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-4 rounded-2xl border p-5 transition-colors ${active ? "border-[#0a1628] bg-[#0a1628] text-white" : "border-slate-200 bg-white hover:border-slate-400"}`}>
            <span aria-hidden="true" className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-black ${active ? "bg-[#FFD700] text-[#0a1628]" : "bg-slate-100 text-slate-500"}`}>{item.icon}</span>
            <span><span className="block text-base font-bold">{item.title}</span><span className={`mt-1 block text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>{item.caption}</span></span>
          </Link>;
        })}
    </nav>
    <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-end sm:justify-between">
      <label className="block w-full sm:max-w-md"><span className="mb-2 block text-sm font-bold">{yellow ? "Seleziona il torneo giallo" : "Seleziona il torneo a squadre"}</span>
        <select aria-label={yellow ? "Torneo giallo" : "Torneo a squadre"} className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm font-semibold" value={selected || ""} onChange={(event) => onSelect(event.target.value)} disabled={!tournaments.length}>
          {!tournaments.length && <option value="">Nessun torneo disponibile</option>}
          {tournaments.map((t) => <option key={t.id || t.nome} value={t.nome}>{t.nome}</option>)}
        </select>
      </label>
      {!yellow && <nav aria-label="Fase del torneo" className="flex gap-2">
        <Link href={`/staff/gironi${query}`} aria-current={step === "groups" ? "step" : undefined} className={`rounded-xl px-4 py-3 text-sm font-bold ${step === "groups" ? "bg-yellow-100 text-yellow-900" : "bg-slate-100 text-slate-600"}`}>1. Gironi</Link>
        <Link href={`/staff/tabellone${query}`} aria-current={step === "finals" ? "step" : undefined} className={`rounded-xl px-4 py-3 text-sm font-bold ${step === "finals" ? "bg-yellow-100 text-yellow-900" : "bg-slate-100 text-slate-600"}`}>2. Tabellone</Link>
      </nav>}
    </div>
    {!tournaments.length && <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">Non ci sono tornei di questo tipo disponibili. <Link className="font-bold underline" href="/staff/tornei/nuovo">Crea un torneo</Link> oppure controlla la categoria e lo stato dei tornei esistenti.</p>}
  </div>;
}
