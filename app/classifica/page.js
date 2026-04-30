"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

export default function ClassificaPubblica() {
  const [tornei, setTornei] = useState([]);
  const [selectedTorneo, setSelectedTorneo] = useState("");
  const [activeGirone, setActiveGirone] = useState("A");
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedTornei = localStorage.getItem("bvi_tornei");
    if (savedTornei) {
      const parsed = JSON.parse(savedTornei);
      setTornei(parsed);
      if (parsed.length > 0) setSelectedTorneo(parsed[0].nome);
    }
    setLoading(false);
  }, []);

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

    for (let i = 0; i < 20; i++) {
        const meta = metadata[`${activeGirone}-${i}`];
        if (!meta) continue;
        
        let teamL = "", teamR = "";
        if (i === 0) { teamL = assignments[0]; teamR = assignments[3]; }
        else if (i === 1) { teamL = assignments[1]; teamR = assignments[2]; }
        
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
            matchWinL = setsL > setsR ? 1 : 0;
        } else {
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
    <main className="min-h-screen bg-gray-50 pb-20 text-[#0a1628]">
      <header style={{backgroundColor: "#0a1628"}} className="text-white py-6 px-8 flex justify-between items-center shadow-lg border-b-4 border-[#FFD700]">
        <div className="flex items-center gap-4">
          <Image src="/logo.png" alt="BVI Logo" width={50} height={50} />
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase">Classifica Live</h1>
            <p className="text-[10px] text-yellow-400 font-bold uppercase tracking-[0.3em]">Real-time Rankings</p>
          </div>
        </div>
        <a href="/" className="bg-[#FFD700] text-[#0a1628] px-6 py-2 rounded-full font-black text-sm hover:scale-105 transition-transform">HOME</a>
      </header>

      <div className="max-w-6xl mx-auto mt-10 px-4">
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 mb-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
                <span className="text-3xl">🏆</span>
                <select className="bg-transparent text-2xl font-black focus:outline-none"
                    value={selectedTorneo} onChange={(e) => setSelectedTorneo(e.target.value)}>
                    {tornei.map(t => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                </select>
            </div>
            <div className="flex gap-2 bg-gray-100 p-1.5 rounded-2xl">
                {gironiDisponibili.map(g => (
                    <button key={g} onClick={() => setActiveGirone(g)}
                        className={`px-6 py-2.5 rounded-xl font-black text-sm transition-all ${activeGirone === g ? 'bg-[#0a1628] text-white shadow-md' : 'text-gray-400 hover:text-[#0a1628]'}`}>
                        GIRONE {g}
                    </button>
                ))}
            </div>
        </div>

        <div className="bg-white rounded-[3rem] shadow-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                        <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Pos</th>
                        <th className="px-4 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest">Squadra</th>
                        <th className="px-4 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">G</th>
                        <th className="px-4 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">V/P</th>
                        <th className="px-4 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">PF</th>
                        <th className="px-4 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">PS</th>
                        <th className="px-4 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Quoz.</th>
                        <th className="px-8 py-6 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Punti</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {rankings.map((team, idx) => {
                        const quotient = team.puntiSubiti === 0 ? team.puntiFatti : (team.puntiFatti / team.puntiSubiti).toFixed(3);
                        return (
                            <tr key={team.nome} className={`hover:bg-blue-50/30 transition-colors ${idx < 2 ? 'bg-yellow-50/20' : ''}`}>
                                <td className="px-8 py-6">
                                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${idx === 0 ? 'bg-yellow-400 text-white' : idx === 1 ? 'bg-gray-300 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                        {idx + 1}
                                    </span>
                                </td>
                                <td className="px-4 py-6">
                                    <p className="font-bold text-lg">{team.nome}</p>
                                    <p className="text-[9px] font-black text-gray-400 uppercase">{idx < 2 ? "Qualificata Gold" : "Qualificata Silver"}</p>
                                </td>
                                <td className="px-4 py-6 text-center font-bold text-gray-500">{team.giocate}</td>
                                <td className="px-4 py-6 text-center font-black">
                                    <span className="text-green-600">{team.vinte}</span>
                                    <span className="mx-1 text-gray-200">/</span>
                                    <span className="text-red-500">{team.perse}</span>
                                </td>
                                <td className="px-4 py-6 text-center font-bold text-gray-600">{team.puntiFatti}</td>
                                <td className="px-4 py-6 text-center font-bold text-gray-400">{team.puntiSubiti}</td>
                                <td className="px-4 py-6 text-center font-black text-[#0a1628] bg-gray-50/30">{quotient}</td>
                                <td className="px-8 py-6 text-right">
                                    <span className="text-2xl font-black text-[#0a1628]">{team.score}</span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
      </div>
    </main>
  );
}
