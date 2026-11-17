"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TourJourney from "@/app/components/TourJourney";
import TourStandings from "@/app/components/TourStandings";
import { normalizeCircuitName } from "@/app/utils/circuit";
import { tourHref } from "@/app/utils/tour-view";

async function readPublicTour(name, signal) {
  const response = await fetch(`/api/tour${name ? `?${new URLSearchParams({ tour: name })}` : ""}`, { cache: "no-store", signal });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || "Caricamento del tour non riuscito.");
  return json.data;
}

export default function PublicTours() {
  const [tours, setTours] = useState([]);
  const [selected, setSelected] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const load = async () => {
      try {
        const list = await readPublicTour(null, controller.signal);
        if (cancelled) return;
        setTours(list);
        if (!selected) {
          const requested = new URLSearchParams(window.location.search).get("tour");
          const target = requested || list[0]?.name || "";
          if (target) { setSelected(target); return; }
          setData(null); setError(""); return;
        }
        if (!list.some((tour) => normalizeCircuitName(tour.name) === normalizeCircuitName(selected))) throw new Error("Questo tour non è disponibile al pubblico.");
        const detail = await readPublicTour(selected, controller.signal);
        if (!cancelled) { setData(detail); setError(""); }
      } catch (reason) {
        if (!cancelled && reason.name !== "AbortError") { setData(null); setError(reason.message || "Caricamento non riuscito."); }
      } finally { if (!cancelled) setLoading(false); }
    };
    load();
    const timer = setInterval(load, 10000);
    return () => { cancelled = true; controller.abort(); clearInterval(timer); };
  }, [selected, reload]);
  const choose = (name) => { setData(null); setError(""); setLoading(true); setSelected(name); window.history.replaceState(window.history.state, "", tourHref(name)); };
  const next = data?.stages.find((t) => t.stato === "Iscrizioni Aperte");
  return <main className="min-h-screen bg-[#f5f7fa] pb-12 text-[#0a1628]">
    <header className="border-b border-slate-200 bg-white"><nav aria-label="Navigazione tour pubblico" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4"><Link href="/" className="text-lg font-black">BVI · Tour</Link><div className="flex gap-4 text-sm font-bold"><Link href="/">Tornei</Link><Link href="/atleta">Area atleta →</Link></div></nav></header>
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Il percorso verso la finale</p><h1 className="mt-2 text-3xl font-black">Tour gialli BVI</h1><p className="mt-2 text-sm leading-6 text-slate-500">Tre tappe, i tuoi migliori due risultati e una finale per 16 atleti.</p></div>
      {tours.length > 0 && <label className="block max-w-md text-sm font-bold">Scegli il tour<select aria-label="Scegli il tour" value={tours.find((t) => normalizeCircuitName(t.name) === normalizeCircuitName(selected))?.name || ""} onChange={(e) => choose(e.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3"><option value="" disabled>Seleziona un tour</option>{tours.map((tour) => <option key={tour.name}>{tour.name}</option>)}</select></label>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}<button type="button" onClick={() => { setLoading(true); setReload((n) => n + 1); }} className="ml-3 font-bold underline">Riprova</button></div>}
      {loading && !data && <p role="status" className="rounded-2xl bg-white p-6 text-sm">Caricamento tour…</p>}
      {!loading && !error && tours.length === 0 && <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">Al momento non ci sono tour pubblicati. Il calendario comparirà qui quando sarà disponibile.</p>}
      {data && <>
        <section className="rounded-2xl bg-[#0a1628] p-6 text-white sm:p-8"><p className="text-xs font-bold uppercase tracking-widest text-yellow-300">{data.status}</p><h2 className="mt-3 text-2xl font-black sm:text-3xl">{data.name}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Classifica individuale, migliori 2 risultati su 3 e almeno 2 tappe per qualificarsi. La finale parte da zero.</p>{next && <Link href={`/atleta/iscriviti?${new URLSearchParams({ tour: next.nome })}`} className="mt-5 inline-block rounded-xl bg-[#FFD700] px-5 py-3 text-sm font-bold text-[#0a1628]">Iscriviti alla prossima tappa →</Link>}</section>
        <div className="grid gap-3 sm:grid-cols-3">{[{ label: "Tappe concluse", value: `${data.completed}/3` }, { label: "Atleti in classifica", value: data.athleteCount }, { label: "Qualificati confermati", value: `${data.qualifiedCount}/16` }].map((item) => <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-black">{item.value}</p></div>)}</div>
        <TourJourney stages={data.stages} finals={data.finals} />
        {data.provisional && <p role="status" className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">Classifica provvisoria: i qualificati saranno confermati dopo tutte e tre le tappe e la verifica dei piazzamenti.</p>}
        {data.playoffPending && <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Sono presenti pari merito decisivi: alcuni posti in finale attendono l’esito degli spareggi.</p>}
        <TourStandings athletes={data.athletes} stages={data.stages} />
        <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-xl font-bold">Verso la finale</h2><p className="mt-2 text-sm leading-6 text-slate-600">A parità di punti contano il numero di tappe disputate e poi il miglior risultato singolo. Le parità al limite dei posti richiedono uno spareggio. Nella tua area atleta trovi i requisiti personali e la possibilità di iscriverti quando risulti qualificato.</p><Link href="/atleta" className="mt-4 inline-block font-bold underline underline-offset-4">Controlla la tua qualificazione →</Link></section>
      </>}
    </div>
  </main>;
}
