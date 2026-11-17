"use client";

const fieldClass = "mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm font-semibold";
const sizes = [4, 8, 12, 16];

export default function FinalsSetupPanel({ config, onChange, disabled, onGenerate, onSave, onDelete, onResults, hasBracket }) {
  const select = (key, label, options, numeric = true) => <label className="block text-sm font-bold text-slate-700">{label}
    <select aria-label={label} value={config[key]} onChange={(e) => onChange(key, numeric ? Number(e.target.value) : e.target.value)} className={fieldClass}>
      {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
    </select>
  </label>;
  const sizeOptions = sizes.map((n) => [n, `${n} squadre${n === 12 ? " · 4 bye" : n === 4 ? " · dalle semifinali" : n === 8 ? " · dai quarti" : " · dagli ottavi"}`]);
  const intermediate = config.phaseType === "gold_silver" && ["groups", "pool_stepladder"].includes(config.subPhaseType);
  return <fieldset disabled={disabled} className="space-y-5 disabled:opacity-60">
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">1 · Formula</p>
      <h2 className="mt-2 text-2xl font-black">Come si conclude il torneo?</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">Scegli il percorso. Qui configuri le qualificazioni; punteggi, campo e orario si gestiscono in Partite e risultati.</p>
      <div role="group" aria-label="Formula fase finale" className="mt-5 grid gap-3 md:grid-cols-3">
        {[{ id: "single", title: "Eliminazione diretta", detail: "Un tabellone: chi perde esce, chi vince avanza." },
          { id: "gold_silver", title: "Gold e Silver", detail: "Due percorsi distinti secondo la classifica dei gironi." },
          { id: "double", title: "Doppia eliminazione", detail: "Percorso vincenti e recupero dei perdenti." }].map((item) => <button key={item.id} type="button" aria-pressed={config.phaseType === item.id} onClick={() => onChange("phaseType", item.id)} className={`rounded-xl border p-5 text-left ${config.phaseType === item.id ? "border-[#0a1628] bg-slate-50 ring-1 ring-[#0a1628]" : "border-slate-200"}`}>
          <span className="block font-bold">{item.title}</span><span className="mt-2 block text-sm leading-6 text-slate-500">{item.detail}</span>
        </button>)}
      </div>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">2 · Qualificazioni</p>
      <h2 className="mt-2 text-xl font-bold">Chi passa e come viene abbinato?</h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {config.phaseType === "gold_silver" && select("subPhaseType", "Percorso Gold e Silver", [["direct", "Tabelloni diretti"], ["groups", "Gironi intermedi"], ["pool_stepladder", "Pool e turni progressivi"], ["custom_18", "Formula speciale · 18 squadre"]], false)}
        {config.phaseType === "single" && select("bracketSize", "Squadre qualificate", sizeOptions)}
        {config.phaseType === "gold_silver" && config.subPhaseType === "direct" && <>
          {select("teamsToGold", "Squadre al Gold", sizeOptions)}{select("teamsToSilver", "Squadre al Silver", sizeOptions)}
        </>}
        {intermediate && ["Gold", "Silver"].map((category) => <div key={category} className="space-y-4 rounded-xl bg-slate-50 p-4">
          {select(`num${category}Gironi`, `Numero gironi ${category}`, [[0, "Automatico"], ...[1, 2, 3, 4].map((n) => [n, String(n)])])}
          {select(`teamsPer${category}Girone`, `Squadre per girone ${category}`, [3, 4, 5, 6].map((n) => [n, String(n)]))}
        </div>)}
        {select("groupCompositionMethod", "Metodo di abbinamento", [["girone", "Posizioni nei singoli gironi"], ["classifica", "Classifica unica complessiva"]], false)}
      </div>
      {config.subPhaseType === "custom_18" && config.phaseType === "gold_silver" && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Formula speciale salvata: gironi intermedi e pool Gold, gironi Silver e fase ad eliminazione diretta.</p>}
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-500">3 · Abbinamenti</p>
      <h2 className="mt-2 text-xl font-bold">Genera, controlla e passa alle partite</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">Controlla l’anteprima qui sotto prima di pubblicare. Modificare le opzioni non rigenera da solo gli incontri. La rigenerazione richiede conferma se sono già presenti abbinamenti.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={onGenerate} className="rounded-xl bg-[#FFD700] px-5 py-3 text-sm font-bold">{hasBracket ? "Rigenera abbinamenti" : "Genera abbinamenti"}</button>
        <button type="button" onClick={onSave} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold">Salva configurazione</button>
        <button type="button" onClick={onResults} disabled={!hasBracket} className="rounded-xl bg-[#0a1628] px-5 py-3 text-sm font-bold text-white disabled:opacity-40">Vai a Partite e risultati →</button>
      </div>
      <details className="mt-5 border-t border-slate-100 pt-4"><summary className="cursor-pointer text-sm font-semibold text-slate-500">Azzeramenti</summary><p className="my-3 text-sm text-slate-500">L’eliminazione cancella tabellone e risultati della sola fase finale selezionata.</p><button type="button" onClick={onDelete} className="rounded-lg border border-red-200 px-4 py-2 text-sm font-bold text-red-700">Elimina tabellone</button></details>
    </section>
  </fieldset>;
}
