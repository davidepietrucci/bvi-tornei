"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StaffTornei() {
  const router = useRouter();
  const [tornei, setTornei] = useState([]);

  useEffect(() => {
    let savedTornei = JSON.parse(localStorage.getItem("bvi_tornei") || "[]");
    const savedIscrizioni = JSON.parse(localStorage.getItem("bvi_iscrizioni") || "[]");

    if (savedTornei.length === 0) {
      savedTornei = [
        { id: 1, nome: "Torneo di Ferragosto", data: "15 Agosto 2026", location: "Ostia Lido (RM)", categoria: "Misto 2x2", stato: "Iscrizioni Aperte", iscritti: 12, maxSquadre: 16 },
        { id: 2, nome: "BVI Summer Cup", data: "2 Settembre 2026", location: "Fregene", categoria: "Maschile 2x2 / Femminile 2x2", stato: "In Programmazione", iscritti: 4, maxSquadre: 24 },
        { id: 3, nome: "Spring Classic BVI", data: "10 Maggio 2026", location: "Roma - BVI Center", categoria: "Misto 4x4", stato: "Concluso", iscritti: 16, maxSquadre: 16 },
      ];
      localStorage.setItem("bvi_tornei", JSON.stringify(savedTornei));
    }

    // Calcoliamo gli iscritti effettivi dalla lista iscrizioni
    const updatedWithActualCounts = savedTornei.map(torneo => {
      // Contiamo quante iscrizioni ci sono per questo specifico torneo
      const count = savedIscrizioni.filter(isc => isc.torneo === torneo.nome).length;
      
      // Se il torneo è uno di quelli iniziali mockati, sommiamo il count alle iscrizioni "base" 
      // (oppure resettiamo e usiamo solo il count reale, a seconda della logica desiderata).
      // Qui usiamo il count reale se sono presenti iscrizioni, altrimenti teniamo il mock.
      return { ...torneo, iscritti: count > 0 ? count : torneo.iscritti };
    });

    setTornei(updatedWithActualCounts);
  }, []);

  return (
    <main className="min-h-screen pb-12" style={{backgroundColor: "#f0f4ff"}}>
      {/* Header Staff */}
      <header className="bg-white py-4 px-8 flex flex-col md:flex-row justify-between items-center shadow-md border-b-4 gap-4" style={{borderColor: "#0a1628"}}>
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="BVI Logo" width={50} height={50} className="object-contain" />
            <h1 className="text-2xl font-bold" style={{color: "#0a1628"}}>BVI Staff</h1>
          </div>
          
          {/* Menu Navigazione Staff */}
          <nav className="flex gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200 overflow-x-auto">
            <a href="/staff/dashboard" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Dashboard</a>
            <a href="/staff/iscrizioni" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Iscrizioni</a>
            <a href="/staff/tornei" className="px-4 py-2 rounded-lg text-sm font-bold bg-white text-[#0a1628] shadow-sm border border-gray-200 transition-all whitespace-nowrap">Tornei</a>
            <a href="/staff/atleti" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Anagrafica Atleti</a>
            <a href="/staff/gironi" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Gironi</a>
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

      {/* Main Content */}
      <div className="max-w-6xl mx-auto mt-10 px-4">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-extrabold" style={{color: "#0a1628"}}>Gestione Tornei</h2>
          <button 
            onClick={() => router.push('/staff/tornei/nuovo')}
            className="px-5 py-2.5 rounded-lg font-bold text-white shadow-md hover:opacity-90 transition-all flex items-center gap-2" 
            style={{backgroundColor: "#0a1628"}}
          >
            <span className="text-xl leading-none">+</span> Nuovo Torneo
          </button>
        </div>

        {/* Lista Tornei */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tornei.map((torneo) => (
            <div key={torneo.id} className="bg-white rounded-2xl shadow-lg border-t-4 overflow-hidden flex flex-col hover:shadow-xl transition-shadow" style={{borderColor: torneo.stato === "Concluso" ? "#9ca3af" : "#FFD700"}}>
              <div className="p-6 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    torneo.stato === 'Iscrizioni Aperte' ? 'bg-green-100 text-green-700' :
                    torneo.stato === 'In Programmazione' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {torneo.stato}
                  </span>
                  <button className="text-gray-400 hover:text-gray-700">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                    </svg>
                  </button>
                </div>
                
                <h3 className="text-xl font-bold mb-2" style={{color: "#0a1628"}}>{torneo.nome}</h3>
                
                <div className="space-y-2 mt-4 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📅</span> {torneo.data}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📍</span> {torneo.location}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🏐</span> {torneo.categoria}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">💰</span> Quota: €{torneo.quota !== undefined ? torneo.quota : 40}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100">
                  <div className="flex justify-between items-center text-sm mb-1">
                    <span className="font-semibold text-gray-700">Iscrizioni</span>
                    <span className="font-bold text-gray-900">{torneo.iscritti} / {torneo.maxSquadre}</span>
                  </div>
                  {/* Progress bar */}
                  <div className="w-full bg-gray-100 rounded-full h-2.5 mt-2 overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500" 
                      style={{
                        width: `${(torneo.iscritti / torneo.maxSquadre) * 100}%`,
                        backgroundColor: torneo.iscritti >= torneo.maxSquadre ? "#ef4444" : "#10b981"
                      }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-50 p-4 border-t border-gray-100 flex gap-2">
                <button 
                  onClick={() => router.push(`/staff/tornei/modifica/${torneo.id}`)}
                  className="flex-1 bg-white border border-gray-200 py-2 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Modifica
                </button>
                <button 
                  onClick={() => router.push(`/staff/gironi?tour=${encodeURIComponent(torneo.nome)}`)}
                  className="flex-1 text-center bg-white border border-gray-200 py-2 rounded-lg text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  Gironi
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
