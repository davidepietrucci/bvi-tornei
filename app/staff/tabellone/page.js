"use client";

import Image from "next/image";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function TabelloneContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTour = searchParams.get("tour");

  const [torneiAttivi, setTorneiAttivi] = useState([]);
  const [selectedTorneo, setSelectedTorneo] = useState("");
  const [phaseType, setPhaseType] = useState("double");
  const [bracketSize, setBracketSize] = useState(8); 
  const [bracketAssignments, setBracketAssignments] = useState({});
  const [bracketMetadata, setBracketMetadata] = useState({});

  useEffect(() => {
    const savedTornei = localStorage.getItem("bvi_tornei");
    if (savedTornei) {
      const parsed = JSON.parse(savedTornei);
      const attivi = parsed.filter(t => t.stato === "Iscrizioni Aperte" || t.stato === "In Programmazione");
      setTorneiAttivi(attivi);
      if (urlTour && attivi.some(t => t.nome === urlTour)) setSelectedTorneo(urlTour);
      else if (attivi.length > 0) setSelectedTorneo(attivi[0].nome);
    }
  }, [urlTour]);

  useEffect(() => {
    if (!selectedTorneo) return;
    const configKey = `bvi_bracket_v1_${selectedTorneo.toLowerCase().trim().replace(/\s+/g, '_')}`;
    const savedConfig = localStorage.getItem(configKey);
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      setPhaseType(config.phaseType || "double");
      setBracketSize(config.bracketSize || 8);
      setBracketAssignments(config.bracketAssignments || {});
      setBracketMetadata(config.bracketMetadata || {});
    } else {
      setPhaseType("double"); setBracketSize(8); setBracketAssignments({}); setBracketMetadata({});
    }
  }, [selectedTorneo]);

  // Logica di progressione automatica dei vincitori
  useEffect(() => {
    const newAssignments = { ...bracketAssignments };
    let changed = false;

    const resolveWinner = (matchId) => {
      const meta = bracketMetadata[matchId] || {};
      const scoreL = parseInt(meta.scoreL || 0);
      const scoreR = parseInt(meta.scoreR || 0);
      if (scoreL === 0 && scoreR === 0) return null;
      return scoreL > scoreR ? bracketAssignments[`${matchId}-L`] : bracketAssignments[`${matchId}-R`];
    };

    const resolveLoser = (matchId) => {
      const meta = bracketMetadata[matchId] || {};
      const scoreL = parseInt(meta.scoreL || 0);
      const scoreR = parseInt(meta.scoreR || 0);
      if (scoreL === 0 && scoreR === 0) return null;
      return scoreL > scoreR ? bracketAssignments[`${matchId}-R`] : bracketAssignments[`${matchId}-L`];
    };

    const update = (targetKey, value) => {
      if (value && newAssignments[targetKey] !== value) {
        newAssignments[targetKey] = value;
        changed = true;
      }
    };

    // Progressione per Gold & Silver
    ["gold", "silver"].forEach(p => {
        // Quarti -> Semi
        update(`${p}-s1-L`, resolveWinner(`${p}-q1`));
        update(`${p}-s1-R`, resolveWinner(`${p}-q2`));
        update(`${p}-s2-L`, resolveWinner(`${p}-q3`));
        update(`${p}-s2-R`, resolveWinner(`${p}-q4`));
        // Semi -> Finale 1/2
        update(`${p}-f1-L`, resolveWinner(`${p}-s1`));
        update(`${p}-f1-R`, resolveWinner(`${p}-s2`));
        // Semi -> Finale 3/4
        update(`${p}-f3-L`, resolveLoser(`${p}-s1`));
        update(`${p}-f3-R`, resolveLoser(`${p}-s2`));
    });

    // Progressione per Double Elimination
    // WB
    update(`wb-s1-L`, resolveWinner(`wb-q1`)); update(`wb-s1-R`, resolveWinner(`wb-q2`));
    update(`wb-s2-L`, resolveWinner(`wb-q3`)); update(`wb-s2-R`, resolveWinner(`wb-q4`));
    update(`wb-f-L`, resolveWinner(`wb-s1`)); update(`wb-f-R`, resolveWinner(`wb-s2`));
    // LB (Semplificato)
    update(`lb-f-L`, resolveWinner(`lb-s1`)); update(`lb-f-R`, resolveWinner(`lb-s2`));
    // Grand Final
    update(`grand-final-L`, resolveWinner(`wb-f`));
    update(`grand-final-R`, resolveWinner(`lb-f`));

    if (changed) setBracketAssignments(newAssignments);
  }, [bracketMetadata, bracketAssignments]);

  const handleAutoFill = () => {
    const gKey = `bvi_gironi_v2_${selectedTorneo.toLowerCase().trim().replace(/\s+/g, '_')}`;
    const gData = localStorage.getItem(gKey);
    if (!gData) { alert("Nessuna configurazione gironi!"); return; }
    const gConfig = JSON.parse(gData);
    const numGironi = gConfig.numGironi || 0;
    const newAssignments = { ...bracketAssignments };
    
    const getRanking = (gid) => {
        const teams = gConfig.gironeAssignments[gid] || {};
        const meta = gConfig.matchMetadata || {};
        const stats = {};
        for(let i=0; i<(gConfig.teamCounts[gid]||0); i++) {
            const n = teams[i]; if(n && n!=="—") stats[n] = { nome: n, punti: 0, pf: 0, ps: 0 };
        }
        // Calcolo base (G1/G2)
        for(let i=0; i<2; i++) {
            const m = meta[`${gid}-${i}`]; if(!m) continue;
            const l = i===0?teams[0]:teams[1], r = i===0?teams[3]:teams[2];
            if(!stats[l] || !stats[r]) continue;
            const sl = parseInt(m.s1L||0), sr = parseInt(m.s1R||0);
            if(sl===0 && sr===0) continue;
            stats[l].pf += sl; stats[r].pf += sr; stats[l].ps += sr; stats[r].ps += sl;
            if(sl>sr) stats[l].punti++; else stats[r].punti++;
        }
        return Object.values(stats).sort((a,b) => b.punti-a.punti || (b.pf-b.ps)-(a.pf-a.ps)).map(s=>s.nome);
    };

    const rankings = {};
    for(let i=0; i<numGironi; i++) { const gid = String.fromCharCode(65+i); rankings[gid] = getRanking(gid); }
    const getRanked = (gid, pos) => rankings[gid]?.[pos] || `TBD ${pos+1}° ${gid}`;

    if (numGironi === 2) {
        setBracketSize(4);
        const p = phaseType === "gold_silver" ? "gold" : "wb";
        newAssignments[`${p}-s1-L`] = getRanked('A', 0); newAssignments[`${p}-s1-R`] = getRanked('B', 1);
        newAssignments[`${p}-s2-L`] = getRanked('B', 0); newAssignments[`${p}-s2-R`] = getRanked('A', 1);
        if (phaseType === "gold_silver") {
            newAssignments['silver-s1-L'] = getRanked('A', 2); newAssignments['silver-s1-R'] = getRanked('B', 3);
            newAssignments['silver-s2-L'] = getRanked('B', 2); newAssignments['silver-s2-R'] = getRanked('A', 3);
        }
    } else if (numGironi === 4) {
        setBracketSize(8);
        const p = phaseType === "gold_silver" ? "gold" : "wb";
        newAssignments[`${p}-q1-L`] = getRanked('A', 0); newAssignments[`${p}-q1-R`] = getRanked('B', 1);
        newAssignments[`${p}-q2-L`] = getRanked('C', 0); newAssignments[`${p}-q2-R`] = getRanked('D', 1);
        newAssignments[`${p}-q3-L`] = getRanked('B', 0); newAssignments[`${p}-q3-R`] = getRanked('A', 1);
        newAssignments[`${p}-q4-L`] = getRanked('D', 0); newAssignments[`${p}-q4-R`] = getRanked('C', 1);
        if (phaseType === "gold_silver") {
            newAssignments['silver-q1-L'] = getRanked('A', 2); newAssignments['silver-q1-R'] = getRanked('B', 3);
            newAssignments['silver-q2-L'] = getRanked('C', 2); newAssignments['silver-q2-R'] = getRanked('D', 3);
            newAssignments['silver-q3-L'] = getRanked('B', 2); newAssignments['silver-q3-R'] = getRanked('A', 3);
            newAssignments['silver-q4-L'] = getRanked('D', 2); newAssignments['silver-q4-R'] = getRanked('C', 3);
        }
    }

    setBracketAssignments(newAssignments);
    alert(`Tabellone generato da Classifica! 🏆`);
  };

  const handleSave = () => {
    const configKey = `bvi_bracket_v1_${selectedTorneo.toLowerCase().trim().replace(/\s+/g, '_')}`;
    localStorage.setItem(configKey, JSON.stringify({ phaseType, bracketSize, bracketAssignments, bracketMetadata }));
    alert(`Salvataggio completato! 🏆`);
  };

  const handleMetadataChange = (matchId, field, value) => {
    setBracketMetadata(prev => ({ ...prev, [matchId]: { ...(prev[matchId] || {}), [field]: value } }));
  };

  const renderMatch = (matchId, label, color = "blue") => {
    const meta = bracketMetadata[matchId] || {};
    const borderClass = color === "gold" ? "hover:border-yellow-500" : color === "silver" ? "hover:border-gray-400" : "hover:border-blue-600";
    return (
      <div className={`bg-white border-2 border-gray-100 rounded-xl p-4 shadow-sm group ${borderClass} transition-all`}>
        <div className="flex justify-between items-center mb-3">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
          <div className="flex gap-2">
            <input type="text" placeholder="Ora" value={meta.time || ""} onChange={(e) => handleMetadataChange(matchId, 'time', e.target.value)} className="w-12 text-[10px] border border-gray-200 rounded px-1 py-0.5 text-center focus:outline-none" />
            <input type="text" placeholder="C." value={meta.court || ""} onChange={(e) => handleMetadataChange(matchId, 'court', e.target.value)} className="w-8 text-[10px] border border-gray-200 rounded px-1 py-0.5 text-center focus:outline-none" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input type="text" placeholder="Team A" value={bracketAssignments[`${matchId}-L`] || ""} onChange={(e) => setBracketAssignments(p => ({...p, [`${matchId}-L`]: e.target.value}))} className="flex-1 text-xs font-bold border-b border-gray-100 outline-none py-1" />
            <input type="text" placeholder="-" value={meta.scoreL || ""} onChange={(e) => handleMetadataChange(matchId, 'scoreL', e.target.value)} className="w-8 h-8 bg-gray-50 rounded text-center text-xs font-black focus:bg-[#0a1628] focus:text-white" />
          </div>
          <div className="flex items-center gap-2">
            <input type="text" placeholder="Team B" value={bracketAssignments[`${matchId}-R`] || ""} onChange={(e) => setBracketAssignments(p => ({...p, [`${matchId}-R`]: e.target.value}))} className="flex-1 text-xs font-bold border-b border-gray-100 outline-none py-1" />
            <input type="text" placeholder="-" value={meta.scoreR || ""} onChange={(e) => handleMetadataChange(matchId, 'scoreR', e.target.value)} className="w-8 h-8 bg-gray-50 rounded text-center text-xs font-black focus:bg-[#0a1628] focus:text-white" />
          </div>
        </div>
      </div>
    );
  };

  const renderSection = (p, title, color) => (
    <div className="mb-16">
      <h3 className={`text-2xl font-black uppercase mb-8 ${color==='gold'?'text-yellow-600':color==='silver'?'text-gray-500':'text-blue-600'}`}>{title}</h3>
      {bracketSize===8 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          {renderMatch(`${p}-q1`,'M1',color)} {renderMatch(`${p}-q2`,'M2',color)} {renderMatch(`${p}-q3`,'M3',color)} {renderMatch(`${p}-q4`,'M4',color)}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mb-10">
        {renderMatch(`${p}-s1`,'S1',color)} {renderMatch(`${p}-s2`,'S2',color)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
        <div><h4 className="text-[10px] font-black text-red-400 mb-2 uppercase">Finale 3°/4°</h4>{renderMatch(`${p}-f3`,'BRONZO',color)}</div>
        <div><h4 className="text-[10px] font-black text-yellow-500 mb-2 uppercase">Finale 1°/2°</h4>{renderMatch(`${p}-f1`,'ORO',color)}</div>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen pb-20 bg-[#f8faff]">
      <header className="bg-white py-4 px-8 flex justify-between items-center shadow-md border-b-4 border-[#0a1628]">
        <div className="flex items-center gap-6">
          <Image src="/logo.png" alt="BVI" width={50} height={50} />
          <nav className="flex gap-2 bg-gray-50 p-1 rounded-xl border">
            <a href="/staff/dashboard" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Dashboard</a>
            <a href="/staff/iscrizioni" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Iscrizioni</a>
            <a href="/staff/tornei" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Tornei</a>
            <a href="/staff/gironi" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Gironi</a>
            <a href="/staff/classifica" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Classifica</a>
            <a href="/staff/tabellone" className="px-4 py-2 rounded-lg text-sm font-bold bg-white text-[#0a1628] shadow-sm border border-gray-200 transition-all whitespace-nowrap">Tabellone</a>
            <a href="/staff/atleti" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Anagrafica Atleti</a>
            <a href="/staff/pagamenti" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Pagamenti</a>
          </nav>
        </div>
        <a href="/" className="font-bold text-red-500 text-sm">Esci</a>
      </header>

      <div className="max-w-7xl mx-auto mt-10 px-4">
        <div className="flex justify-between items-center mb-12">
            <div><h2 className="text-4xl font-black text-[#0a1628] uppercase tracking-tighter">Tabellone ⚔️</h2><p className="text-[10px] font-bold text-blue-500 uppercase">Progressione Automatica Vincitori</p></div>
            <div className="flex gap-4">
                <select className="bg-white border-2 rounded-xl px-4 py-2 font-bold text-[#0a1628]" value={phaseType} onChange={e=>setPhaseType(e.target.value)}><option value="double">Doppia Elim.</option><option value="gold_silver">Gold & Silver</option></select>
                <button onClick={handleAutoFill} className="bg-[#FFD700] border-2 border-[#0a1628] text-[#0a1628] px-6 py-2 rounded-xl font-black shadow-md hover:scale-105 transition-all">🔄 GENERA</button>
                <button onClick={handleSave} className="bg-[#0a1628] text-[#FFD700] px-8 py-2 rounded-xl font-black shadow-lg">SALVA TUTTO</button>
            </div>
        </div>

        {phaseType === "double" ? (
            <div className="space-y-16">
                {renderSection("wb", "Winners Bracket 🏆", "blue")}
                <div className="bg-gray-100/50 p-8 rounded-[3rem] border">{renderSection("lb", "Losers Bracket 🔄", "silver")}</div>
                <section className="bg-[#0a1628] p-10 rounded-[3rem] text-white shadow-2xl">
                    <h3 className="text-3xl font-black text-[#FFD700] uppercase mb-8 text-center">GRAND FINAL 👑</h3>
                    <div className="max-w-xl mx-auto">{renderMatch('grand-final', 'Finalissima', 'gold')}</div>
                </section>
            </div>
        ) : (
            <div className="space-y-16">
                {renderSection("gold", "🏆 Tabellone GOLD", "gold")}
                <div className="border-t-2 border-dashed border-gray-200 my-10"></div>
                {renderSection("silver", "🥈 Tabellone SILVER", "silver")}
            </div>
        )}
      </div>
    </main>
  );
}

export default function StaffTabellone() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Caricamento...</div>}>
      <TabelloneContent />
    </Suspense>
  );
}
