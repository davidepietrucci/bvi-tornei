import { DEFAULT_CIRCUIT_POINT_TABLE } from "@/app/utils/circuit";

const inputClass = "w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-3 font-bold text-sm text-[#0a1628] focus:outline-none focus:ring-2 focus:ring-[#0a1628]";

export default function CircuitFields({ value, onChange }) {
  const circuitRole = value.circuitRole || "";
  const pointTable = { ...DEFAULT_CIRCUIT_POINT_TABLE, ...(value.circuitPointTable || {}) };

  const updatePoint = (place, points) => {
    onChange({
      circuitPointTable: { ...pointTable, [place]: Number(points) || 0 },
    });
  };

  return (
    <section className="rounded-[1.8rem] border border-blue-100 bg-blue-50/50 p-5 md:p-6 space-y-4">
      <div>
        <h3 className="text-sm font-black text-[#0a1628] uppercase tracking-tight">Tour e qualificazione</h3>
        <p className="mt-1 text-xs font-medium text-gray-500">Usa lo stesso nome per collegare tutte le tappe e la finale. Ogni iscrizione al tour è individuale: un atleta per iscrizione.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Nome del tour</label>
          <input
            type="text"
            value={value.circuitName || ""}
            onChange={(event) => onChange({ circuitName: event.target.value })}
            placeholder="es. BVI Tour 2026"
            className={inputClass}
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Ruolo del torneo</label>
          <select
            value={circuitRole}
            onChange={(event) => onChange({ circuitRole: event.target.value })}
            className={inputClass}
          >
            <option value="">Torneo fuori dal tour</option>
            <option value="tappa">Tappa di qualificazione</option>
            <option value="finale">Finale del tour</option>
          </select>
        </div>
      </div>

      {(circuitRole === "tappa" || circuitRole === "finale") && (
        <div className="space-y-3">
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Punti per piazzamento</p>
            <p className="mt-1 text-xs text-gray-500">
              {circuitRole === "tappa"
                ? "I punti entrano in classifica quando la tappa è conclusa e lo staff assegna il piazzamento."
                : "I punti della finale appariranno sul profilo atleta; non cambiano la classifica che ha determinato i qualificati."}
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {Array.from({ length: 16 }, (_, index) => index + 1).map((place) => (
              <label key={place} className="rounded-xl bg-white p-2 border border-blue-100">
                <span className="block text-[9px] font-black text-gray-400 uppercase">{place}° posto</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={pointTable[place] ?? 0}
                  onChange={(event) => updatePoint(place, event.target.value)}
                  className="mt-1 w-full bg-transparent text-sm font-black text-[#0a1628] outline-none"
                  aria-label={`Punti per il ${place}° posto`}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {circuitRole === "finale" && (
        <div className="max-w-xs space-y-2">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Atleti qualificati</label>
          <input
            type="number"
            min="1"
            value={value.circuitQualifiers || ""}
            onChange={(event) => onChange({ circuitQualifiers: Number(event.target.value) || "" })}
            placeholder="es. 16"
            className={inputClass}
          />
          <p className="text-xs text-gray-500">La finale è individuale: può iscriversi ogni atleta entro il limite configurato, in base alla classifica del tour.</p>
        </div>
      )}
    </section>
  );
}
