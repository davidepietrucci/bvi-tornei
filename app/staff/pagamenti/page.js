"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StaffPagamenti() {
  const router = useRouter();
  const [iscrizioni, setIscrizioni] = useState([]);
  const [filtroTorneo, setFiltroTorneo] = useState("Tutti");

  useEffect(() => {
    const savedIscrizioni = localStorage.getItem("bvi_iscrizioni");
    const savedTornei = localStorage.getItem("bvi_tornei");

    if (savedIscrizioni) {
      const tornei = savedTornei ? JSON.parse(savedTornei) : [];
      let data = JSON.parse(savedIscrizioni);
      
      // Inizializza i dati di pagamento se non esistono, basandosi sulla quota del torneo
      data = data.map(isc => {
        const torneoInfo = tornei.find(t => isc.torneo.includes(t.nome));
        const quotaTorneo = torneoInfo?.quota !== undefined ? torneoInfo.quota : 40;

        return {
          ...isc,
          quotaTotale: quotaTorneo, 
          quotaPagata: isc.quotaPagata || 0
        };
      });
      setIscrizioni(data);
    }
  }, []);

  const salvaModifiche = (newData) => {
    setIscrizioni(newData);
    localStorage.setItem("bvi_iscrizioni", JSON.stringify(newData));
  };

  const segnaSaldato = (id) => {
    const newData = iscrizioni.map(isc => 
      isc.id === id ? { ...isc, quotaPagata: isc.quotaTotale } : isc
    );
    salvaModifiche(newData);
  };

  const registraAcconto = (id, importo) => {
    const newData = iscrizioni.map(isc => {
      if (isc.id === id) {
        const nuovoPagato = Math.min(isc.quotaPagata + importo, isc.quotaTotale);
        return { ...isc, quotaPagata: nuovoPagato };
      }
      return isc;
    });
    salvaModifiche(newData);
  };

  // Ottieni i nomi dei tornei unici per il filtro
  const torneiDisponibili = ["Tutti", ...new Set(iscrizioni.map(i => i.torneo))];

  // Filtra la lista
  const iscrizioniFiltrate = filtroTorneo === "Tutti" 
    ? iscrizioni 
    : iscrizioni.filter(i => i.torneo === filtroTorneo);

  // Calcolo statistiche
  const totaleAtteso = iscrizioniFiltrate.reduce((acc, curr) => acc + curr.quotaTotale, 0);
  const totaleIncassato = iscrizioniFiltrate.reduce((acc, curr) => acc + curr.quotaPagata, 0);
  const totaleDaIncassare = totaleAtteso - totaleIncassato;

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
            <a href="/staff/tornei" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Tornei</a>
            <a href="/staff/gironi" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Gironi</a>
            <a href="/staff/pagamenti" className="px-4 py-2 rounded-lg text-sm font-bold bg-white text-[#0a1628] shadow-sm border border-gray-200 transition-all whitespace-nowrap">Pagamenti</a>
          </nav>
        </div>

        <div className="flex gap-4 items-center">
          <span className="font-medium text-gray-500 hidden sm:inline">Bentornato, Admin</span>
          <a href="/" className="hover:underline font-bold text-red-500 text-sm">Esci</a>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto mt-10 px-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h2 className="text-3xl font-extrabold" style={{color: "#0a1628"}}>Gestione Pagamenti</h2>
          
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-gray-200">
            <span className="text-sm font-bold text-gray-500">Filtra per Torneo:</span>
            <select 
              value={filtroTorneo} 
              onChange={(e) => setFiltroTorneo(e.target.value)}
              className="bg-transparent text-sm font-bold focus:outline-none focus:ring-0 cursor-pointer text-[#0a1628]"
            >
              {torneiDisponibili.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Dashboard Statistiche Pagamenti */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-blue-500 flex flex-col justify-center">
            <span className="text-gray-500 font-bold text-sm mb-1">Totale Atteso</span>
            <span className="text-3xl font-extrabold text-blue-600">€{totaleAtteso}</span>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-green-500 flex flex-col justify-center">
            <span className="text-gray-500 font-bold text-sm mb-1">Totale Incassato</span>
            <span className="text-3xl font-extrabold text-green-600">€{totaleIncassato}</span>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border-l-4 border-red-500 flex flex-col justify-center">
            <span className="text-gray-500 font-bold text-sm mb-1">Da Incassare</span>
            <span className="text-3xl font-extrabold text-red-600">€{totaleDaIncassare}</span>
          </div>
        </div>

        {/* Tabella Pagamenti */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="p-4 font-bold text-gray-600 text-sm">ID</th>
                  <th className="p-4 font-bold text-gray-600 text-sm">Giocatori</th>
                  <th className="p-4 font-bold text-gray-600 text-sm">Torneo</th>
                  <th className="p-4 font-bold text-gray-600 text-sm">Quota</th>
                  <th className="p-4 font-bold text-gray-600 text-sm text-center">Stato</th>
                  <th className="p-4 font-bold text-gray-600 text-sm text-right">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {iscrizioniFiltrate.map((isc) => {
                  const saldoMancante = isc.quotaTotale - isc.quotaPagata;
                  const isSaldato = saldoMancante === 0;
                  const isAcconto = isc.quotaPagata > 0 && isc.quotaPagata < isc.quotaTotale;
                  
                  return (
                    <tr key={isc.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-semibold text-gray-500 text-sm">#{isc.id}</td>
                      <td className="p-4 font-bold text-gray-800">{isc.giocatori}</td>
                      <td className="p-4 text-sm text-gray-600">{isc.torneo}</td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800">€{isc.quotaTotale}</span>
                          <span className="text-xs text-gray-500">Pagati: €{isc.quotaPagata}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        {isSaldato ? (
                          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1">
                            ✓ Saldato
                          </span>
                        ) : isAcconto ? (
                          <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold">
                            Acconto
                          </span>
                        ) : (
                          <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold">
                            Da Pagare
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        {!isSaldato && (
                          <div className="flex justify-end gap-2">
                            <button 
                              onClick={() => registraAcconto(isc.id, Math.ceil(isc.quotaTotale / 2))}
                              className="px-3 py-1.5 text-xs font-bold bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-100 transition-colors"
                            >
                              +€{Math.ceil(isc.quotaTotale / 2)}
                            </button>
                            <button 
                              onClick={() => segnaSaldato(isc.id)}
                              className="px-3 py-1.5 text-xs font-bold bg-green-500 text-white rounded hover:bg-green-600 transition-colors shadow-sm"
                            >
                              Salda
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {iscrizioniFiltrate.length === 0 && (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-400 font-medium">
                      Nessuna iscrizione trovata.
                    </td>
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
