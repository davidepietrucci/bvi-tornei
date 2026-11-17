"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { normalizeCircuitName } from "@/app/utils/circuit";
import { tourHref } from "@/app/utils/tour-view";

export default function AthleteTourCards({ openTournaments = [] }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/atleta/profilo", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Impossibile caricare il riepilogo del tour.");
      if (!controller.signal.aborted) { setProfile(json.data); setError(""); }
    }).catch((reason) => { if (reason.name !== "AbortError") setError(reason.message); });
    return () => controller.abort();
  }, [reload]);
  const mine = new Set((profile?.punteggi || []).filter((r) => r.stato !== "Annullata").map((r) => normalizeCircuitName(r.circuito)));
  const circuits = (profile?.circuiti || []).filter((c) => c.regole?.giallo && (c.tappe > 0 || mine.has(normalizeCircuitName(c.nome))));
  return <section aria-label="Il tuo percorso nei tour" className="space-y-4">
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-black">Il tuo percorso nel tour</h2><Link href="/tour" className="text-xs font-bold underline">Scopri i tour →</Link></div>
    {error ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}<button type="button" onClick={() => setReload((n) => n + 1)} className="ml-2 font-bold underline">Riprova</button></p> : !profile ? <p role="status" className="rounded-xl bg-white p-4 text-sm text-slate-500">Caricamento del tuo tour…</p> : !circuits.length ? <p className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Partecipando a una tappa troverai qui punti validi, presenze e percorso verso la finale.</p> : circuits.map((c) => {
      const final = c.finali.find((f) => f.qualificato) || c.finali.find((f) => f.statoQualificazione === "playoff") || c.finali[0];
      const alreadyRegistered = (t) => (profile.punteggi || []).some((r) => r.stato !== "Annullata" && normalizeCircuitName(r.torneo) === normalizeCircuitName(t.nome));
      const next = openTournaments.filter((t) => t.stato === "Iscrizioni Aperte" && t.circuitRole === "tappa" && normalizeCircuitName(t.circuitName) === normalizeCircuitName(c.nome) && !alreadyRegistered(t)).sort((a, b) => String(a.data).localeCompare(String(b.data)))[0];
      const finalOpen = final?.qualificato && openTournaments.find((t) => t.nome === final.torneo && t.stato === "Iscrizioni Aperte" && !alreadyRegistered(t));
      const target = finalOpen || next;
      const reason = final?.qualificato ? "Sei qualificato alla finale." : c.tappe < 2 ? `Ti ${2 - c.tappe === 1 ? "manca 1 tappa valida" : "mancano 2 tappe valide"} per raggiungere il minimo di partecipazione.` : final?.motivoQualificazione || "La finale deve ancora essere configurata dallo staff.";
      return <article key={c.nome} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Tour giallo</p><h3 className="mt-2 text-xl font-black">{c.nome}</h3><div className="mt-4 grid grid-cols-3 gap-2">{[{ label: "Punti validi", value: c.punti }, { label: "Tappe valide", value: `${c.tappe}/3` }, { label: "Posizione", value: c.posizione ? `#${c.posizione}` : "—" }].map((item) => <div key={item.label} className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold text-slate-500">{item.label}</p><p className="mt-2 text-lg font-black">{item.value}</p></div>)}</div><p className={`mt-4 rounded-xl p-3 text-sm ${final?.qualificato ? "bg-green-50 text-green-800" : "bg-blue-50 text-blue-900"}`}>{reason}</p><p className="mt-3 text-xs leading-5 text-slate-500">Contano i migliori 2 risultati su 3. Una buona posizione non basta senza almeno 2 tappe; la finale riparte da zero.</p><div className="mt-4 flex flex-wrap gap-3">{target && <Link href={`/atleta/iscriviti?${new URLSearchParams({ tour: target.nome })}`} className="rounded-xl bg-[#FFD700] px-4 py-3 text-sm font-bold">{finalOpen ? "Iscriviti alla finale" : "Iscriviti alla prossima tappa"} →</Link>}<Link href={c.tourPubblico ? tourHref(c.nome) : "/atleta/profilo"} className="rounded-xl border px-4 py-3 text-sm font-bold">{c.tourPubblico ? "Calendario e classifica" : "I tuoi risultati"} →</Link></div></article>;
    })}
  </section>;
}
