"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

export default function GironiPubblici() {
  const [tornei, setTornei] = useState([]);
  const [selectedTorneo, setSelectedTorneo] = useState("");
  const [activeGirone, setActiveGirone] = useState("A");
  const [config, setConfig] = useState(null);

  const getConfigKey = (nomeTorneo) => {
    if (!nomeTorneo) return "";
    return `bvi_gironi_v2_${nomeTorneo.toLowerCase().trim().replace(/\s+/g, '_')}`;
  };

  useEffect(() => {
    const savedTornei = localStorage.getItem("bvi_tornei");
    if (savedTornei) {
      const parsed = JSON.parse(savedTornei);
      const attivi = parsed.filter(t => t.stato === "Iscrizioni Aperte" || t.stato === "In Programmazione");
      setTornei(attivi);
      if (attivi.length > 0) setSelectedTorneo(attivi[0].nome);
    }
  }, []);

  useEffect(() => {
    if (!selectedTorneo) return;
    const configKey = getConfigKey(selectedTorneo);
    const savedConfig = localStorage.getItem(configKey);
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    } else {
      setConfig(null);
    }
  }, [selectedTorneo]);

  const gironiDisponibili = config ? Array.from({ length: config.numGironi || 0 }, (_, i) => String.fromCharCode(65 + i)) : [];

  const getSchedule = (numTeams, gironeId, assignments = {}) => {
    const getName = (idx) => assignments[idx] && assignments[idx] !== "—" && assignments[idx] !== "Slot Libero" ? assignments[idx] : `Slot ${idx + 1}`;
    const type = config?.gironeTypes?.[gironeId] || "Pool";
    if (!numTeams || numTeams < 2) return [];

    if (type === "Girone all'italiana") {
      const rrMatches = [];
      for (let i = 0; i < numTeams; i++) {
        for (let j = i + 1; j < numTeams; j++) {
          rrMatches.push({ left: getName(i), right: getName(j) });
        }
      }
      return rrMatches;
    }

    if (numTeams === 2) return [{ left: getName(0), right: getName(1) }];
    if (numTeams === 3) return [
      { left: getName(0), right: getName(2) },
      { left: getName(1), right: getName(2) },
      { left: getName(0), right: getName(1) }
    ];
    if (numTeams === 4) return [
      { left: getName(0), right: getName(3) },
      { left: getName(1), right: getName(2) },
      { left: 'Vincente G1', right: 'Vincente G2' },
      { left: 'Perdente G1', right: 'Perdente G2' }
    ];
    if (numTeams === 5) return [
      { left: getName(0), right: getName(4) },
      { left: getName(1), right: getName(3) },
      { left: getName(2), right: getName(4) },
      { left: getName(0), right: getName(1) },
      { left: getName(2), right: getName(3) }
    ];
    return [];
  };

  const schedule = config ? getSchedule(config.teamCounts[activeGirone], activeGirone, config.gironeAssignments[activeGirone] || {}) : [];
  const matchMetadata = config?.matchMetadata || {};
  const gironeSets = config?.gironeSets || {};

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      {/* Navbar Semplice */}
      <header style={{backgroundColor: "#0a1628"}} className="text-white py-4 px-6 flex justify-between items-center shadow-md border-b-2 border-[#FFD700]">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="BVI Logo" width={40} height={40} />
          <h1 className="text-xl font-bold tracking-tight">BVI Tornei</h1>
        </div>
        <a href="/" className="text-sm font-bold bg-[#FFD700] text-[#0a1628] px-4 py-1.5 rounded-full hover:bg-yellow-500">HOME</a>
      </header>

      <div className="max-w-4xl mx-auto mt-8 px-4">
        {/* Header Sezione */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-4">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Torneo Attivo
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-[#0a1628] uppercase tracking-tighter">{selectedTorneo || "Nessun Torneo"}</h2>
          <p className="text-gray-500 font-bold mt-2 uppercase text-xs tracking-[0.3em]">Gironi & Calendario</p>
        </div>

        {config ? (
          <>
            {/* Tab Gironi */}
            <div className="flex gap-2 mb-8 overflow-x-auto pb-2 justify-center">
              {gironiDisponibili.map(g => (
                <button
                  key={g}
                  onClick={() => setActiveGirone(g)}
                  className={`px-6 py-3 rounded-xl font-black transition-all ${
                    activeGirone === g 
                    ? 'bg-[#0a1628] text-white shadow-lg' 
                    : 'bg-white text-gray-400 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  GIRONE {g}
                </button>
              ))}
            </div>

            {/* Info Girone */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-8 flex justify-around text-center">
                <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Modalità</p>
                    <p className="font-bold text-[#0a1628]">{config.gironeTypes[activeGirone]}</p>
                </div>
                <div className="border-x border-gray-100 px-8">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Formula</p>
                    <p className="font-bold text-[#0a1628]">{config.gironeSets[activeGirone]}</p>
                </div>
                <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Squadre</p>
                    <p className="font-bold text-[#0a1628]">{config.teamCounts[activeGirone]}</p>
                </div>
            </div>

            {/* Schedule */}
            <div className="space-y-4">
              {schedule.length > 0 ? schedule.map((match, idx) => {
                const meta = matchMetadata[`${activeGirone}-${idx}`] || {};
                const s1L = parseInt(meta.s1L || 0);
                const s1R = parseInt(meta.s1R || 0);
                const s2L = parseInt(meta.s2L || 0);
                const s2R = parseInt(meta.s2R || 0);
                const s3L = parseInt(meta.s3L || 0);
                const s3R = parseInt(meta.s3R || 0);

                return (
                  <div key={idx} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-6">
                    {/* Time & Court Info */}
                    <div className="flex flex-row md:flex-col items-center gap-2 min-w-[100px]">
                        <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-black">{meta.time || "--:--"}</span>
                        <span className="bg-yellow-50 text-yellow-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                            {meta.court ? `CAMPO ${meta.court}` : "TBD"}
                        </span>
                    </div>

                    {/* Match Result */}
                    <div className="flex-1 flex items-center justify-between gap-4 w-full">
                        <span className="flex-1 text-right font-bold text-[#0a1628] truncate">{match.left}</span>
                        
                        <div className="flex items-center gap-2">
                            {/* Set 1 */}
                            <div className="flex items-center gap-1 bg-[#0a1628] text-white px-3 py-2 rounded-xl font-black text-lg min-w-[65px] justify-center">
                                <span className={s1L > s1R ? 'text-[#FFD700]' : ''}>{s1L}</span>
                                <span className="opacity-30">:</span>
                                <span className={s1R > s1L ? 'text-[#FFD700]' : ''}>{s1R}</span>
                            </div>
                            {/* Multi-set support */}
                            {gironeSets[activeGirone] === "3 set" && (
                                <>
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-lg text-xs font-bold text-gray-600">
                                            <span className={s2L > s2R ? 'text-blue-600' : ''}>{s2L}</span>
                                            <span className="opacity-30">:</span>
                                            <span className={s2R > s2L ? 'text-blue-600' : ''}>{s2R}</span>
                                        </div>
                                        <div className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-lg text-xs font-bold text-gray-600">
                                            <span className={s3L > s3R ? 'text-blue-600' : ''}>{s3L}</span>
                                            <span className="opacity-30">:</span>
                                            <span className={s3R > s3L ? 'text-blue-600' : ''}>{s3R}</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <span className="flex-1 text-left font-bold text-[#0a1628] truncate">{match.right}</span>
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                    <p className="text-gray-400 font-bold italic">Nessuna partita schedulata per questo girone.</p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-20 bg-white rounded-3xl shadow-sm">
            <p className="text-gray-400 font-bold italic">Configurazione non disponibile per questo torneo.</p>
          </div>
        )}
      </div>
    </main>
  );
}
