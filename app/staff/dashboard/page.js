"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StaffDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({
    torneiAttivi: 0,
    iscrizioniInAttesa: 0,
    squadreConfermate: 0
  });

  useEffect(() => {
    // Carica Tornei
    const savedTornei = localStorage.getItem("bvi_tornei");
    let countTorneiAttivi = 0;
    if (savedTornei) {
      const tornei = JSON.parse(savedTornei);
      countTorneiAttivi = tornei.filter(t => t.stato === "Iscrizioni Aperte" || t.stato === "In Programmazione").length;
    }

    // Carica Iscrizioni
    const savedIscrizioni = localStorage.getItem("bvi_iscrizioni");
    let countInAttesa = 0;
    let countConfermate = 0;
    if (savedIscrizioni) {
      const iscrizioni = JSON.parse(savedIscrizioni);
      countInAttesa = iscrizioni.filter(i => i.stato === "In Attesa").length;
      countConfermate = iscrizioni.filter(i => i.stato === "Approvata").length;
    }

    setStats({
      torneiAttivi: countTorneiAttivi,
      iscrizioniInAttesa: countInAttesa,
      squadreConfermate: countConfermate
    });
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
            <a href="/staff/dashboard" className="px-4 py-2 rounded-lg text-sm font-bold bg-white text-[#0a1628] shadow-sm border border-gray-200 transition-all whitespace-nowrap">Dashboard</a>
            <a href="/staff/iscrizioni" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Iscrizioni</a>
            <a href="/staff/tornei" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Tornei</a>
            <a href="/staff/gironi" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Gironi</a>
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
        <h2 className="text-3xl font-extrabold mb-6" style={{color: "#0a1628"}}>Panoramica Generale</h2>
        
        {/* Widget Statistici */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4" style={{borderColor: "#FFD700"}}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-500 font-semibold">Tornei Attivi</h3>
              <span className="text-2xl">🏆</span>
            </div>
            <p className="text-4xl font-bold" style={{color: "#0a1628"}}>{stats.torneiAttivi}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4" style={{borderColor: "#0a1628"}}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-500 font-semibold">Iscrizioni in Attesa</h3>
              <span className="text-2xl">⏳</span>
            </div>
            <p className="text-4xl font-bold text-yellow-600">{stats.iscrizioniInAttesa}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-500 font-semibold">Squadre Confermate</h3>
              <span className="text-2xl">✅</span>
            </div>
            <p className="text-4xl font-bold text-green-600">{stats.squadreConfermate}</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-xl font-bold mb-4" style={{color: "#0a1628"}}>Azioni Rapide</h3>
          <div className="flex flex-wrap gap-4">
            <button onClick={() => router.push('/staff/tornei/nuovo')} className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold text-gray-800 transition-colors">
              + Crea Nuovo Torneo
            </button>
            <button onClick={() => router.push('/staff/iscrizioni')} className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold text-gray-800 transition-colors">
              Valuta Iscrizioni
            </button>
            <button onClick={() => router.push('/staff/pagamenti')} className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg font-semibold text-gray-800 transition-colors">
              Gestisci Pagamenti
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
