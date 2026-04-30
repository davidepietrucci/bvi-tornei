"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

export default function StaffGironi() {
  const [numGironi, setNumGironi] = useState(4);
  const [teamCounts, setTeamCounts] = useState({ A: 4, B: 4, C: 4, D: 4, E: 4, F: 4, G: 4, H: 4 });
  
  // Stati dinamici per i tornei e giocatori
  const [torneiAttivi, setTorneiAttivi] = useState([]);
  const [selectedTorneo, setSelectedTorneo] = useState("");
  const [tutteLeIscrizioni, setTutteLeIscrizioni] = useState([]);
  const [gironeAssignments, setGironeAssignments] = useState({});
  const [gironeTypes, setGironeTypes] = useState({ A: "Pool", B: "Pool", C: "Pool", D: "Pool", E: "Pool", F: "Pool", G: "Pool", H: "Pool" });
  const [gironeSets, setGironeSets] = useState({ A: "1 set", B: "1 set", C: "1 set", D: "1 set", E: "1 set", F: "1 set", G: "1 set", H: "1 set" });
  const [matchMetadata, setMatchMetadata] = useState({});

  useEffect(() => {
    // 1. Carica i tornei
    const savedTornei = localStorage.getItem("bvi_tornei");
    if (savedTornei) {
      const parsedTornei = JSON.parse(savedTornei);
      // Filtra solo "Iscrizioni Aperte" e "In Programmazione"
      const attivi = parsedTornei.filter(t => t.stato === "Iscrizioni Aperte" || t.stato === "In Programmazione");
      setTorneiAttivi(attivi);
      
      // Controlla se c'è un torneo passato nell'URL
      const params = new URLSearchParams(window.location.search);
      const urlTour = params.get('tour');
      
      if (urlTour && attivi.some(t => t.nome === urlTour)) {
        setSelectedTorneo(urlTour);
      } else if (attivi.length > 0) {
        setSelectedTorneo(attivi[0].nome);
      }
    } else {
      // Dati di default se non presenti
      const fallbackTornei = [{ id: 1, nome: "Torneo di Ferragosto", stato: "Iscrizioni Aperte" }, { id: 2, nome: "BVI Summer Cup", stato: "Iscrizioni Aperte" }];
      setTorneiAttivi(fallbackTornei);
      setSelectedTorneo(fallbackTornei[0].nome);
    }

    // 2. Carica le iscrizioni
    const savedIscrizioni = localStorage.getItem("bvi_iscrizioni");
    if (savedIscrizioni) {
      setTutteLeIscrizioni(JSON.parse(savedIscrizioni));
    }
  }, []);

  // Funzione per generare la chiave univoca del torneo
  const getConfigKey = (nomeTorneo) => {
    if (!nomeTorneo) return "";
    return `bvi_gironi_v2_${nomeTorneo.toLowerCase().trim().replace(/\s+/g, '_')}`;
  };

  // Caricamento configurazione specifica del torneo quando cambia selectedTorneo
  useEffect(() => {
    if (!selectedTorneo) return;
    
    const configKey = getConfigKey(selectedTorneo);
    const savedConfig = localStorage.getItem(configKey);
    
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      setNumGironi(config.numGironi || 4);
      setTeamCounts(config.teamCounts || { A: 4, B: 4, C: 4, D: 4, E: 4, F: 4, G: 4, H: 4 });
      setGironeTypes(config.gironeTypes || { A: "Pool", B: "Pool", C: "Pool", D: "Pool", E: "Pool", F: "Pool", G: "Pool", H: "Pool" });
      setGironeSets(config.gironeSets || { A: "1 set", B: "1 set", C: "1 set", D: "1 set", E: "1 set", F: "1 set", G: "1 set", H: "1 set" });
      setGironeAssignments(config.gironeAssignments || {});
      setMatchMetadata(config.matchMetadata || {});
    } else {
      // Reset ai default se non c'è config per questo torneo
      setNumGironi(4);
      setTeamCounts({ A: 4, B: 4, C: 4, D: 4, E: 4, F: 4, G: 4, H: 4 });
      setGironeTypes({ A: "Pool", B: "Pool", C: "Pool", D: "Pool", E: "Pool", F: "Pool", G: "Pool", H: "Pool" });
      setGironeSets({ A: "1 set", B: "1 set", C: "1 set", D: "1 set", E: "1 set", F: "1 set", G: "1 set", H: "1 set" });
      setGironeAssignments({});
      setMatchMetadata({});
    }
  }, [selectedTorneo]);

  // Filtriamo i giocatori approvati per il torneo selezionato
  const giocatoriFiltrati = tutteLeIscrizioni.filter(isc => {
    const tName = (isc.torneo || "").toLowerCase();
    const sName = (selectedTorneo || "").toLowerCase().trim();
    return tName.includes(sName) && isc.stato === "Approvata";
  });

  const handleAssignmentChange = (gironeId, slotIdx, playerName) => {
    setGironeAssignments(prev => ({
      ...prev,
      [gironeId]: {
        ...(prev[gironeId] || {}),
        [slotIdx]: playerName
      }
    }));
  };

  const handleTypeChange = (gironeId, type) => {
    setGironeTypes(prev => ({ ...prev, [gironeId]: type }));
  };

  const handleSetsChange = (gironeId, sets) => {
    setGironeSets(prev => ({ ...prev, [gironeId]: sets }));
  };

  const handleMetadataChange = (gironeId, matchIdx, field, value) => {
    setMatchMetadata(prev => ({
      ...prev,
      [`${gironeId}-${matchIdx}`]: {
        ...(prev[`${gironeId}-${matchIdx}`] || {}),
        [field]: value
      }
    }));
  };

  const handleSave = () => {
    if (!selectedTorneo) return;
    
    const configKey = getConfigKey(selectedTorneo);
    const config = {
      numGironi,
      teamCounts,
      gironeTypes,
      gironeSets,
      gironeAssignments,
      matchMetadata
    };
    
    localStorage.setItem(configKey, JSON.stringify(config));
    alert(`Configurazione salvata per "${selectedTorneo}"! 🏐`);
  };

  const allGironi = [
    { id: 'A', colorClass: 'blue' },
    { id: 'B', colorClass: 'red' },
    { id: 'C', colorClass: 'yellow' },
    { id: 'D', colorClass: 'purple' },
    { id: 'E', colorClass: 'green' },
    { id: 'F', colorClass: 'orange' },
    { id: 'G', colorClass: 'pink' },
    { id: 'H', colorClass: 'cyan' },
  ];
  
  const gironi = allGironi.slice(0, numGironi);

  const handleTeamCountChange = (gironeId, value) => {
    const val = parseInt(value, 10);
    if (value === "") {
      setTeamCounts(prev => ({ ...prev, [gironeId]: "" }));
    } else if (!isNaN(val) && val > 0 && val <= 10) {
      setTeamCounts(prev => ({ ...prev, [gironeId]: val }));
    }
  };

  // Generatore di partite dinamico in base al numero di squadre e tipo
  const getSchedule = (numTeams, gironeId, assignments = {}) => {
    const getName = (idx) => assignments[idx] && assignments[idx] !== "—" ? assignments[idx] : `Slot ${idx + 1}`;
    const type = gironeTypes[gironeId] || "Pool";

    if (!numTeams || numTeams < 2) return [];

    // Logica Girone all'italiana (Round Robin Completo)
    if (type === "Girone all'italiana") {
      const rrMatches = [];
      for (let i = 0; i < numTeams; i++) {
        for (let j = i + 1; j < numTeams; j++) {
          rrMatches.push({ left: getName(i), right: getName(j) });
        }
      }
      return rrMatches;
    }

    // Logica Pool (Schema ridotto/incrocio)
    if (numTeams === 2) return [{ left: getName(0), right: getName(1) }];
    if (numTeams === 3) return [
      { left: getName(0), right: getName(2) },
      { left: getName(1), right: getName(2) },
      { left: getName(0), right: getName(1) }
    ];
    if (numTeams === 4) {
      const getResult = (idx) => {
        const meta = matchMetadata[`${gironeId}-${idx}`] || {};
        const s1L = parseInt(meta.s1L || 0);
        const s1R = parseInt(meta.s1R || 0);
        if (s1L === 0 && s1R === 0) return { winner: `Vincente G${idx + 1}`, loser: `Perdente G${idx + 1}` };
        
        // Se 3 set, controlliamo chi ha vinto più set
        if (gironeSets[gironeId] === "3 set") {
          let winL = 0, winR = 0;
          if (s1L > s1R) winL++; else if (s1R > s1L) winR++;
          if (parseInt(meta.s2L || 0) > parseInt(meta.s2R || 0)) winL++; else if (parseInt(meta.s2R || 0) > parseInt(meta.s2L || 0)) winR++;
          if (parseInt(meta.s3L || 0) > parseInt(meta.s3R || 0)) winL++; else if (parseInt(meta.s3R || 0) > parseInt(meta.s3L || 0)) winR++;
          
          if (winL > winR) return { winner: idx === 0 ? getName(0) : getName(1), loser: idx === 0 ? getName(3) : getName(2) };
          return { winner: idx === 0 ? getName(3) : getName(2), loser: idx === 0 ? getName(0) : getName(1) };
        }

        if (s1L > s1R) return { winner: idx === 0 ? getName(0) : getName(1), loser: idx === 0 ? getName(3) : getName(2) };
        return { winner: idx === 0 ? getName(3) : getName(2), loser: idx === 0 ? getName(0) : getName(1) };
      };

      const g1 = getResult(0);
      const g2 = getResult(1);

      return [
        { left: getName(0), right: getName(3) },
        { left: getName(1), right: getName(2) },
        { left: g1.winner, right: g2.winner },
        { left: g1.loser, right: g2.loser }
      ];
    }
    if (numTeams === 5) return [
      { left: getName(0), right: getName(4) },
      { left: getName(1), right: getName(3) },
      { left: getName(2), right: getName(4) },
      { left: getName(0), right: getName(1) },
      { left: getName(2), right: getName(3) }
    ];
    return Array.from({length: numTeams}).map((_, i) => ({ left: `Gara ${i+1} A`, right: `Gara ${i+1} B` }));
  };

  // Helper per le classi colore di Tailwind
  const getColors = (color) => {
    switch (color) {
      case 'blue': return { main: 'bg-blue-600', border: 'border-blue-600', light: 'bg-blue-50', inputBg: 'bg-blue-800/50' };
      case 'red': return { main: 'bg-red-500', border: 'border-red-500', light: 'bg-red-50', inputBg: 'bg-red-700/50' };
      case 'yellow': return { main: 'bg-yellow-500', border: 'border-yellow-500', light: 'bg-yellow-50', inputBg: 'bg-yellow-600/50' };
      case 'purple': return { main: 'bg-purple-600', border: 'border-purple-600', light: 'bg-purple-50', inputBg: 'bg-purple-800/50' };
      case 'green': return { main: 'bg-green-600', border: 'border-green-600', light: 'bg-green-50', inputBg: 'bg-green-800/50' };
      case 'orange': return { main: 'bg-orange-500', border: 'border-orange-500', light: 'bg-orange-50', inputBg: 'bg-orange-700/50' };
      case 'pink': return { main: 'bg-pink-500', border: 'border-pink-500', light: 'bg-pink-50', inputBg: 'bg-pink-700/50' };
      case 'cyan': return { main: 'bg-cyan-600', border: 'border-cyan-600', light: 'bg-cyan-50', inputBg: 'bg-cyan-800/50' };
      default: return { main: 'bg-gray-600', border: 'border-gray-600', light: 'bg-gray-50', inputBg: 'bg-gray-800/50' };
    }
  };

  return (
    <main className="min-h-screen flex flex-col" style={{backgroundColor: "#f0f4ff"}}>
      {/* Header Staff */}
      <header className="bg-white py-4 px-8 flex flex-col md:flex-row justify-between items-center shadow-md border-b-4 gap-4 shrink-0" style={{borderColor: "#0a1628"}}>
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="BVI Logo" width={50} height={50} className="object-contain" />
            <h1 className="text-2xl font-bold" style={{color: "#0a1628"}}>BVI Staff</h1>
          </div>
          
          {/* Menu Navigazione Staff */}
          <nav className="flex gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200 overflow-x-auto">
            <a href="/staff/dashboard" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Dashboard</a>
            <a href="/staff/iscrizioni" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Iscrizioni</a>
            <a href="/staff/tornei" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Tornei</a>
            <a href="/staff/gironi" className="px-4 py-2 rounded-lg text-sm font-bold bg-white text-[#0a1628] shadow-sm border border-gray-200 transition-all whitespace-nowrap">Gironi</a>
            <a href="/staff/atleti" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Anagrafica Atleti</a>
            <a href="/staff/classifica" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Classifica</a>
            <a href="/staff/tabellone" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Tabellone</a>
            <a href="/staff/pagamenti" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Pagamenti</a>
          </nav>
        </div>

        <div className="flex gap-4 items-center">
          <span className="font-medium text-gray-500 hidden sm:inline">Bentornato, Admin</span>
          <a href="/" className="hover:underline font-bold text-red-500 text-sm">Esci</a>
        </div>
      </header>

      {/* Workspace Gironi */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden m-4 gap-4 max-w-[1400px] mx-auto w-full">
        
        {/* Main Area */}
        <div className="flex-1 bg-white rounded-2xl shadow-lg border border-gray-200 flex flex-col overflow-hidden">
          
          {/* Top Controls */}
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-4 items-end justify-between">
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Tour</label>
                <select 
                  className="w-48 border border-gray-300 rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a1628]"
                  value={selectedTorneo}
                  onChange={(e) => setSelectedTorneo(e.target.value)}
                >
                  {torneiAttivi.length > 0 ? torneiAttivi.map(t => (
                    <option key={t.id} value={t.nome}>{t.nome}</option>
                  )) : (
                    <option>Nessun torneo attivo</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Tappa / Categoria</label>
                <select className="w-48 border border-gray-300 rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a1628]">
                  <option>Tutte le categorie</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1"># Gironi</label>
                <input 
                  type="number" 
                  value={numGironi} 
                  onChange={(e) => setNumGironi(Math.max(1, Math.min(8, parseInt(e.target.value) || 1)))}
                  className="w-20 border border-gray-300 rounded-md px-3 py-1.5 text-sm font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#0a1628]" 
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  setNumGironi(4);
                  const newCounts = { A: 4, B: 4, C: 4, D: 4 };
                  setTeamCounts(newCounts);
                  const mockAssignments = {
                    A: { 0: "Team Alpha", 1: "Team Beta", 2: "Team Gamma", 3: "Team Delta" },
                    B: { 0: "I Predatori", 1: "I Guerrieri", 2: "I Fenomeni", 3: "Le Leggende" },
                    C: { 0: "Sabbia Mobile", 1: "Vento di Mare", 2: "Onda d'Urto", 3: "Squali Bianchi" },
                    D: { 0: "Beach Kings", 1: "Volley Queens", 2: "Iron Spikers", 3: "Fast & Furious" }
                  };
                  setGironeAssignments(mockAssignments);
                  alert("Test 16 Squadre (4 gironi) popolato! Ora clicca 'Salva Tutto'. 🏐");
                }}
                className="px-4 py-1.5 rounded-md text-sm font-bold border-2 border-yellow-400 text-[#0a1628] bg-white hover:bg-yellow-50 transition-all shadow-sm"
              >
                ⚡ POPOLA TEST 16 SQUADRE
              </button>
              <button className="px-4 py-1.5 rounded-md text-sm font-bold border border-gray-300 text-gray-600 bg-white hover:bg-gray-100 transition-colors shadow-sm">Reset</button>
              <button 
                onClick={handleSave}
                className="px-4 py-1.5 rounded-md text-sm font-bold text-white transition-colors shadow-sm hover:opacity-90" 
                style={{backgroundColor: "#0a1628"}}
              >
                Salva Tutto
              </button>
            </div>
          </div>

          {/* Gironi Grid */}
          <div className="p-6 overflow-y-auto bg-gray-100/50 flex-1 flex flex-col gap-8">
            
            {/* Row 1: Assegnazione Squadre ai Gironi */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {gironi.map((g) => {
                const c = getColors(g.colorClass);
                const teamCount = teamCounts[g.id] || 0;
                
                return (
                  <div key={`squadre-${g.id}`} className={`bg-white rounded-xl shadow-sm border-2 ${c.border} overflow-hidden flex flex-col h-fit`}>
                    <div className={`${c.main} text-white p-3 flex flex-col gap-2`}>
                      <div className="flex justify-between items-center w-full">
                        <h3 className="font-black text-xl uppercase tracking-tighter">GIRONE {g.id}</h3>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold opacity-80">TEAM:</span>
                          <input 
                            type="number" 
                            value={teamCounts[g.id]} 
                            onChange={(e) => handleTeamCountChange(g.id, e.target.value)}
                            className={`w-10 text-center ${c.inputBg} text-white font-bold rounded py-1 border-none text-xs focus:outline-none focus:ring-2 focus:ring-white`} 
                          />
                        </div>
                      </div>
                      <div className="flex gap-1.5 w-full">
                        <select 
                          value={gironeTypes[g.id]} 
                          onChange={(e) => handleTypeChange(g.id, e.target.value)}
                          className={`${c.inputBg} flex-1 text-white text-[10px] rounded py-1.5 px-1 font-bold border-none focus:ring-1 focus:ring-white cursor-pointer`}
                        >
                          <option value="Pool">Pool</option>
                          <option value="Girone all'italiana">G. Italiana</option>
                        </select>
                        <select 
                          value={gironeSets[g.id]} 
                          onChange={(e) => handleSetsChange(g.id, e.target.value)}
                          className={`${c.inputBg} flex-1 text-white text-[10px] rounded py-1.5 px-1 font-bold border-none focus:ring-1 focus:ring-white cursor-pointer`}
                        >
                          <option value="1 set">1 set</option>
                          <option value="3 set">3 set</option>
                        </select>
                      </div>
                    </div>
                    <div className={`p-3 ${c.light} flex flex-col gap-2`}>
                      {teamCount > 0 ? (
                        Array.from({ length: teamCount }).map((_, idx) => {
                          const defaultAssigned = giocatoriFiltrati[idx]?.giocatori || "—";
                          const val = gironeAssignments[g.id] && gironeAssignments[g.id][idx] !== undefined 
                              ? gironeAssignments[g.id][idx] 
                              : defaultAssigned;

                          return (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="text-gray-500 font-bold text-sm w-3">{idx + 1}.</span>
                              <select 
                                className="flex-1 border border-gray-300 rounded-md py-1.5 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0a1628] bg-white text-gray-800 font-medium"
                                value={val}
                                onChange={(e) => handleAssignmentChange(g.id, idx, e.target.value)}
                              >
                                <option value="—">—</option>
                                {giocatoriFiltrati.map(gf => (
                                  <option key={gf.id} value={gf.giocatori}>{gf.giocatori}</option>
                                ))}
                              </select>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-gray-400 text-center my-4 italic">Nessuna squadra.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Row 2: Partite (Match Schedule) */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {gironi.map((g) => {
                const c = getColors(g.colorClass);
                
                // Preparo gli assignments attuali o di default per questo girone
                const currentAssignments = {};
                for(let i = 0; i < (teamCounts[g.id] || 0); i++) {
                  currentAssignments[i] = gironeAssignments[g.id] && gironeAssignments[g.id][i] !== undefined 
                      ? gironeAssignments[g.id][i] 
                      : (giocatoriFiltrati[i]?.giocatori || "—");
                }
                
                const schedule = getSchedule(teamCounts[g.id] || 0, g.id, currentAssignments);
                
                return (
                  <div key={`partite-${g.id}`} className={`bg-white border-2 ${c.border} rounded-xl overflow-hidden shadow-sm h-fit`}>
                    <div className={`${c.main} text-white px-3 py-2 flex justify-between items-center font-bold`}>
                      <span className="text-[10px] uppercase tracking-wider">Partite {g.id} — {gironeTypes[g.id]}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] tracking-wider font-semibold">CAMPO RAPIDO</span>
                        <input 
                          type="text" 
                          placeholder="es. 3" 
                          onChange={(e) => {
                            const val = e.target.value;
                            const schedule = getSchedule(teamCounts[g.id] || 0, g.id);
                            schedule.forEach((_, sIdx) => {
                              handleMetadataChange(g.id, sIdx, 'court', val);
                            });
                          }}
                          className={`w-12 ${c.inputBg} text-white placeholder-white/70 text-center text-xs py-1 rounded border-none focus:outline-none focus:ring-1 focus:ring-white`} 
                        />
                      </div>
                    </div>
                    <div className={`p-4 ${c.light} flex flex-col gap-3`}>
                      {schedule.length > 0 ? (
                        schedule.map((row, idx) => {
                          const meta = matchMetadata[`${g.id}-${idx}`] || {};
                          return (
                            <div key={idx} className="flex items-center justify-between gap-2">
                              <div className="flex flex-col gap-1">
                                <input 
                                  type="text" 
                                  placeholder="hh:mm" 
                                  value={meta.time || ""}
                                  onChange={(e) => handleMetadataChange(g.id, idx, 'time', e.target.value)}
                                  className="w-14 border border-gray-300 rounded text-center text-[10px] py-1 focus:outline-none focus:ring-1 focus:ring-[#0a1628] bg-white text-gray-700 font-bold" 
                                />
                                <input 
                                  type="text" 
                                  placeholder="C." 
                                  value={meta.court || ""}
                                  onChange={(e) => handleMetadataChange(g.id, idx, 'court', e.target.value)}
                                  className="w-14 border border-gray-300 rounded text-center text-[10px] py-1 focus:outline-none focus:ring-1 focus:ring-[#0a1628] bg-white text-gray-700 font-bold" 
                                />
                              </div>
                              <div className="flex flex-col items-center gap-2 flex-1">
                                <div className="flex items-center gap-2 sm:gap-4 w-full justify-center">
                                  <span className="text-[11px] font-bold text-gray-700 w-24 text-right truncate">{row.left}</span>
                                  
                                  <div className="flex gap-1 items-center">
                                    {/* Set 1 */}
                                    <div className="flex gap-0.5">
                                      <input 
                                        type="text" 
                                        placeholder="-" 
                                        value={meta.s1L || ""}
                                        onChange={(e) => handleMetadataChange(g.id, idx, 's1L', e.target.value)}
                                        className="w-7 h-7 border border-gray-300 rounded text-[10px] focus:outline-none focus:ring-1 focus:ring-[#0a1628] bg-white text-center font-bold" 
                                      />
                                      <input 
                                        type="text" 
                                        placeholder="-" 
                                        value={meta.s1R || ""}
                                        onChange={(e) => handleMetadataChange(g.id, idx, 's1R', e.target.value)}
                                        className="w-7 h-7 border border-gray-300 rounded text-[10px] focus:outline-none focus:ring-1 focus:ring-[#0a1628] bg-white text-center font-bold" 
                                      />
                                    </div>

                                    {gironeSets[g.id] === "3 set" && (
                                      <>
                                        <span className="text-[10px] text-gray-300">|</span>
                                        {/* Set 2 */}
                                        <div className="flex gap-0.5">
                                          <input 
                                            type="text" 
                                            placeholder="-" 
                                            value={meta.s2L || ""}
                                            onChange={(e) => handleMetadataChange(g.id, idx, 's2L', e.target.value)}
                                            className="w-7 h-7 border border-gray-300 rounded text-[10px] focus:outline-none focus:ring-1 focus:ring-[#0a1628] bg-white text-center font-bold" 
                                          />
                                          <input 
                                            type="text" 
                                            placeholder="-" 
                                            value={meta.s2R || ""}
                                            onChange={(e) => handleMetadataChange(g.id, idx, 's2R', e.target.value)}
                                            className="w-7 h-7 border border-gray-300 rounded text-[10px] focus:outline-none focus:ring-1 focus:ring-[#0a1628] bg-white text-center font-bold" 
                                          />
                                        </div>
                                        <span className="text-[10px] text-gray-300">|</span>
                                        {/* Set 3 */}
                                        <div className="flex gap-0.5">
                                          <input 
                                            type="text" 
                                            placeholder="-" 
                                            value={meta.s3L || ""}
                                            onChange={(e) => handleMetadataChange(g.id, idx, 's3L', e.target.value)}
                                            className="w-7 h-7 border border-gray-300 rounded text-[10px] focus:outline-none focus:ring-1 focus:ring-[#0a1628] bg-white text-center font-bold" 
                                          />
                                          <input 
                                            type="text" 
                                            placeholder="-" 
                                            value={meta.s3R || ""}
                                            onChange={(e) => handleMetadataChange(g.id, idx, 's3R', e.target.value)}
                                            className="w-7 h-7 border border-gray-300 rounded text-[10px] focus:outline-none focus:ring-1 focus:ring-[#0a1628] bg-white text-center font-bold" 
                                          />
                                        </div>
                                      </>
                                    )}
                                  </div>

                                  <span className="text-[11px] font-bold text-gray-700 w-24 text-left truncate">{row.right}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <p className="text-sm text-gray-400 text-center my-4 italic">Nessuna partita programmata.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>

        {/* Sidebar Giocatori */}
        <div className="w-full lg:w-80 bg-white rounded-2xl shadow-lg border border-gray-200 flex flex-col shrink-0 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h2 className="font-bold text-lg" style={{color: "#0a1628"}}>Giocatori Iscritti</h2>
            <span className="text-xs font-bold bg-green-100 text-green-800 px-3 py-1 rounded-full">{giocatoriFiltrati.length}</span>
          </div>
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50/50 flex flex-col items-center justify-start gap-3">
            {giocatoriFiltrati.length > 0 ? (
              giocatoriFiltrati.map((g, i) => (
                <div key={i} className="w-full bg-white border border-gray-200 rounded-lg p-3 shadow-sm flex flex-col hover:border-blue-300 transition-colors cursor-move">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-gray-800 text-sm">{g.giocatori}</span>
                    <span className="text-xs font-bold text-green-600 bg-green-50 px-1.5 rounded">✓</span>
                  </div>
                  <span className="text-xs text-gray-500">ID: #{g.id} • {g.torneo.split('-')[1]?.trim() || g.torneo}</span>
                </div>
              ))
            ) : (
              <>
                <div className="text-4xl mb-2 mt-10 grayscale opacity-50">📋</div>
                <p className="text-sm text-gray-400 text-center">Nessun giocatore iscritto<br/>(o approvato) per questo torneo.</p>
              </>
            )}
          </div>
        </div>

      </div>

    </main>
  );
}
