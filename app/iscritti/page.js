"use client";

import { useState, useEffect, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { getTornei, getIscrizioni } from "@/app/utils/db";

function IscrittiContent() {
  const searchParams = useSearchParams();
  const tourParam = searchParams.get("tour");

  const [tornei, setTornei] = useState([]);
  const [selectedTorneoNome, setSelectedTorneoNome] = useState("");
  const [iscrizioni, setIscrizioni] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getTornei(), getIscrizioni()]).then(([allTornei, allIscrizioni]) => {
      setTornei(allTornei || []);
      setIscrizioni(allIscrizioni || []);

      let initial = "";
      if (tourParam) {
        let decoded = tourParam;
        try {
          decoded = decodeURIComponent(tourParam).toLowerCase().trim();
        } catch (e) {
          decoded = tourParam.toLowerCase().trim();
        }
        initial = tourParam;
        if (allTornei && allTornei.length > 0) {
          const match = allTornei.find((t) => {
            const tNome = (t.nome || "").toLowerCase().trim();
            return tNome === decoded || tNome.includes(decoded) || decoded.includes(tNome);
          });
          if (match) initial = match.nome;
        }
      } else if (allTornei && allTornei.length > 0) {
        initial = allTornei[0].nome;
      }
      setSelectedTorneoNome(initial);
      setLoading(false);
    });
  }, [tourParam]);

  const targetName = (selectedTorneoNome || "").toLowerCase().trim();

  const activeTorneo = tornei.find((t) => {
    const tNome = (t.nome || "").toLowerCase().trim();
    return tNome === targetName || tNome.includes(targetName) || targetName.includes(tNome);
  });

  const listTorneo = iscrizioni.filter((isc) => {
    const iscTorneo = (isc.torneo || "").toLowerCase().trim();
    if (!iscTorneo || !targetName) return false;
    return (
      iscTorneo === targetName ||
      iscTorneo.includes(targetName) ||
      targetName.includes(iscTorneo)
    );
  });

  const filteredList = listTorneo.filter((isc) =>
    (isc.giocatori || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleTorneoChange = (nome) => {
    setSelectedTorneoNome(nome);
    const newUrl = `/iscritti?tour=${encodeURIComponent(nome)}`;
    window.history.replaceState(null, "", newUrl);
  };

  return (
    <main className="min-h-screen" style={{ backgroundColor: "#f0f4ff" }}>
      {/* Header */}
      <header style={{ backgroundColor: "#0a1628" }} className="text-white py-4 px-8 flex justify-between items-center shadow-md">
        <a href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <Image src="/logo.png" alt="BVI Logo" width={45} height={45} className="rounded-full" />
          <h1 className="text-2xl font-bold" style={{ color: "#FFD700" }}>BVI Tornei</h1>
        </a>
        <a href="/" className="text-xs font-bold px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors">
          🏠 Home Page
        </a>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Title */}
        <div className="text-center mb-8">
          <span className="px-4 py-1 bg-blue-100 text-[#0a1628] text-xs font-black rounded-full uppercase tracking-wider inline-block mb-3">
            👥 Elenco Partecipanti
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-[#0a1628]">
            Coppie Iscritte
          </h2>
          <p className="text-sm font-medium text-gray-500 mt-2">
            Consulta le coppie attualmente iscritte ai tornei BVI
          </p>
        </div>

        {/* Tournament Selector */}
        {(tornei.length > 0 || selectedTorneoNome) && (
          <div className="bg-white p-6 rounded-3xl shadow-md border border-gray-100 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="w-full md:w-auto flex-1">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                Seleziona Torneo
              </label>
              <select
                value={selectedTorneoNome}
                onChange={(e) => handleTorneoChange(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-bold text-sm text-[#0a1628] focus:outline-none focus:ring-2 focus:ring-[#0a1628] focus:bg-white transition-all cursor-pointer"
              >
                {selectedTorneoNome && !tornei.some(t => t.nome === selectedTorneoNome) && (
                  <option value={selectedTorneoNome}>{selectedTorneoNome}</option>
                )}
                {tornei.map((t, idx) => (
                  <option key={idx} value={t.nome}>
                    {t.nome} ({t.categoria || 'Categoria Libera'}) - {t.stato || 'Iscrizioni Aperte'}
                  </option>
                ))}
              </select>
            </div>

            {activeTorneo && (
              <div className="flex gap-2 w-full md:w-auto">
                <span className="px-3.5 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl flex items-center gap-1.5">
                  📅 {activeTorneo.data}
                </span>
                {activeTorneo.location && (
                  <span className="px-3.5 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl flex items-center gap-1.5">
                    📍 {activeTorneo.location}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Content Box */}
        <div className="bg-white rounded-3xl shadow-md border border-gray-100 p-6">
          {/* Search bar */}
          <div className="mb-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="Cerca per nome giocatore o coppia..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a1628] focus:bg-white transition-all text-gray-800"
              />
            </div>
            <div className="px-4 py-2 bg-blue-50 text-[#0a1628] rounded-xl font-bold text-xs text-center self-center">
              Totale Iscritti: <span className="text-base font-black ml-1">{listTorneo.length}</span>
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="py-16 flex justify-center">
              <div className="w-10 h-10 border-4 border-[#0a1628] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : listTorneo.length === 0 ? (
            <div className="text-center py-16 text-gray-500 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <span className="text-5xl block mb-3">🏐</span>
              <h4 className="font-bold text-gray-800 text-lg">Nessuna coppia iscritta</h4>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                Non sono ancora presenti iscrizioni per questo torneo. Iscriviti subito!
              </p>
              {activeTorneo && (
                <a
                  href={`/iscrizioni?tour=${encodeURIComponent(activeTorneo.nome)}`}
                  className="inline-block mt-5 px-6 py-2.5 bg-[#0a1628] text-white font-bold text-xs rounded-xl hover:bg-opacity-90 transition-colors shadow-md"
                >
                  📋 Vai all'Iscrizione
                </a>
              )}
            </div>
          ) : filteredList.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-2xl">
              <p className="font-semibold text-sm">Nessuna coppia trovata per "{search}"</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden">
              {filteredList.map((isc, index) => (
                <div
                  key={isc.id || index}
                  className="p-4 sm:p-5 flex items-center justify-between gap-4 bg-white hover:bg-gray-50/80 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="w-10 h-10 rounded-2xl bg-blue-50 text-[#0a1628] font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                      #{index + 1}
                    </span>
                    <h4 className="font-black text-gray-900 text-base sm:text-lg leading-tight truncate">
                      {isc.giocatori || "Coppia non specificata"}
                    </h4>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function IscrittiPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f0f4ff] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#0a1628] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <IscrittiContent />
    </Suspense>
  );
}
