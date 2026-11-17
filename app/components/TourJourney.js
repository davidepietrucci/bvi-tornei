import Link from "next/link";

export default function TourJourney({ stages, finals, staff = false }) {
  const items = [...Array.from({ length: 3 }, (_, i) => ({ event: stages[i], label: `Tappa ${i + 1}` })), { event: finals[0], label: "Finale · 16 atleti" }];
  return <ol aria-label="Percorso del tour" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{items.map(({ event, label }, i) => <li key={label} className={`rounded-2xl border p-5 ${i === 3 ? "border-yellow-300 bg-yellow-50" : "border-slate-200 bg-white"}`}>
    <div className="flex items-center justify-between gap-2"><span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-black ${event?.stato === "Concluso" ? "bg-green-100 text-green-800" : "bg-[#0a1628] text-white"}`}>{event?.stato === "Concluso" ? "✓" : i + 1}</span><span className="text-xs font-bold text-slate-500">{label}</span></div>
    <h3 className="mt-4 break-words text-base font-bold">{event?.nome || "Da programmare"}</h3>
    <p className="mt-2 text-xs leading-5 text-slate-500">{event ? [event.data || "Data da definire", event.location].filter(Boolean).join(" · ") : "Il calendario verrà aggiornato qui."}</p>
    {event && <><p className="mt-3 text-xs font-bold">{event.stato}</p><Link href={staff ? `/staff/gestione-torneo?${new URLSearchParams({ tipo: "giallo", tour: event.nome })}` : `/tornei/${encodeURIComponent(event.id)}`} className="mt-4 inline-block text-sm font-bold underline underline-offset-4">{staff ? "Gestisci tappa →" : "Dettagli tappa →"}</Link></>}
  </li>)}</ol>;
}
