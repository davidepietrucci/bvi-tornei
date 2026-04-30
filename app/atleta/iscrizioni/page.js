"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function MieIscrizioni() {
  const { data: session, status } = useSession();
  const [iscrizioni, setIscrizioni] = useState([]);
  const [filter, setFilter] = useState("Tutte");
  const router = useRouter();

  useEffect(() => {
    // Controllo Accesso (simulato o reale via next-auth)
    if (status === "unauthenticated" && localStorage.getItem("bvi_atleta_logged_in") !== "true") {
      router.push("/atleta");
      return;
    }

    const saved = localStorage.getItem("bvi_iscrizioni");
    if (saved) {
      const allIscrizioni = JSON.parse(saved);
      // Filtriamo per l'utente loggato (mock Davide P. se non c'è sessione)
      const nomeUtente = session?.user?.name || "Davide P.";
      const mie = allIscrizioni.filter(isc => isc.giocatori.includes(nomeUtente));
      setIscrizioni(mie);
    } else {
      // Dati mock iniziali se localStorage è vuoto
      setIscrizioni([
        { id: "101", data: "15/08/2024", torneo: "Torneo di Ferragosto - Misto 2x2", giocatori: "Davide P. & Elena M.", stato: "In Attesa" }
      ]);
    }
  }, [router, status, session]);

  const filteredIscrizioni = filter === "Tutte" 
    ? iscrizioni 
    : iscrizioni.filter(i => i.stato === filter);

  if (status === "loading") return <div className="min-h-screen flex items-center justify-center font-bold text-[#0a1628]">Caricamento...</div>;

  return (
    <main className="min-h-screen pb-12" style={{backgroundColor: "#f0f4ff"}}>
      {/* Header Atleta */}
      <header className="bg-white py-4 px-8 flex flex-col md:flex-row justify-between items-center shadow-md border-b-4 gap-4" style={{borderColor: "#FFD700"}}>
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="BVI Logo" width={50} height={50} className="object-contain" />
            <h1 className="text-2xl font-bold" style={{color: "#0a1628"}}>Area Atleta</h1>
          </div>
          
          <nav className="flex gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200 overflow-x-auto">
            <a href="/atleta/dashboard" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Dashboard</a>
            <a href="/atleta/iscrizioni" className="px-4 py-2 rounded-lg text-sm font-bold bg-white text-[#0a1628] shadow-sm border border-gray-200 transition-all whitespace-nowrap">Le Mie Iscrizioni</a>
            <a href="/atleta/gironi" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Gironi & Calendario</a>
            <a href="/atleta/iscriviti" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Invia Iscrizione</a>
            <a href="/atleta/profilo" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Profilo & Documenti</a>
          </nav>
        </div>

        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-800 font-bold border-2" style={{borderColor: "#0a1628"}}>
              {session?.user?.name ? session.user.name.charAt(0) : "D"}
            </div>
            <span className="font-medium text-gray-700 hidden sm:inline">{session?.user?.name || "Davide P."}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto mt-10 px-4">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
          <div>
            <h2 className="text-4xl font-black tracking-tight" style={{color: "#0a1628"}}>Le Mie Iscrizioni 📝</h2>
            <p className="text-gray-500 mt-2 text-lg">Storico e stato dei tuoi tornei Beach Volley.</p>
          </div>
          
          <div className="flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-200 self-start md:self-auto">
            {["Tutte", "In Attesa", "Approvata"].map((f) => (
              <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                  filter === f 
                  ? "bg-[#0a1628] text-white shadow-lg scale-105" 
                  : "text-gray-500 hover:text-[#0a1628] hover:bg-gray-50"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {filteredIscrizioni.length > 0 ? (
          <div className="grid grid-cols-1 gap-6">
            {filteredIscrizioni.map((isc) => (
              <div key={isc.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 group">
                <div className="flex flex-col lg:flex-row">
                  
                  {/* Colonna Torneo */}
                  <div className="p-8 lg:w-1/3 bg-gradient-to-br from-gray-50 to-white border-r border-gray-50 flex flex-col justify-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest mb-4 w-fit">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                      Torneo Attivo
                    </div>
                    <h3 className="text-2xl font-black leading-tight mb-4" style={{color: "#0a1628"}}>{isc.torneo}</h3>
                    <div className="flex items-center gap-3 text-gray-500 font-semibold">
                      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-xl">📅</div>
                      <span>{isc.data}</span>
                    </div>
                  </div>

                  {/* Colonna Squadra & Stato */}
                  <div className="p-8 flex-grow flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                    <div className="flex gap-5 items-center">
                      <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center text-3xl shadow-inner border border-orange-100">🏐</div>
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">Squadra & Partner</p>
                        <p className="text-xl font-black text-gray-800">{isc.giocatori}</p>
                        <p className="text-xs text-gray-400 mt-1 font-medium">Telefono: {isc.tel || "N/A"}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                      <div className={`px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-sm border ${
                        isc.stato === "Approvata" ? "bg-green-50 text-green-700 border-green-100" : 
                        isc.stato === "In Attesa" ? "bg-yellow-50 text-yellow-700 border-yellow-100" : 
                        "bg-red-50 text-red-700 border-red-100"
                      }`}>
                        {isc.stato}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-500 font-mono">ID #{isc.id}</span>
                        {isc.quotaPagata > 0 && (
                          <span className="text-[10px] bg-green-100 px-2 py-1 rounded text-green-700 font-bold">PAGATA</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Colonna Azioni */}
                  <div className="p-8 lg:w-56 flex flex-col items-center justify-center border-t lg:border-t-0 lg:border-l border-gray-50 bg-gray-50/30 gap-3">
                    <button className="w-full py-4 rounded-2xl bg-[#0a1628] text-white font-bold hover:shadow-lg hover:-translate-y-1 transition-all text-sm shadow-md">
                      Dettagli
                    </button>
                    <button className="w-full py-3 rounded-2xl border-2 border-gray-200 text-gray-500 font-bold hover:bg-white hover:text-[#0a1628] hover:border-[#0a1628] transition-all text-xs">
                      Contatta Staff
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white p-24 rounded-[3rem] shadow-xl border border-gray-100 text-center relative overflow-hidden">
            {/* Elementi Decorativi */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-32 -mt-32 opacity-50"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-yellow-50 rounded-full -ml-24 -mb-24 opacity-50"></div>
            
            <div className="relative z-10">
              <div className="text-8xl mb-8 animate-bounce inline-block">🏐</div>
              <h3 className="text-3xl font-black text-gray-800 mb-4">Ancora Nessuna Iscrizione?</h3>
              <p className="text-gray-500 mb-10 max-w-md mx-auto text-lg leading-relaxed">
                Non perdere l'occasione di scendere in campo! Dai un'occhiata ai prossimi tornei e prenota il tuo posto.
              </p>
              <a 
                href="/atleta/iscriviti" 
                className="inline-flex items-center gap-3 px-10 py-5 bg-[#0a1628] text-white rounded-2xl font-black shadow-2xl hover:scale-105 hover:rotate-1 transition-all group"
              >
                VAI AI TORNEI APERTI
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5 group-hover:translate-x-2 transition-transform">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </a>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
