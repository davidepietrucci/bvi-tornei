"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import StaffHeader from "@/app/components/StaffHeader";
import { getTornei, getIscrizioni, saveTornei, saveIscrizioni, saveUsers } from "@/app/utils/db";

export default function StaffDashboard() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [stats, setStats] = useState({
    torneiAttivi: 0,
    iscrizioniInAttesa: 0,
    squadreConfermate: 0
  });
  const [role, setRole] = useState("admin");

  useEffect(() => {
    Promise.all([getTornei(), getIscrizioni()]).then(([tornei, iscrizioni]) => {
      const countTorneiAttivi = tornei.filter(t => t.stato === "Iscrizioni Aperte" || t.stato === "In Programmazione").length;
      const countInAttesa = iscrizioni.filter(i => i.stato === "In Attesa").length;
      const countConfermate = iscrizioni.filter(i => i.stato === "Approvata").length;

      setStats({
        torneiAttivi: countTorneiAttivi,
        iscrizioniInAttesa: countInAttesa,
        squadreConfermate: countConfermate
      });
    });
  }, []);

  useEffect(() => {
    if (user) {
      setRole(user.publicMetadata?.role || "staff");
    }
  }, [user]);

  const handleResetData = async () => {
    if (typeof window !== "undefined" && window.confirm("Sei sicuro di voler cancellare TUTTI i dati (tornei, iscritti, atleti, gironi) dal database? Questa azione non è reversibile.")) {
      await saveTornei([]);
      await saveIscrizioni([]);
      await saveUsers([]);
      // Clear localStorage items
      localStorage.removeItem("bvi_tornei");
      localStorage.removeItem("bvi_iscrizioni");
      localStorage.removeItem("bvi_users");
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("bvi_gironi_") || key.startsWith("bvi_bracket_") || key.startsWith("bvi_iscrizioni") || key.startsWith("bvi_tornei") || key.startsWith("bvi_users"))) {
          localStorage.removeItem(key);
        }
      }
      alert("Database ripulito con successo!");
      window.location.reload();
    }
  };


  return (
    <main className="min-h-screen pb-12 bg-[#f8faff]">
      <StaffHeader />

      <div className="max-w-6xl mx-auto mt-6 md:mt-10 px-4">
        <div className="mb-8">
            <h2 className="text-3xl md:text-5xl font-black text-[#0a1628] uppercase tracking-tighter leading-none">Dashboard 🏢</h2>
            <p className="text-[10px] md:text-xs text-gray-400 font-bold uppercase tracking-widest mt-2">Controllo Centrale Torneo</p>
        </div>
        
        {/* Widget Statistici - Mobile Optimized */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="bg-white rounded-[2rem] shadow-xl p-6 md:p-8 border-b-8 transition-transform active:scale-95" style={{borderColor: "#FFD700"}}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-black text-gray-400 uppercase tracking-widest">Tornei Attivi</span>
              <span className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center text-xl">🏆</span>
            </div>
            <p className="text-5xl md:text-6xl font-black text-[#0a1628]">{stats.torneiAttivi}</p>
          </div>

          <div className="bg-white rounded-[2rem] shadow-xl p-6 md:p-8 border-b-8 transition-transform active:scale-95" style={{borderColor: "#0a1628"}}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-black text-gray-400 uppercase tracking-widest">In Attesa</span>
              <span className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-xl">⏳</span>
            </div>
            <p className="text-5xl md:text-6xl font-black text-yellow-600">{stats.iscrizioniInAttesa}</p>
          </div>

          <div className="bg-white rounded-[2rem] shadow-xl p-6 md:p-8 border-b-8 border-green-500 transition-transform active:scale-95 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-black text-gray-400 uppercase tracking-widest">Confermate</span>
              <span className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-xl">✅</span>
            </div>
            <p className="text-5xl md:text-6xl font-black text-green-600">{stats.squadreConfermate}</p>
          </div>
        </div>

        {/* Quick Actions - Full width buttons on mobile */}
        <div className="mt-10 bg-white p-6 md:p-10 rounded-[2.5rem] shadow-2xl border border-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full -mr-16 -mt-16"></div>
          <h3 className="text-xl md:text-2xl font-black mb-6 uppercase tracking-tight text-[#0a1628] relative z-10">Azioni Rapide ⚡</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
            <button onClick={() => router.push('/staff/tornei/nuovo')} className="flex items-center justify-between p-5 bg-gray-50 hover:bg-[#0a1628] hover:text-white text-[#0a1628] rounded-2xl font-black text-sm uppercase tracking-widest transition-all group shadow-sm">
              Crea Torneo <span className="text-xl group-hover:translate-x-2 transition-transform">➕</span>
            </button>
            <button onClick={() => router.push('/staff/iscrizioni')} className="flex items-center justify-between p-5 bg-gray-50 hover:bg-[#0a1628] hover:text-white text-[#0a1628] rounded-2xl font-black text-sm uppercase tracking-widest transition-all group shadow-sm">
              Valuta Iscrizioni <span className="text-xl group-hover:translate-x-2 transition-transform">📝</span>
            </button>
            <button onClick={() => router.push('/staff/pagamenti')} className="flex items-center justify-between p-5 bg-gray-50 hover:bg-[#0a1628] hover:text-white text-[#0a1628] rounded-2xl font-black text-sm uppercase tracking-widest transition-all group shadow-sm">
              Pagamenti <span className="text-xl group-hover:translate-x-2 transition-transform">💰</span>
            </button>
            <button onClick={() => router.push('/staff/sponsors')} className="flex items-center justify-between p-5 bg-gray-50 hover:bg-[#0a1628] hover:text-white text-[#0a1628] rounded-2xl font-black text-sm uppercase tracking-widest transition-all group shadow-sm">
              Gestione Sponsor <span className="text-xl group-hover:translate-x-2 transition-transform">🤝</span>
            </button>
          </div>
        </div>

        {/* Gestione Dati */}
        {role === "admin" && (
          <div className="mt-8 bg-white p-6 md:p-10 rounded-[2.5rem] shadow-2xl border border-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full -mr-16 -mt-16"></div>
            <h3 className="text-xl md:text-2xl font-black mb-6 uppercase tracking-tight text-[#0a1628] relative z-10">Gestione Database ⚙️</h3>
            <div className="grid grid-cols-1 gap-4 relative z-10">
              <button 
                onClick={handleResetData}
                className="flex items-center justify-between p-5 bg-red-50 hover:bg-red-600 hover:text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all group shadow-sm border border-red-100 text-red-700"
              >
                Resetta Database (Vuoto) <span className="text-xl group-hover:scale-110 transition-transform">🗑️</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
