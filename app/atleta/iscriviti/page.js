"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AtletaIscriviti() {
  const router = useRouter();
  const [torneiAperti, setTorneiAperti] = useState([]);
  const [showModal, setShowModal] = useState(false);
  
  const [formData, setFormData] = useState({
    torneo: "",
    giocatore1: "Davide Pietrucci", // precompilato per finta come l'utente loggato
    giocatore2: "",
    telefono: "",
    email: "davide@example.com"
  });

  useEffect(() => {
    // Controllo Accesso
    if (localStorage.getItem("bvi_atleta_logged_in") !== "true") {
      router.push("/atleta");
      return;
    }

    const saved = localStorage.getItem("bvi_tornei");
    if (saved) {
      const allTornei = JSON.parse(saved);
      const aperti = allTornei.filter(t => t.stato === "Iscrizioni Aperte");
      setTorneiAperti(aperti);
      if (aperti.length > 0) {
        setFormData(prev => ({ ...prev, torneo: aperti[0].nome }));
      }
    }
  }, [router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Creiamo la nuova iscrizione
    const savedIscrizioni = localStorage.getItem("bvi_iscrizioni");
    const iscrizioni = savedIscrizioni ? JSON.parse(savedIscrizioni) : [];
    
    // Generiamo ID numerico
    const numericIds = iscrizioni.map(i => parseInt(i.id)).filter(id => !isNaN(id));
    const newId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 100;
    
    // Data formattata oggi
    const oggi = new Date();
    const dataFormatted = `${oggi.getDate().toString().padStart(2, '0')}/${(oggi.getMonth() + 1).toString().padStart(2, '0')}/${oggi.getFullYear()}`;

    const nuovaIscrizione = {
      id: newId.toString(),
      data: dataFormatted,
      torneo: formData.torneo,
      giocatori: `${formData.giocatore1} & ${formData.giocatore2}`,
      tel: formData.telefono,
      email: formData.email,
      stato: "In Attesa",
      quotaPagata: 0
    };

    // Salvataggio
    const updatedIscrizioni = [...iscrizioni, nuovaIscrizione];
    localStorage.setItem("bvi_iscrizioni", JSON.stringify(updatedIscrizioni));

    // Aumentiamo il contatore di iscritti del torneo
    const savedTornei = localStorage.getItem("bvi_tornei");
    if (savedTornei) {
      const tornei = JSON.parse(savedTornei);
      const updatedTornei = tornei.map(t => {
        if (t.nome === formData.torneo) {
          return { ...t, iscritti: (t.iscritti || 0) + 1 };
        }
        return t;
      });
      localStorage.setItem("bvi_tornei", JSON.stringify(updatedTornei));
    }

    // Mostra il popup di conferma
    setShowModal(true);
  };

  return (
    <main className="min-h-screen pb-12 relative" style={{backgroundColor: "#f0f4ff"}}>
      
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
            <a href="/atleta/iscriviti" className="px-4 py-2 rounded-lg text-sm font-bold bg-white text-[#0a1628] shadow-sm border border-gray-200 transition-all whitespace-nowrap">Invia Iscrizione</a>
            <a href="/atleta/profilo" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Profilo & Documenti</a>
          </nav>
        </div>

        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-800 font-bold border-2" style={{borderColor: "#0a1628"}}>
              D
            </div>
            <span className="font-medium text-gray-700 hidden sm:inline">Davide P.</span>
          </div>
          <button onClick={() => { localStorage.removeItem("bvi_atleta_logged_in"); router.push("/"); }} className="hover:underline font-bold text-red-500 text-sm ml-4">
            Esci
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto mt-10 px-4">
        
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => router.push("/atleta/dashboard")}
            className="text-gray-500 hover:text-gray-800 transition-colors bg-white p-2 rounded-full shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <h2 className="text-3xl font-extrabold" style={{color: "#0a1628"}}>Richiesta di Iscrizione</h2>
        </div>

        {torneiAperti.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl shadow-md text-center">
            <span className="text-4xl block mb-4">🏜️</span>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Nessun torneo aperto</h3>
            <p className="text-gray-500">Al momento non ci sono tornei con iscrizioni aperte. Torna a controllare più tardi!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="p-8 flex flex-col gap-6">
              
              {/* Torneo */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700">Seleziona Torneo</label>
                <select 
                  name="torneo" 
                  required
                  value={formData.torneo} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0a1628] bg-gray-50 font-semibold"
                >
                  {torneiAperti.map(t => (
                    <option key={t.id} value={t.nome}>{t.nome} - {t.data} ({t.categoria})</option>
                  ))}
                </select>
              </div>

              {/* Giocatori */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-gray-700">Giocatore 1 (Tu)</label>
                  <input 
                    type="text" 
                    name="giocatore1" 
                    required
                    value={formData.giocatore1} 
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0a1628] bg-gray-100 text-gray-600" 
                    readOnly // Simula l'utente già loggato
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-gray-700">Giocatore 2 (Compagno)</label>
                  <input 
                    type="text" 
                    name="giocatore2" 
                    required
                    value={formData.giocatore2} 
                    onChange={handleChange}
                    placeholder="es. Elena M." 
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0a1628]" 
                  />
                </div>
              </div>

              {/* Contatti */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-gray-700">Telefono per comunicazioni</label>
                  <input 
                    type="tel" 
                    name="telefono" 
                    required
                    value={formData.telefono} 
                    onChange={handleChange}
                    placeholder="es. 333 1234567" 
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0a1628]" 
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-bold text-gray-700">Email di Conferma</label>
                  <input 
                    type="email" 
                    name="email" 
                    required
                    value={formData.email} 
                    onChange={handleChange}
                    placeholder="tua@email.com" 
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0a1628]" 
                  />
                  <p className="text-xs text-gray-500 mt-1">A questo indirizzo invieremo la mail di avvenuta ricezione.</p>
                </div>
              </div>

            </div>
            
            {/* Footer Form */}
            <div className="bg-gray-50 p-6 border-t border-gray-200 flex justify-end gap-4">
              <button 
                type="submit" 
                className="px-8 py-4 rounded-xl font-extrabold text-white shadow-lg hover:opacity-90 transition-all text-lg w-full md:w-auto flex items-center justify-center gap-2"
                style={{backgroundColor: "#0a1628"}}
              >
                Invia Richiesta
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* POPUP MODAL DI SUCCESSO */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center border-t-8 border-green-500 transform animate-[bounce_0.5s_ease-out]">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">✅</span>
            </div>
            <h3 className="text-2xl font-extrabold text-gray-800 mb-2">Iscrizione Inviata!</h3>
            <p className="text-gray-600 mb-6 leading-relaxed">
              La tua richiesta è stata trasmessa allo staff. Un'email di conferma è stata appena recapitata all'indirizzo <strong className="text-[#0a1628]">{formData.email}</strong>.
            </p>
            <button 
              onClick={() => {
                setShowModal(false);
                router.push("/atleta/dashboard");
              }}
              className="w-full py-4 rounded-xl font-bold text-white shadow-md hover:opacity-90 transition-all text-lg"
              style={{backgroundColor: "#0a1628"}}
            >
              Torna alla Dashboard
            </button>
          </div>
        </div>
      )}

    </main>
  );
}
