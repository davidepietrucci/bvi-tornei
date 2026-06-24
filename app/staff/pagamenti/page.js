"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import StaffHeader from "@/app/components/StaffHeader";
import { getTornei, getIscrizioni, saveIscrizioni } from "@/app/utils/db";

export default function StaffPagamenti() {
  const router = useRouter();
  const [iscrizioni, setIscrizioni] = useState([]);
  const [filtroTorneo, setFiltroTorneo] = useState("Tutti");
  const [cercaTeam, setCercaTeam] = useState("");

  useEffect(() => {
    Promise.all([getIscrizioni(), getTornei()]).then(([iscrizioniList, torneiList]) => {
      const data = iscrizioniList.map(isc => {
        const torneoInfo = torneiList.find(t => (isc.torneo || "").toLowerCase().trim() === t.nome.toLowerCase().trim()) || torneiList.find(t => isc.torneo && t.nome && isc.torneo.toLowerCase().includes(t.nome.toLowerCase()));
        const quotaTorneo = torneoInfo?.quota !== undefined ? torneoInfo.quota : 40;

        const players = (isc.giocatori || "").split("-").map(p => p.trim()).filter(Boolean);
        const numPlayers = players.length;

        let pagatoPlayer1 = isc.pagatoPlayer1;
        let pagatoPlayer2 = isc.pagatoPlayer2;

        // Dynamic initialization from quotaPagata if not explicitly defined in the DB
        if (pagatoPlayer1 === undefined && pagatoPlayer2 === undefined) {
          if (numPlayers <= 1) {
            pagatoPlayer1 = (isc.quotaPagata || 0) >= quotaTorneo;
          } else {
            if ((isc.quotaPagata || 0) >= quotaTorneo) {
              pagatoPlayer1 = true;
              pagatoPlayer2 = true;
            } else if ((isc.quotaPagata || 0) >= quotaTorneo / 2) {
              pagatoPlayer1 = true;
              pagatoPlayer2 = false;
            } else {
              pagatoPlayer1 = false;
              pagatoPlayer2 = false;
            }
          }
        } else {
          pagatoPlayer1 = pagatoPlayer1 || false;
          pagatoPlayer2 = pagatoPlayer2 || false;
        }

        return {
          ...isc,
          quotaTotale: quotaTorneo, 
          quotaPagata: isc.quotaPagata || 0,
          pagatoPlayer1,
          pagatoPlayer2
        };
      });
      setIscrizioni(data);
    });
  }, []);

  const salvaModifiche = async (newData) => {
    setIscrizioni(newData);
    await saveIscrizioni(newData);
  };

  const segnaSaldato = (id) => {
    const newData = iscrizioni.map(isc => 
      isc.id === id 
        ? { ...isc, quotaPagata: isc.quotaTotale, pagatoPlayer1: true, pagatoPlayer2: true } 
        : isc
    );
    salvaModifiche(newData);
  };

  const registraAcconto = (id, importo) => {
    const newData = iscrizioni.map(isc => {
      if (isc.id === id) {
        const players = (isc.giocatori || "").split("-").map(p => p.trim()).filter(Boolean);
        const numPlayers = players.length;

        let p1 = isc.pagatoPlayer1;
        let p2 = isc.pagatoPlayer2;

        if (numPlayers <= 1) {
          p1 = true;
        } else {
          // Mark the first unpaid player as paid
          if (!p1) {
            p1 = true;
          } else if (!p2) {
            p2 = true;
          }
        }

        let nuovaQuotaPagata = 0;
        if (numPlayers <= 1) {
          nuovaQuotaPagata = p1 ? isc.quotaTotale : 0;
        } else {
          const quotaMezzo = isc.quotaTotale / 2;
          if (p1) nuovaQuotaPagata += quotaMezzo;
          if (p2) nuovaQuotaPagata += quotaMezzo;
        }

        return {
          ...isc,
          pagatoPlayer1: p1,
          pagatoPlayer2: p2,
          quotaPagata: nuovaQuotaPagata
        };
      }
      return isc;
    });
    salvaModifiche(newData);
  };

  const togglePlayerPayment = (id, playerIndex) => {
    const newData = iscrizioni.map(isc => {
      if (isc.id === id) {
        const players = (isc.giocatori || "").split("-").map(p => p.trim()).filter(Boolean);
        const numPlayers = players.length;

        let p1 = isc.pagatoPlayer1;
        let p2 = isc.pagatoPlayer2;

        if (playerIndex === 0) {
          p1 = !p1;
        } else if (playerIndex === 1) {
          p2 = !p2;
        }

        let nuovaQuotaPagata = 0;
        if (numPlayers <= 1) {
          nuovaQuotaPagata = p1 ? isc.quotaTotale : 0;
        } else {
          const quotaMezzo = isc.quotaTotale / 2;
          if (p1) nuovaQuotaPagata += quotaMezzo;
          if (p2) nuovaQuotaPagata += quotaMezzo;
        }

        return {
          ...isc,
          pagatoPlayer1: p1,
          pagatoPlayer2: p2,
          quotaPagata: nuovaQuotaPagata
        };
      }
      return isc;
    });
    salvaModifiche(newData);
  };

  const azzeraPagamento = (id) => {
    const newData = iscrizioni.map(isc => 
      isc.id === id 
        ? { ...isc, quotaPagata: 0, pagatoPlayer1: false, pagatoPlayer2: false } 
        : isc
    );
    salvaModifiche(newData);
  };

  const torneiDisponibili = ["Tutti", ...new Set(iscrizioni.map(i => i.torneo))];

  const iscrizioniFiltrate = iscrizioni.filter(isc => {
    const matchesTorneo = filtroTorneo === "Tutti" || (isc.torneo || "").toLowerCase().trim() === filtroTorneo.toLowerCase().trim();
    const matchesCerca = !cercaTeam.trim() ||
      (isc.giocatori || "").toLowerCase().includes(cercaTeam.toLowerCase()) ||
      (isc.id && String(isc.id).includes(cercaTeam)) ||
      (isc.torneo || "").toLowerCase().includes(cercaTeam.toLowerCase());
    return matchesTorneo && matchesCerca;
  });

  const totaleAtteso = iscrizioniFiltrate.reduce((acc, curr) => acc + curr.quotaTotale, 0);
  const totaleIncassato = iscrizioniFiltrate.reduce((acc, curr) => acc + curr.quotaPagata, 0);
  const totaleDaIncassare = totaleAtteso - totaleIncassato;

  return (
    <main className="min-h-screen bg-[#f8faff] pb-20">
      <StaffHeader />

      <div className="max-w-6xl mx-auto mt-6 md:mt-10 px-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
            <div>
                <h2 className="text-3xl md:text-5xl font-black text-[#0a1628] uppercase tracking-tighter leading-none">Pagamenti 💰</h2>
                <p className="text-[10px] md:text-xs text-gray-400 font-bold uppercase tracking-widest mt-2">Gestione Incassi e Saldi</p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                {/* CERCA TEAM */}
                <div className="w-full sm:w-64 bg-white px-6 py-4 rounded-2xl shadow-xl border border-gray-100 flex flex-col gap-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Cerca Team</span>
                    <input 
                        type="text"
                        value={cercaTeam}
                        onChange={(e) => setCercaTeam(e.target.value)}
                        placeholder="Nome team o giocatore..."
                        className="bg-transparent text-sm font-bold focus:outline-none text-[#0a1628] placeholder-gray-300 w-full"
                    />
                </div>

                {/* FILTRA TORNEO */}
                <div className="w-full sm:w-48 bg-white px-6 py-4 rounded-2xl shadow-xl border border-gray-100 flex flex-col gap-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Filtra Torneo</span>
                    <select 
                        value={filtroTorneo} 
                        onChange={(e) => setFiltroTorneo(e.target.value)}
                        className="bg-transparent text-sm font-black focus:outline-none cursor-pointer text-[#0a1628] w-full"
                    >
                        {torneiDisponibili.map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>

        {/* Dashboard Statistiche */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white rounded-[2rem] p-8 shadow-xl border-b-8 border-blue-500 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 relative z-10">Totale Atteso</span>
            <span className="text-4xl font-black text-blue-600 relative z-10">€{totaleAtteso}</span>
          </div>
          <div className="bg-white rounded-[2rem] p-8 shadow-xl border-b-8 border-green-500 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 relative z-10">Totale Incassato</span>
            <span className="text-4xl font-black text-green-600 relative z-10">€{totaleIncassato}</span>
          </div>
          <div className="bg-white rounded-[2rem] p-8 shadow-xl border-b-8 border-red-500 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-full -mr-12 -mt-12 group-hover:scale-150 transition-transform duration-500"></div>
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 relative z-10">Da Incassare</span>
            <span className="text-4xl font-black text-red-600 relative z-10">€{totaleDaIncassare}</span>
          </div>
        </div>

        {/* Mobile-Friendly List */}
        <div className="space-y-6">
          {iscrizioniFiltrate.map((isc) => {
            const saldoMancante = isc.quotaTotale - isc.quotaPagata;
            const isSaldato = saldoMancante === 0;
            const isAcconto = isc.quotaPagata > 0 && isc.quotaPagata < isc.quotaTotale;
            
            return (
              <div key={isc.id} className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all hover:shadow-2xl">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <span className="bg-gray-100 text-gray-400 text-[10px] font-black px-3 py-1 rounded-lg">#{isc.id}</span>
                    {isSaldato ? (
                      <span className="bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">Saldato ✓</span>
                    ) : isAcconto ? (
                      <span className="bg-yellow-100 text-yellow-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">Acconto</span>
                    ) : (
                      <span className="bg-red-100 text-red-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">Da Pagare</span>
                    )}
                  </div>
                  
                  <h3 className="text-2xl font-black text-[#0a1628] leading-tight mb-3">{isc.giocatori}</h3>
                  
                  {/* Divisione dei due giocatori */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(() => {
                      const players = (isc.giocatori || "").split("-").map(p => p.trim()).filter(Boolean);
                      return players.map((player, idx) => {
                        const isPaid = idx === 0 ? isc.pagatoPlayer1 : isc.pagatoPlayer2;
                        return (
                          <button
                            key={idx}
                            onClick={() => togglePlayerPayment(isc.id, idx)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                              isPaid 
                                ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100" 
                                : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                            }`}
                          >
                            <svg className="w-3 h-3 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            {player} ({isPaid ? "PAGATO" : "DA PAGARE"})
                          </button>
                        );
                      });
                    })()}
                  </div>
                  
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{isc.torneo}</p>
                </div>

                <div className="flex flex-col md:items-end gap-1">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Stato Contabile</span>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-[#0a1628]">€{isc.quotaPagata}</span>
                        <span className="text-gray-300 font-bold text-lg">/ €{isc.quotaTotale}</span>
                    </div>
                </div>

                <div className="flex gap-2">
                  {isc.quotaPagata > 0 && (
                    <button 
                      onClick={() => {
                        if (window.confirm(`Sei sicuro di voler azzerare il pagamento per "${isc.giocatori}"?`)) {
                          azzeraPagamento(isc.id);
                        }
                      }}
                      className="flex-1 md:flex-none bg-red-50 text-red-600 hover:bg-red-100 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95"
                    >
                      Azzera 🔄
                    </button>
                  )}
                  {!isSaldato && (
                    <>
                      <button 
                        onClick={() => registraAcconto(isc.id, Math.ceil(isc.quotaTotale / 2))}
                        className="flex-1 md:flex-none bg-gray-50 text-[#0a1628] px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-100 transition-all active:scale-95"
                      >
                        +€{Math.ceil(isc.quotaTotale / 2)}
                      </button>
                      <button 
                        onClick={() => segnaSaldato(isc.id)}
                        className="flex-1 md:flex-none bg-[#0a1628] text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all"
                      >
                        Salda Ora
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          
          {iscrizioniFiltrate.length === 0 && (
            <div className="text-center py-20">
              <span className="text-6xl block mb-6">📉</span>
              <h4 className="text-2xl font-black text-gray-300 uppercase tracking-tighter">Nessun dato trovato</h4>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
