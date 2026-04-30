"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function AtletaGironi() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [torneiAttivi, setTorneiAttivi] = useState([]);
  const [selectedTorneo, setSelectedTorneo] = useState("");
  const [config, setConfig] = useState(null);
  const [bracketConfig, setBracketConfig] = useState(null);

  const nomeAtleta = session?.user?.name || "Davide P.";

  useEffect(() => {
    if (status === "unauthenticated" && localStorage.getItem("bvi_atleta_logged_in") !== "true") {
      router.push("/atleta"); return;
    }
    const savedTornei = localStorage.getItem("bvi_tornei");
    if (savedTornei) {
      const parsed = JSON.parse(savedTornei);
      const attivi = parsed.filter(t => t.stato === "Iscrizioni Aperte" || t.stato === "In Programmazione");
      setTorneiAttivi(attivi);
      if (attivi.length > 0) setSelectedTorneo(attivi[0].nome);
    }
  }, [router, status]);

  useEffect(() => {
    if (!selectedTorneo) return;
    const key = `bvi_gironi_v2_${selectedTorneo.toLowerCase().trim().replace(/\s+/g, '_')}`;
    const saved = localStorage.getItem(key);
    if (saved) setConfig(JSON.parse(saved)); else setConfig(null);

    const bKey = `bvi_bracket_v1_${selectedTorneo.toLowerCase().trim().replace(/\s+/g, '_')}`;
    const bSaved = localStorage.getItem(bKey);
    if (bSaved) setBracketConfig(JSON.parse(bSaved)); else setBracketConfig(null);
  }, [selectedTorneo]);

  const getWinner = (gid, mIdx) => {
    if (!config) return `Vincente G${mIdx+1}`;
    const assignments = config.gironeAssignments[gid];
    const metadata = config.matchMetadata || {};
    const meta = metadata[`${gid}-${mIdx}`];
    const getName = (idx) => assignments[idx] || `Slot ${idx + 1}`;
    
    if (!meta) return `Vincente G${mIdx+1}`;
    const s1L = parseInt(meta.s1L||0), s1R = parseInt(meta.s1R||0);
    if (s1L === 0 && s1R === 0) return `Vincente G${mIdx+1}`;
    if (mIdx === 0) return s1L > s1R ? getName(0) : getName(3);
    if (mIdx === 1) return s1L > s1R ? getName(1) : getName(2);
    return "TBD";
  };

  const getLoser = (gid, mIdx) => {
    if (!config) return `Perdente G${mIdx+1}`;
    const assignments = config.gironeAssignments[gid];
    const metadata = config.matchMetadata || {};
    const meta = metadata[`${gid}-${mIdx}`];
    const getName = (idx) => assignments[idx] || `Slot ${idx + 1}`;
    
    if (!meta) return `Perdente G${mIdx+1}`;
    const s1L = parseInt(meta.s1L||0), s1R = parseInt(meta.s1R||0);
    if (s1L === 0 && s1R === 0) return `Perdente G${mIdx+1}`;
    if (mIdx === 0) return s1L > s1R ? getName(3) : getName(0);
    if (mIdx === 1) return s1L > s1R ? getName(2) : getName(1);
    return "TBD";
  };

  const getGironeMatches = (gid) => {
    if (!config || !config.gironeAssignments[gid]) return [];
    const assignments = config.gironeAssignments[gid];
    const metadata = config.matchMetadata || {};
    const getName = (idx) => assignments[idx] || `Slot ${idx + 1}`;

    return [
        { left: getName(0), right: getName(3), label: "Gara 1", meta: metadata[`${gid}-0`] },
        { left: getName(1), right: getName(2), label: "Gara 2", meta: metadata[`${gid}-1`] },
        { left: getWinner(gid, 0), right: getWinner(gid, 1), label: "Finale Vincenti", meta: metadata[`${gid}-2`] },
        { left: getLoser(gid, 0), right: getLoser(gid, 1), label: "Finale Perdenti", meta: metadata[`${gid}-3`] }
    ];
  };

  const getAllBracketMatches = () => {
    if (!bracketConfig || !bracketConfig.bracketAssignments) return [];
    const assignments = bracketConfig.bracketAssignments;
    const metadata = bracketConfig.bracketMetadata || {};
    const matchIds = Object.keys(assignments).map(k => k.replace(/-L$|-R$/, '')).filter((v, i, a) => a.indexOf(v) === i);
    return matchIds.map(mid => ({
        id: mid, label: mid.toUpperCase(), left: assignments[`${mid}-L`], right: assignments[`${mid}-R`],
        scoreL: metadata[mid]?.scoreL, scoreR: metadata[mid]?.scoreR, time: metadata[mid]?.time, court: metadata[mid]?.court
    }));
  };

  const gironiIds = config ? Array.from({ length: config.numGironi || 0 }, (_, i) => String.fromCharCode(65 + i)) : [];
  const bracketMatches = getAllBracketMatches();
  const isMe = (name) => name?.toLowerCase().includes(nomeAtleta.toLowerCase());

  return (
    <main className="min-h-screen pb-10 bg-[#f0f4ff] text-[#0a1628]">
      {/* Header Mobile Optimized */}
      <header className="bg-white py-3 px-4 md:px-8 flex justify-between items-center shadow-md border-b-4 border-[#FFD700] sticky top-0 z-50">
        <div className="flex items-center gap-3 md:gap-6">
          <Image src="/logo.png" alt="BVI" width={40} height={40} className="md:w-[50px] md:h-[50px]" />
          <nav className="flex gap-1 overflow-x-auto no-scrollbar max-w-[200px] sm:max-w-none">
            <a href="/atleta/dashboard" className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 whitespace-nowrap">Dashboard</a>
            <a href="/atleta/gironi" className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-50 text-[#0a1628] whitespace-nowrap">Match</a>
          </nav>
        </div>
        <button onClick={() => router.push("/")} className="text-red-500 font-black text-xs uppercase tracking-widest">Esci</button>
      </header>

      <div className="max-w-5xl mx-auto mt-6 md:mt-10 px-4">
        {/* Title Section Mobile Optimized */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
            <div>
                <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter leading-none">Calendario 🏐</h2>
                <p className="text-[10px] md:text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">Tutti i gironi e tabelloni</p>
            </div>
            <select className="w-full sm:w-auto bg-white border-2 border-gray-200 rounded-xl px-4 py-3 font-bold shadow-sm focus:border-[#0a1628] outline-none" value={selectedTorneo} onChange={e=>setSelectedTorneo(e.target.value)}>
                {torneiAttivi.map(t=><option key={t.id} value={t.nome}>{t.nome}</option>)}
            </select>
        </div>

        <div className="space-y-10 md:space-y-16">
            {/* Gironi Section */}
            {gironiIds.map(gid => (
                <section key={gid} className="bg-white/50 p-5 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-white shadow-sm">
                    <h3 className="text-xl md:text-2xl font-black uppercase mb-6 flex items-center gap-3">
                        <span className="w-10 h-10 md:w-12 md:h-12 bg-[#0a1628] text-[#FFD700] rounded-xl md:rounded-2xl flex items-center justify-center text-lg md:text-xl shadow-lg">G</span>
                        GIRONE {gid}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        {getGironeMatches(gid).map((m, i) => (
                            <div key={i} className={`bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border-l-4 md:border-l-8 transition-all ${isMe(m.left) || isMe(m.right) ? 'border-[#FFD700] ring-4 ring-[#FFD700]/10' : 'border-blue-600'}`}>
                                <span className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-widest">{m.label}</span>
                                <div className="flex justify-between items-center mt-2">
                                    <div className="space-y-1 flex-1 min-w-0 pr-2">
                                        <p className={`font-bold text-sm md:text-base truncate ${isMe(m.left) ? 'text-blue-600 underline' : ''}`}>{m.left}</p>
                                        <p className="text-[8px] md:text-[10px] font-black text-gray-300">VS</p>
                                        <p className={`font-bold text-sm md:text-base truncate ${isMe(m.right) ? 'text-blue-600 underline' : ''}`}>{m.right}</p>
                                    </div>
                                    <div className="text-right flex flex-col items-end">
                                        {m.meta?.s1L || m.meta?.s1R ? (
                                            <p className="text-xl md:text-2xl font-black">{m.meta.s1L}-{m.meta.s1R}</p>
                                        ) : (
                                            <span className="text-[8px] md:text-[9px] font-black px-2 py-1 bg-gray-50 rounded-full text-gray-300 border">DA GIOCARE</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            ))}

            {/* Tabellone Section Mobile Optimized */}
            {bracketMatches.length > 0 && (
                <section className="bg-[#0a1628] p-6 md:p-10 rounded-[2.5rem] md:rounded-[4rem] text-white shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#FFD700]/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                    <h3 className="text-2xl md:text-3xl font-black text-[#FFD700] uppercase mb-8 text-center tracking-tight">FASI FINALI ⚔️</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                        {bracketMatches.map((m, i) => (
                            <div key={i} className={`p-4 md:p-6 rounded-2xl md:rounded-3xl border transition-all ${isMe(m.left) || isMe(m.right) ? 'bg-[#FFD700]/10 border-[#FFD700]' : 'bg-white/5 border-white/10'}`}>
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-[9px] md:text-[10px] font-black text-[#FFD700] uppercase tracking-widest">{m.label}</span>
                                    <span className="text-[9px] md:text-[10px] font-bold text-white/40">{m.time || "--:--"} • {m.court ? `C.${m.court}` : 'TBD'}</span>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className={`font-bold text-xs md:text-sm truncate pr-2 ${isMe(m.left) ? 'text-[#FFD700]' : ''}`}>{m.left || "TBD"}</span>
                                        <span className="font-black text-sm md:text-base">{m.scoreL || 0}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className={`font-bold text-xs md:text-sm truncate pr-2 ${isMe(m.right) ? 'text-[#FFD700]' : ''}`}>{m.right || "TBD"}</span>
                                        <span className="font-black text-sm md:text-base">{m.scoreR || 0}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
      </div>
      
      {/* Mobile Sticky CTA if useful (opzionale) */}
      <div className="fixed bottom-4 right-4 sm:hidden">
          <button onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} className="w-12 h-12 bg-[#0a1628] text-[#FFD700] rounded-full shadow-2xl flex items-center justify-center text-xl border-2 border-[#FFD700]">
            ↑
          </button>
      </div>
    </main>
  );
}
