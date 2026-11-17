"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PublicHeader from "@/app/components/PublicHeader";
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
  return <main className="min-h-screen bg-[#f5f4ef] pb-12 text-[#101d2c]">
    <PublicHeader active="Tour" />
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-8 sm:py-12">
      <section className="grid gap-6 border-b border-[#101d2c]/15 pb-8 sm:grid-cols-[1fr_auto] sm:items-end"><div><p className="text-[10px] font-black uppercase tracking-[.25em] text-[#78600d]">Beach Volley Institute · Il circuito</p><h1 className="mt-4 text-4xl font-black leading-tight tracking-[-.04em] sm:text-6xl">Tre tappe.<br />Un posto in <span className="text-[#a98005]">finale.</span></h1><p className="mt-5 max-w-xl text-sm leading-7 text-[#596574] sm:text-base">Segui i tour gialli BVI: calendario, classifica individuale e percorso verso la finale per 16 atleti.</p></div><div className="flex gap-6 border-l-2 border-[#f5ca3e] pl-5 text-sm"><p><strong className="block text-3xl font-black">3</strong><span className="text-xs text-[#647181]">Tappe</span></p><p><strong className="block text-3xl font-black">2</strong><span className="text-xs text-[#647181]">Risultati validi</span></p><p><strong className="block text-3xl font-black">16</strong><span className="text-xs text-[#647181]">Finalisti</span></p></div></section>
      {tours.length > 0 && <label className="block max-w-md text-xs font-bold uppercase tracking-wider text-[#647181]">Scegli il tour<select aria-label="Scegli il tour" value={tours.find((t) => normalizeCircuitName(t.name) === normalizeCircuitName(selected))?.name || ""} onChange={(e) => choose(e.target.value)} className="mt-2 block min-h-12 w-full rounded-xl border border-[#101d2c]/20 bg-white p-3 text-base font-bold normal-case tracking-normal text-[#101d2c]"><option value="" disabled>Seleziona un tour</option>{tours.map((tour) => <option key={tour.name}>{tour.name}</option>)}</select></label>}
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error}<button type="button" onClick={() => { setLoading(true); setReload((n) => n + 1); }} className="ml-3 font-bold underline">Riprova</button></div>}
      {loading && !data && <p role="status" className="rounded-2xl bg-white p-6 text-sm">Caricamento tour…</p>}
      {!loading && !error && tours.length === 0 && <section className="rounded-2xl border border-[#101d2c]/10 bg-white p-7 sm:p-10"><span aria-hidden="true" className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#f5ca3e] text-2xl font-black">↗</span><h2 className="text-2xl font-black tracking-tight">La prossima sfida si prepara.</h2><p className="mt-3 max-w-lg text-sm leading-7 text-[#647181]">Al momento non ci sono tour pubblicati. Il calendario comparirà qui quando sarà disponibile.</p><Link href="/#tornei" className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-[#101d2c] px-5 text-sm font-bold text-white">Scopri i tornei →</Link></section>}
      {data && <>
        <section className="rounded-2xl border-t-4 border-[#f5ca3e] bg-[#101d2c] p-6 text-white sm:p-8"><p className="text-xs font-bold uppercase tracking-widest text-[#f5ca3e]">{data.status}</p><h2 className="mt-3 break-words text-2xl font-black tracking-tight sm:text-3xl">{data.name}</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Classifica individuale, migliori 2 risultati su 3 e almeno 2 tappe per qualificarsi. La finale parte da zero.</p>{next && <Link href={`/atleta/iscriviti?${new URLSearchParams({ tour: next.nome })}`} className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-[#f5ca3e] px-5 py-3 text-sm font-bold text-[#101d2c]">Iscriviti alla prossima tappa →</Link>}</section>
        <div className="grid gap-3 sm:grid-cols-3">{[{ label: "Tappe concluse", value: `${data.completed}/3` }, { label: "Atleti in classifica", value: data.athleteCount }, { label: "Qualificati confermati", value: `${data.qualifiedCount}/16` }].map((item) => <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs text-slate-500">{item.label}</p><p className="mt-2 text-2xl font-black">{item.value}</p></div>)}</div>
        <section aria-label="Calendario del tour"><h2 className="mb-4 text-2xl font-black tracking-tight">Il percorso</h2><TourJourney stages={data.stages} finals={data.finals} /></section>
        {data.provisional && <p role="status" className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">Classifica provvisoria: i qualificati saranno confermati dopo tutte e tre le tappe e la verifica dei piazzamenti.</p>}
        {data.playoffPending && <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Sono presenti pari merito decisivi: alcuni posti in finale attendono l’esito degli spareggi.</p>}
        <TourStandings athletes={data.athletes} stages={data.stages} />
        <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-xl font-bold">Verso la finale</h2><p className="mt-2 text-sm leading-6 text-slate-600">A parità di punti contano il numero di tappe disputate e poi il miglior risultato singolo. Le parità al limite dei posti richiedono uno spareggio. Nella tua area atleta trovi i requisiti personali e la possibilità di iscriverti quando risulti qualificato.</p><Link href="/atleta" className="mt-4 inline-block font-bold underline underline-offset-4">Controlla la tua qualificazione →</Link></section>
      </>}
    </div>
  </main>;
}
