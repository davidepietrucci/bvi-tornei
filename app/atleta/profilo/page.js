"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function AtletaProfilo() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [userData, setUserData] = useState({
    name: "Davide Pietrucci",
    email: "davide@example.com",
    ranking: 850,
    tornei: 12,
    socioDal: "Marzo 2023",
    certificatoScadenza: "15/05/2026",
    certificatoStato: "In Scadenza"
  });

  useEffect(() => {
    // Controllo Accesso
    if (status === "unauthenticated" && localStorage.getItem("bvi_atleta_logged_in") !== "true") {
      router.push("/atleta");
      return;
    }
    
    if (session?.user) {
      setUserData(prev => ({
        ...prev,
        name: session.user.name || prev.name,
        email: session.user.email || prev.email
      }));
    }
  }, [router, status, session]);

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
            <a href="/atleta/iscrizioni" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Le Mie Iscrizioni</a>
            <a href="/atleta/gironi" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Gironi & Calendario</a>
            <a href="/atleta/iscriviti" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Invia Iscrizione</a>
            <a href="/atleta/profilo" className="px-4 py-2 rounded-lg text-sm font-bold bg-white text-[#0a1628] shadow-sm border border-gray-200 transition-all whitespace-nowrap">Profilo & Documenti</a>
          </nav>
        </div>

        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-800 font-bold border-2" style={{borderColor: "#0a1628"}}>
              {userData.name.charAt(0)}
            </div>
            <span className="font-medium text-gray-700 hidden sm:inline">{userData.name}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto mt-10 px-4">
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Colonna Sinistra: Info Profilo */}
          <div className="lg:col-span-1 flex flex-col gap-8">
            <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-100">
              <div className="h-32 bg-gradient-to-r from-[#0a1628] to-[#1a2e4a]"></div>
              <div className="px-8 pb-8 -mt-16 flex flex-col items-center">
                <div className="w-32 h-32 rounded-[2rem] bg-white p-2 shadow-2xl mb-4">
                  <div className="w-full h-full rounded-[1.5rem] bg-blue-100 flex items-center justify-center text-4xl font-black text-[#0a1628] border-4 border-white">
                    {userData.name.charAt(0)}
                  </div>
                </div>
                <h2 className="text-2xl font-black text-[#0a1628] text-center">{userData.name}</h2>
                <p className="text-gray-400 font-medium text-sm mb-6 uppercase tracking-widest">Atleta Gold</p>
                
                <div className="w-full space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <span className="text-xl">📧</span>
                    <div className="overflow-hidden">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Email</p>
                      <p className="text-sm font-bold text-gray-700 truncate">{userData.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <span className="text-xl">📅</span>
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Membro Da</p>
                      <p className="text-sm font-bold text-gray-700">{userData.socioDal}</p>
                    </div>
                  </div>
                </div>
                
                <button className="w-full mt-8 py-4 rounded-2xl border-2 border-[#0a1628] text-[#0a1628] font-bold hover:bg-[#0a1628] hover:text-white transition-all text-sm shadow-md">
                  Modifica Profilo
                </button>
              </div>
            </div>

            {/* Ranking Widget */}
            <div className="bg-[#0a1628] rounded-[2.5rem] p-8 shadow-2xl text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16"></div>
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                Ranking Stagionale <span className="text-yellow-400">★</span>
              </h3>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-5xl font-black">{userData.ranking}</p>
                  <p className="text-blue-300 font-semibold mt-1">Punti Totali</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-400">#42</p>
                  <p className="text-xs text-blue-300">Posizione</p>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-white/10 flex justify-between items-center">
                <p className="text-xs font-medium text-blue-200">Prossimo obiettivo: 1000pt</p>
                <div className="w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400 rounded-full" style={{width: '85%'}}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Colonna Destra: Documenti e Altro */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Sezione Documenti */}
            <div className="bg-white rounded-[2.5rem] shadow-lg border border-gray-100 overflow-hidden">
              <div className="p-8 border-b border-gray-50 flex justify-between items-center">
                <h3 className="text-2xl font-black text-[#0a1628]">Documenti Sportivi 📂</h3>
                <span className="px-4 py-1.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-widest">Digital Hub</span>
              </div>
              <div className="p-8 space-y-6">
                
                {/* Certificato Medico */}
                <div className="p-6 rounded-3xl border-2 border-dashed border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all group">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex gap-5 items-center">
                      <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">🏥</div>
                      <div>
                        <h4 className="text-lg font-black text-[#0a1628]">Certificato Medico Agonistico</h4>
                        <p className="text-sm text-gray-500 font-medium">Scadenza: <span className="text-gray-800">{userData.certificatoScadenza}</span></p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        userData.certificatoStato === "In Scadenza" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"
                      }`}>
                        {userData.certificatoStato}
                      </span>
                      <button className="px-6 py-2.5 rounded-xl bg-[#0a1628] text-white text-xs font-bold shadow-lg hover:shadow-[#0a1628]/20 transition-all">
                        Aggiorna File
                      </button>
                    </div>
                  </div>
                </div>

                {/* Modulo Iscrizione Associazione */}
                <div className="p-6 rounded-3xl border-2 border-dashed border-gray-100 hover:border-green-200 hover:bg-green-50/30 transition-all group">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="flex gap-5 items-center">
                      <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">📄</div>
                      <div>
                        <h4 className="text-lg font-black text-[#0a1628]">Modulo Iscrizione BVI 2024</h4>
                        <p className="text-sm text-gray-500 font-medium">Stato: <span className="text-green-600 font-bold">Approvato</span></p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                      <button className="flex-grow md:flex-none px-6 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-xs font-bold hover:bg-white transition-all">
                        Scarica
                      </button>
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">✓</div>
                    </div>
                  </div>
                </div>

              </div>
              <div className="bg-gray-50 p-6 text-center border-t border-gray-50">
                <p className="text-xs text-gray-400 font-medium italic">I documenti caricati vengono crittografati e archiviati in modo sicuro secondo il GDPR.</p>
              </div>
            </div>

            {/* Impostazioni Account */}
            <div className="bg-white rounded-[2.5rem] shadow-lg border border-gray-100 p-8">
              <h3 className="text-2xl font-black text-[#0a1628] mb-8">Preferenze Account ⚙️</h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition-colors">
                  <div>
                    <p className="font-bold text-[#0a1628]">Notifiche Push</p>
                    <p className="text-xs text-gray-400">Ricevi avvisi per nuovi tornei e scadenze</p>
                  </div>
                  <div className="w-12 h-6 bg-green-500 rounded-full p-1 cursor-pointer shadow-inner">
                    <div className="w-4 h-4 bg-white rounded-full ml-auto shadow-sm"></div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-2xl transition-colors">
                  <div>
                    <p className="font-bold text-[#0a1628]">Profilo Pubblico</p>
                    <p className="text-xs text-gray-400">Permetti agli altri di vedere il tuo ranking</p>
                  </div>
                  <div className="w-12 h-6 bg-gray-200 rounded-full p-1 cursor-pointer shadow-inner">
                    <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </main>
  );
}
