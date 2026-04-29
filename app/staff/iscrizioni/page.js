"use client";

import Image from "next/image";
import { useState, useEffect } from "react";

export default function StaffIscrizioni() {
  const [iscrizioni, setIscrizioni] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem("bvi_iscrizioni");
    if (saved) {
      setIscrizioni(JSON.parse(saved));
    } else {
      const initialData = [
        { id: "101", data: "Oggi, 10:45", torneo: "Torneo di Ferragosto - Misto 2x2", giocatori: "Davide P. & Elena M.", tel: "333 1234567", stato: "In Attesa" },
        { id: "102", data: "Oggi, 09:12", torneo: "BVI Summer Cup - Maschile 2x2", giocatori: "Marco R. & Luca B.", tel: "333 7654321", stato: "Approvata" },
        { id: "103", data: "Ieri, 18:30", torneo: "BVI Summer Cup - Femminile 2x2", giocatori: "Giulia M. & Sara L.", tel: "328 1122334", stato: "In Attesa" },
      ];
      setIscrizioni(initialData);
      localStorage.setItem("bvi_iscrizioni", JSON.stringify(initialData));
    }
  }, []);

  const handleApprove = (id) => {
    const updated = iscrizioni.map((isc) => 
      isc.id === id ? { ...isc, stato: "Approvata" } : isc
    );
    setIscrizioni(updated);
    localStorage.setItem("bvi_iscrizioni", JSON.stringify(updated));
  };

  const exportToExcel = () => {
    const headers = ["ID", "Data", "Torneo", "Giocatori", "Contatto", "Stato"];
    const csvRows = [
      headers.join(","),
      ...iscrizioni.map(isc => [
        isc.id, 
        `"${isc.data}"`, 
        `"${isc.torneo}"`, 
        `"${isc.giocatori}"`, 
        `"${isc.tel}"`, 
        isc.stato
      ].join(","))
    ];
    
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "iscrizioni_bvi.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
            <a href="/staff/iscrizioni" className="px-4 py-2 rounded-lg text-sm font-bold bg-white text-[#0a1628] shadow-sm border border-gray-200 transition-all whitespace-nowrap">Iscrizioni</a>
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
        <h2 className="text-3xl font-extrabold mb-6" style={{color: "#0a1628"}}>Gestione Iscrizioni Torneo</h2>

        {/* Tabella Iscrizioni */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-wrap gap-4">
            <h3 className="font-bold text-lg text-gray-800">Ultime Richieste Ricevute ({iscrizioni.length})</h3>
            <button 
              onClick={exportToExcel}
              className="text-sm bg-white border border-gray-300 px-4 py-2 rounded-lg font-medium shadow-sm hover:bg-gray-50 transition-colors"
            >
              ⬇️ Esporta in Excel
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-gray-600 text-sm">
                  <th className="py-3 px-6 font-semibold">ID</th>
                  <th className="py-3 px-6 font-semibold min-w-[120px]">Ricevuta il</th>
                  <th className="py-3 px-6 font-semibold min-w-[200px]">Torneo</th>
                  <th className="py-3 px-6 font-semibold min-w-[200px]">Giocatori</th>
                  <th className="py-3 px-6 font-semibold min-w-[120px]">Contatto</th>
                  <th className="py-3 px-6 font-semibold">Stato</th>
                  <th className="py-3 px-6 font-semibold text-center">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {iscrizioni.map((req, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-4 px-6 text-sm text-gray-500">#{req.id}</td>
                    <td className="py-4 px-6 text-sm">{req.data}</td>
                    <td className="py-4 px-6 text-sm">
                      <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded text-xs font-semibold whitespace-nowrap">{req.torneo}</span>
                    </td>
                    <td className="py-4 px-6 font-bold" style={{color: "#0a1628"}}>{req.giocatori}</td>
                    <td className="py-4 px-6 text-sm text-gray-500 whitespace-nowrap">{req.tel}</td>
                    <td className="py-4 px-6">
                      {req.stato === "In Attesa" ? (
                        <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 w-max">
                          <span className="w-2 h-2 rounded-full bg-yellow-500"></span>In Attesa
                        </span>
                      ) : (
                        <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 w-max">
                          <span className="w-2 h-2 rounded-full bg-green-500"></span>Approvata
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {req.stato === "In Attesa" && (
                          <button 
                            onClick={() => handleApprove(req.id)}
                            className="bg-green-500 hover:bg-green-600 text-white w-8 h-8 rounded-lg shadow-sm font-bold flex items-center justify-center transition-colors" 
                            title="Approva"
                          >
                            ✓
                          </button>
                        )}
                        <button className="bg-red-500 hover:bg-red-600 text-white w-8 h-8 rounded-lg shadow-sm font-bold flex items-center justify-center transition-colors" title="Rifiuta">✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 text-center text-sm text-gray-500 bg-gray-50">
            Mostrando {iscrizioni.length} su {iscrizioni.length} iscrizioni
          </div>
        </div>
      </div>
    </main>
  );
}
