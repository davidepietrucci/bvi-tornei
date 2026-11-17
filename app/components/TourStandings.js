const labels = { qualified: "Qualificato", provisional: "Provvisorio", minimum_stages: "Serve la seconda tappa", playoff: "Spareggio necessario", excluded: "Non qualificato" };

export default function TourStandings({ athletes, stages }) {
  if (!athletes.length) return <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">La classifica sarà disponibile dopo i primi piazzamenti confermati.</p>;
  return <section aria-label="Classifica individuale del tour" className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="border-b border-slate-100 p-5"><h2 className="text-xl font-bold">Classifica individuale</h2><p className="mt-2 text-sm leading-6 text-slate-500">Si sommano i migliori 2 risultati. La posizione generale non equivale alla qualificazione: servono almeno 2 tappe. Il risultato scartato è indicato esplicitamente.</p></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-4">Pos.</th><th className="p-4">Atleta</th>{Array.from({ length: 3 }, (_, i) => <th key={i} className="p-4" title={stages[i]?.nome}>Tappa {i + 1}</th>)}<th className="p-4">Punti validi</th><th className="p-4">Presenze</th><th className="p-4">Finale</th></tr></thead>
      <tbody>{athletes.map((a, i) => <tr key={a.key || i} className={`border-t border-slate-100 ${a.qualificato ? "bg-green-50/40" : ""}`}><td className="p-4 font-bold">#{a.posizione}</td><th scope="row" className="p-4 font-bold">{a.nome}</th>{Array.from({ length: 3 }, (_, n) => {
        const result = a.risultati.find((r) => String(r.id) === String(stages[n]?.id));
        return <td key={n} className="p-4">{result ? <span className={`inline-block rounded-lg px-3 py-2 ${result.conteggiata ? "bg-blue-50 font-bold text-blue-900" : "bg-slate-100 text-slate-500"}`}>{result.punti}<small className="mt-1 block text-[10px]">{result.conteggiata ? "Conteggiata" : "Scartata"}</small></span> : <span className="text-slate-400">—<small className="block text-[10px]">Nessun risultato</small></span>}</td>;
      })}<td className="p-4 text-lg font-black">{a.punti}</td><td className="p-4">{a.tappe}/3</td><td className="p-4"><span className={`inline-block rounded-lg px-3 py-2 text-xs font-bold ${a.qualificato ? "bg-green-100 text-green-800" : a.statoQualificazione === "playoff" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-600"}`}>{labels[a.statoQualificazione]}</span></td></tr>)}</tbody>
    </table></div>
  </section>;
}
