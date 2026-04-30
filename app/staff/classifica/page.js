"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function StaffClassifica() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTour = searchParams.get("tour");

  const [tornei, setTornei] = useState([]);
  const [selectedTorneo, setSelectedTorneo] = useState("");
  const [activeGirone, setActiveGirone] = useState("A");
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const savedTornei = localStorage.getItem("bvi_tornei");
    if (savedTornei) {
      const parsed = JSON.parse(savedTornei);
      const attivi = parsed.filter(t => t.stato === "Iscrizioni Aperte" || t.stato === "In Programmazione");
      setTornei(attivi);
      
      if (urlTour && attivi.some(t => t.nome === urlTour)) {
        setSelectedTorneo(urlTour);
      } else if (attivi.length > 0) {
        setSelectedTorneo(attivi[0].nome);
      }
    }
  }, [urlTour]);

  useEffect(() => {
    if (!selectedTorneo) return;
    const configKey = `bvi_gironi_v2_${selectedTorneo.toLowerCase().trim().replace(/\s+/g, '_')}`;
    const savedConfig = localStorage.getItem(configKey);
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    } else {
      setConfig(null);
    }
  }, [selectedTorneo]);

  const calculateRanking = () => {
    if (!config || !config.gironeAssignments || !config.gironeAssignments[activeGirone]) return [];
    const assignments = config.gironeAssignments[activeGirone];
    const teamCount = config.teamCounts[activeGirone] || 0;
    const metadata = config.matchMetadata || {};
    const isThreeSets = config.gironeSets?.[activeGirone] === "3 set";

    const stats = {};
    for (let i = 0; i < teamCount; i++) {
      const name = assignments[i];
      if (name && name !== "—" && name !== "Slot Libero") {
        stats[name] = { nome: name, giocate: 0, vinte: 0, perse: 0, setVinti: 0, setPersi: 0, puntiFatti: 0, puntiSubiti: 0, score: 0 };
      }
    }

    // Risoluzione dei nomi basata sui match (semplificata per 4 team pool)
    for (let i = 0; i < 20; i++) {
        const meta = metadata[`${activeGirone}-${i}`];
        if (!meta) continue;
        
        let teamL = "", teamR = "";
        if (i === 0) { teamL = assignments[0]; teamR = assignments[3]; }
        else if (i === 1) { teamL = assignments[1]; teamR = assignments[2]; }
        // Se i nomi non sono fissi (match 2, 3), servirebbe la logica dinamica. 
        // Per ora calcoliamo solo sui match risolti.
        
        if (!stats[teamL] || !stats[teamR]) continue;

        const s1L = parseInt(meta.s1L || 0), s1R = parseInt(meta.s1R || 0);
        const s2L = parseInt(meta.s2L || 0), s2R = parseInt(meta.s2R || 0);
        const s3L = parseInt(meta.s3L || 0), s3R = parseInt(meta.s3R || 0);

        if (s1L === 0 && s1R === 0) continue;

        stats[teamL].giocate++; stats[teamR].giocate++;
        stats[teamL].puntiFatti += (s1L + s2L + s3L);
        stats[teamL].puntiSubiti += (s1R + s2R + s3R);
        stats[teamR].puntiFatti += (s1R + s2R + s3R);
        stats[teamR].puntiSubiti += (s1L + s2L + s3L);
        
        let matchWinL = 0;
        if (isThreeSets) {
            let setsL = 0, setsR = 0;
            if (s1L > s1R) setsL++; else if (s1R > s1L) setsR++;
            if (s2L > s2R) setsL++; else if (s2R > s2L) setsR++;
            if (s3L > s3R) setsL++; else if (s3R > s3L) setsR++;
            stats[teamL].setVinti += setsL; stats[teamL].setPersi += setsR;
            stats[teamR].setVinti += setsR; stats[teamR].setPersi += setsL;
            matchWinL = setsL > setsR ? 1 : 0;
        } else {
            stats[teamL].setVinti += (s1L > s1R ? 1 : 0);
            stats[teamL].setPersi += (s1R > s1L ? 1 : 0);
            stats[teamR].setVinti += (s1R > s1L ? 1 : 0);
            stats[teamR].setPersi += (s1L > s1R ? 1 : 0);
            matchWinL = s1L > s1R ? 1 : 0;
        }

        if (matchWinL) { stats[teamL].vinte++; stats[teamL].score++; stats[teamR].perse++; }
        else { stats[teamR].vinte++; stats[teamR].score++; stats[teamL].perse++; }
    }

    return Object.values(stats).sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const qzTeamA = a.puntiSubiti === 0 ? a.puntiFatti : a.puntiFatti / a.puntiSubiti;
        const qzTeamB = b.puntiSubiti === 0 ? b.puntiFatti : b.puntiFatti / b.puntiSubiti;
        return qzTeamB - qzTeamA;
    });
  };

  const rankings = calculateRanking();
  const gironiDisponibili = config ? Array.from({ length: config.numGironi || 0 }, (_, i) => String.fromCharCode(65 + i)) : [];

  return (
    <main className="min-h-screen pb-20" style={{backgroundColor: "#f8faff"}}>
      <header className="bg-white py-4 px-8 flex flex-col md:flex-row justify-between items-center shadow-md border-b-4 gap-4" style={{borderColor: "#0a1628"}}>
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="BVI Logo" width={50} height={50} className="object-contain" />
            <h1 className="text-2xl font-bold" style={{color: "#0a1628"}}>BVI Staff</h1>
          </div>
          <nav className="flex gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200 overflow-x-auto">
            <a href="/staff/dashboard" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Dashboard</a>
            <a href="/staff/iscrizioni" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Iscrizioni</a>
            <a href="/staff/tornei" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Tornei</a>
            <a href="/staff/gironi" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Gironi</a>
            <a href="/staff/classifica" className="px-4 py-2 rounded-lg text-sm font-bold bg-white text-[#0a1628] shadow-sm border border-gray-200 transition-all whitespace-nowrap">Classifica</a>
            <a href="/staff/atleti" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Anagrafica Atleti</a>
            <a href="/staff/tabellone" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Tabellone</a>
            <a href="/staff/pagamenti" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Pagamenti</a>
          </nav>
        </div>
        <a href="/" className="hover:underline font-bold text-red-500 text-sm">Esci</a>
      </header>

      <div className="max-w-6xl mx-auto mt-10 px-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
                <h2 className="text-4xl font-black text-[#0a1628] uppercase tracking-tighter">Controllo Classifiche 📊</h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Verifica PF/PS e Quoziente</p>
            </div>
            <select 
                className="bg-white border-2 border-gray-200 rounded-xl px-4 py-3 font-bold text-[#0a1628] shadow-sm"
                value={selectedTorneo}
                onChange={(e) => setSelectedTorneo(e.target.value)}
            >
                {tornei.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
            </select>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-100">
            <div className="bg-gray-50 p-4 border-b flex gap-2 overflow-x-auto">
                {gironiDisponibili.map(g => (
                    <button
                        key={g}
                        onClick={() => setActiveGirone(g)}
                        className={`px-6 py-2 rounded-xl font-black text-xs transition-all ${activeGirone === g ? 'bg-[#0a1628] text-white shadow-md' : 'bg-white text-gray-400 border border-gray-100'}`}
                    >
                        GIRONE {g}
                    </button>
                ))}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b bg-white">
                        <tr>
                            <th className="px-6 py-5">Pos</th>
                            <th className="px-6 py-5">Squadra</th>
                            <th className="px-4 py-5 text-center">G</th>
                            <th className="px-4 py-5 text-center">V / P</th>
                            <th className="px-4 py-5 text-center">PF</th>
                            <th className="px-4 py-5 text-center">PS</th>
                            <th className="px-4 py-5 text-center bg-gray-50/50">Quoz.</th>
                            <th className="px-6 py-5 text-right">Punti</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {rankings.map((team, idx) => {
                            const quotient = team.puntiSubiti === 0 ? team.puntiFatti : (team.puntiFatti / team.puntiSubiti).toFixed(3);
                            return (
                                <tr key={team.nome} className={`hover:bg-blue-50/20 transition-all ${idx < 2 ? 'bg-yellow-50/20' : ''}`}>
                                    <td className="px-6 py-5">
                                        <span className={`w-7 h-7 rounded flex items-center justify-center font-black text-xs ${idx < 2 ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                            {idx + 1}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5">
                                        <p className="font-bold text-[#0a1628]">{team.nome}</p>
                                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">
                                            {idx < 2 ? "Passa al Gold" : "Passa al Silver"}
                                        </p>
                                    </td>
                                    <td className="px-4 py-5 text-center font-bold text-gray-400">{team.giocate}</td>
                                    <td className="px-4 py-5 text-center whitespace-nowrap">
                                        <span className="text-green-600 font-black">{team.vinte}</span>
                                        <span className="mx-1 text-gray-200">/</span>
                                        <span className="text-red-500 font-black">{team.perse}</span>
                                    </td>
                                    <td className="px-4 py-5 text-center font-bold text-gray-600">{team.puntiFatti}</td>
                                    <td className="px-4 py-5 text-center font-bold text-gray-400">{team.puntiSubiti}</td>
                                    <td className="px-4 py-5 text-center font-black text-[#0a1628] bg-gray-50/30">{quotient}</td>
                                    <td className="px-6 py-5 text-right">
                                        <span className="text-2xl font-black text-[#0a1628]">{team.score}</span>
                                    </td>
                                </tr>
                            );
                        })}
                        {rankings.length === 0 && (
                            <tr>
                                <td colSpan="8" className="py-20 text-center text-gray-400 font-bold italic">Nessun dato calcolato. Inserisci i punteggi nei gironi.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    </main>
  );
}
