"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import StaffHeader from "@/app/components/StaffHeader";
import { getTornei, getIscrizioni } from "@/app/utils/db";
import { managementHref } from "@/app/utils/tournament-workflow";

export default function StaffTornei() {
  const router = useRouter();
  const [tornei, setTornei] = useState([]);

  useEffect(() => {
    Promise.all([getTornei(), getIscrizioni()]).then(([savedTornei, savedIscrizioni]) => {
      const updatedWithActualCounts = savedTornei.map(torneo => {
        const count = savedIscrizioni.filter(isc => isc.stato !== "Annullata" && (isc.torneo || "").toLowerCase().trim() === torneo.nome.toLowerCase().trim()).length;
        const actualIscritti = count;
        return { ...torneo, iscritti: actualIscritti };
      });

      setTornei(updatedWithActualCounts);
    });
  }, []);

  return (
    <main className="min-h-screen pb-20 bg-[#f8faff]">
      <StaffHeader />

      <div className="max-w-6xl mx-auto mt-6 md:mt-10 px-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
            <div>
                <h1 className="staff-page-title">Tornei</h1>
                <p className="staff-page-description">Programmazione, iscrizioni e accesso alla gestione delle gare.</p>
            </div>
            <button 
                onClick={() => router.push('/staff/tornei/nuovo')}
                className="staff-button staff-button-yellow"
            >
                + Crea Nuovo Torneo
            </button>
        </div>

        {/* Lista Tornei - Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tornei.map((torneo) => (
            <div key={torneo.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white flex flex-col">
              <div className="p-5 flex-1">
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    torneo.stato === 'Iscrizioni Aperte' ? 'bg-green-100 text-green-700' :
                    torneo.stato === 'In Programmazione' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {torneo.stato}
                  </span>
                  <span className="text-xs text-slate-400">#{torneo.id}</span>
                </div>
                
                <h2 className="text-lg font-bold text-[#0a1628] leading-tight mb-4">{torneo.nome}</h2>
                
                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs text-slate-400">Data</span> {torneo.data}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs text-slate-400">Sede</span> {torneo.location}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-20 shrink-0 text-xs text-slate-400">Categoria</span> {torneo.categoria}
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-end mb-3">
                    <div>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Riempimento</span>
                        <span className="text-xl font-black text-[#0a1628]">{torneo.iscritti} <span className="text-gray-300 font-medium">/ {torneo.maxSquadre}</span></span>
                    </div>
                    <span className="text-[10px] font-black text-green-600">
                        {Math.round((torneo.iscritti / torneo.maxSquadre) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-1000" 
                      style={{
                        width: `${(torneo.iscritti / torneo.maxSquadre) * 100}%`,
                        backgroundColor: torneo.iscritti >= torneo.maxSquadre ? "#0a1628" : "#FFD700"
                      }}
                    ></div>
                  </div>
                </div>
              </div>
              
              <div className="border-t border-slate-100 bg-slate-50/50 p-4 flex flex-col gap-2">
                <a
                  href={`/tornei/${torneo.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 text-center text-xs font-semibold text-slate-500 hover:text-[#0a1628]"
                >
                  Apri pagina pubblica ↗
                </a>
                <div className="flex gap-3">
                <button 
                  onClick={() => router.push(`/staff/tornei/modifica/${torneo.id}`)}
                  className="flex-1 bg-white border-2 border-gray-100 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest text-gray-600 hover:bg-[#0a1628] hover:text-white hover:border-[#0a1628] transition-all shadow-sm cursor-pointer"
                >
                  Modifica
                </button>
                <button 
                  onClick={() => router.push(managementHref({ tour: torneo.nome }))}
                  className="staff-button staff-button-primary flex-1"
                >
                  Gestisci torneo
                </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
