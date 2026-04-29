"use client";

import Image from "next/image";
import { useState } from "react";

export default function StaffGironi() {
  const [numGironi, setNumGironi] = useState(4);
  const [teamCounts, setTeamCounts] = useState({ A: 4, B: 4, C: 4, D: 4, E: 4, F: 4, G: 4, H: 4 });

  const allGironi = [
    { id: 'A', colorClass: 'blue' },
    { id: 'B', colorClass: 'red' },
    { id: 'C', colorClass: 'yellow' },
    { id: 'D', colorClass: 'purple' },
    { id: 'E', colorClass: 'blue' },
    { id: 'F', colorClass: 'red' },
    { id: 'G', colorClass: 'yellow' },
    { id: 'H', colorClass: 'purple' },
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

  // Generatore di partite dinamico in base al numero di squadre
  const getSchedule = (numTeams) => {
    if (!numTeams || numTeams < 2) return [];
    if (numTeams === 2) return [{ left: 'Slot 1', right: 'Slot 2' }];
    if (numTeams === 3) return [
      { left: 'Slot 1', right: 'Slot 3' },
      { left: 'Slot 2', right: 'Slot 3' },
      { left: 'Slot 1', right: 'Slot 2' }
    ];
    if (numTeams === 4) return [
      { left: 'Slot 1', right: 'Slot 4' },
      { left: 'Slot 2', right: 'Slot 3' },
      { left: 'Vincente G1', right: 'Vincente G2' },
      { left: 'Perdente G1', right: 'Perdente G2' }
    ];
    if (numTeams === 5) return [
      { left: 'Slot 1', right: 'Slot 5' },
      { left: 'Slot 2', right: 'Slot 4' },
      { left: 'Slot 3', right: 'Slot 5' },
      { left: 'Slot 1', right: 'Slot 2' },
      { left: 'Slot 3', right: 'Slot 4' }
    ];
    // Fallback generico per più di 5 squadre
    return Array.from({length: numTeams}).map((_, i) => ({ left: `Gara ${i+1} A`, right: `Gara ${i+1} B` }));
  };

  // Helper per le classi colore di Tailwind
  const getColors = (color) => {
    switch (color) {
      case 'blue': return { main: 'bg-blue-600', border: 'border-blue-600', light: 'bg-blue-50', inputBg: 'bg-blue-800/50' };
      case 'red': return { main: 'bg-red-500', border: 'border-red-500', light: 'bg-red-50', inputBg: 'bg-red-700/50' };
      case 'yellow': return { main: 'bg-yellow-500', border: 'border-yellow-500', light: 'bg-yellow-50', inputBg: 'bg-yellow-600/50' };
      case 'purple': return { main: 'bg-purple-600', border: 'border-purple-600', light: 'bg-purple-50', inputBg: 'bg-purple-800/50' };
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
                <select className="w-48 border border-gray-300 rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a1628]">
                  <option>BVI Summer Tour</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Tappa</label>
                <select className="w-48 border border-gray-300 rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a1628]">
                  <option>Tappa 1 - Milano</option>
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
              <button className="px-4 py-1.5 rounded-md text-sm font-bold border border-gray-300 text-gray-600 bg-white hover:bg-gray-100 transition-colors shadow-sm">Reset</button>
              <button className="px-4 py-1.5 rounded-md text-sm font-bold text-white transition-colors shadow-sm hover:opacity-90" style={{backgroundColor: "#0a1628"}}>Salva</button>
              <button className="px-4 py-1.5 rounded-md text-sm font-bold border border-gray-300 text-gray-600 bg-white hover:bg-gray-100 transition-colors shadow-sm">Non visibile</button>
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
                    <div className={`${c.main} text-white p-3 flex items-center justify-between gap-1`}>
                      <h3 className="font-extrabold text-lg leading-tight uppercase">GIRONE<br/>{g.id}</h3>
                      <div className="flex gap-1.5">
                        <input 
                          type="number" 
                          value={teamCounts[g.id]} 
                          onChange={(e) => handleTeamCountChange(g.id, e.target.value)}
                          className={`w-12 text-center ${c.inputBg} text-white font-bold rounded py-1 border-none text-xs focus:outline-none focus:ring-2 focus:ring-white`} 
                        />
                        <select className={`${c.inputBg} text-white text-xs rounded py-1 px-1 font-semibold border-none focus:ring-1 focus:ring-white`}><option>Pool</option></select>
                        <span className={`text-[10px] font-bold ${c.inputBg} px-1.5 py-1.5 rounded flex items-center whitespace-nowrap`}>1 set</span>
                      </div>
                    </div>
                    <div className={`p-3 ${c.light} flex flex-col gap-2`}>
                      {teamCount > 0 ? (
                        Array.from({ length: teamCount }).map((_, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-gray-500 font-bold text-sm w-3">{idx + 1}.</span>
                            <select className="flex-1 border border-gray-300 rounded-md py-1.5 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#0a1628] bg-white text-gray-600">
                              <option>—</option>
                              <option>Squadra 1</option>
                              <option>Squadra 2</option>
                            </select>
                          </div>
                        ))
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
                const schedule = getSchedule(teamCounts[g.id] || 0);
                
                return (
                  <div key={`partite-${g.id}`} className={`bg-white border-2 ${c.border} rounded-xl overflow-hidden shadow-sm h-fit`}>
                    <div className={`${c.main} text-white px-3 py-2 flex justify-between items-center font-bold`}>
                      <span className="text-sm">Partite {g.id} — POOL</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] tracking-wider font-semibold">CAMPO</span>
                        <input type="text" placeholder="es. 3" className={`w-16 ${c.inputBg} text-white placeholder-white/70 text-center text-xs py-1 rounded border-none focus:outline-none focus:ring-1 focus:ring-white`} />
                      </div>
                    </div>
                    <div className={`p-4 ${c.light} flex flex-col gap-3`}>
                      {schedule.length > 0 ? (
                        schedule.map((row, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2">
                            <input type="text" placeholder="hh:mm" className="w-16 border border-gray-300 rounded text-center text-xs py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0a1628] bg-white text-gray-700" />
                            <div className="flex items-center gap-2 sm:gap-4 flex-1 justify-center">
                              <span className="text-xs font-semibold text-gray-700 w-20 text-right whitespace-nowrap">{row.left}</span>
                              <input type="text" className="w-8 border border-gray-300 rounded py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0a1628] bg-white" />
                              <span className="text-xs text-gray-400 font-bold">vs</span>
                              <input type="text" className="w-8 border border-gray-300 rounded py-1.5 focus:outline-none focus:ring-1 focus:ring-[#0a1628] bg-white" />
                              <span className="text-xs font-semibold text-gray-700 w-20 text-left whitespace-nowrap">{row.right}</span>
                            </div>
                          </div>
                        ))
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
            <h2 className="font-bold text-lg" style={{color: "#0a1628"}}>Giocatori</h2>
            <span className="text-xs font-bold bg-gray-200 text-gray-600 px-2 py-1 rounded-full">0</span>
          </div>
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50/50 flex flex-col items-center justify-center">
            <div className="text-4xl mb-2 grayscale opacity-50">🏐</div>
            <p className="text-sm text-gray-400 text-center">Nessun giocatore<br/>da assegnare.</p>
          </div>
        </div>

      </div>

    </main>
  );
}
