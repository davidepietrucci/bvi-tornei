"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Iscrizioni() {
  const router = useRouter();
  const [torneiAperti, setTorneiAperti] = useState([]);
  const [showModal, setShowModal] = useState(false);
  
  const [formData, setFormData] = useState({
    torneo: "",
    giocatore1: "",
    email1: "",
    tel1: "",
    giocatore2: "",
    email2: "",
    tel2: "",
    note: ""
  });

  useEffect(() => {
    const saved = localStorage.getItem("bvi_tornei");
    if (saved) {
      const allTornei = JSON.parse(saved);
      // Mostriamo solo i tornei aperti se possibile
      const aperti = allTornei.filter(t => t.stato === "Iscrizioni Aperte" || !t.stato);
      const daMostrare = aperti.length > 0 ? aperti : allTornei;
      
      setTorneiAperti(daMostrare);
      
      if (daMostrare.length > 0) {
        setFormData(prev => ({ ...prev, torneo: daMostrare[0].nome }));
      }
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const savedIscrizioni = localStorage.getItem("bvi_iscrizioni");
    const iscrizioni = savedIscrizioni ? JSON.parse(savedIscrizioni) : [];
    
    // Generiamo ID numerico
    const numericIds = iscrizioni.map(i => parseInt(i.id)).filter(id => !isNaN(id));
    const newId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 100;
    
    const oggi = new Date();
    const dataFormatted = `${oggi.getDate().toString().padStart(2, '0')}/${(oggi.getMonth() + 1).toString().padStart(2, '0')}/${oggi.getFullYear()}`;

    const nuovaIscrizione = {
      id: newId.toString(),
      data: dataFormatted,
      torneo: formData.torneo,
      giocatori: `${formData.giocatore1} & ${formData.giocatore2}`,
      tel: formData.tel1 || formData.tel2 || "Non inserito",
      email: formData.email1 || formData.email2 || "Non inserita",
      note: formData.note,
      stato: "In Attesa",
      quotaPagata: 0
    };

    // Salvataggio
    const updatedIscrizioni = [...iscrizioni, nuovaIscrizione];
    localStorage.setItem("bvi_iscrizioni", JSON.stringify(updatedIscrizioni));

    // Aumentiamo il contatore di iscritti del torneo selezionato
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

    setShowModal(true);
  };

  return (
    <main className="min-h-screen pb-12 relative" style={{ backgroundColor: "#f0f4ff" }}>
      {/* Header */}
      <header style={{ backgroundColor: "#0a1628" }} className="text-white py-4 px-8 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="BVI Logo" width={50} height={50} className="object-contain" />
          <h1 className="text-2xl font-bold" style={{ color: "#FFD700" }}>BVI Tornei</h1>
        </div>
        <nav className="flex gap-4 items-center">
          <a href="/" className="hover:underline font-medium text-white">Home</a>
          <a href="/tornei" className="hover:underline font-medium text-white">Tornei</a>
          <a href="/classifica" className="hover:underline font-medium text-white">Classifica</a>
        </nav>
      </header>

      {/* Form Section */}
      <div className="max-w-3xl mx-auto mt-12 px-4">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-t-4" style={{ borderColor: "#FFD700" }}>
          <div className="p-8 md:p-12">
            <h2 className="text-3xl font-extrabold mb-2" style={{ color: "#0a1628" }}>Modulo d'Iscrizione al Torneo 📝</h2>
            <p className="text-gray-500 mb-8 font-medium">Compila i dati della tua squadra per richiedere la partecipazione. Lo staff valuterà la richiesta e ti invierà la conferma via email o telefono.</p>

            {torneiAperti.length === 0 ? (
               <div className="bg-blue-50 border border-blue-100 p-8 rounded-xl text-center">
                 <h3 className="text-xl font-bold text-gray-800 mb-2">Nessun torneo aperto</h3>
                 <p className="text-gray-500">Al momento non ci sono tornei con iscrizioni aperte. Torna a controllare più tardi!</p>
               </div>
            ) : (
              <form className="space-y-6" onSubmit={handleSubmit}>
                {/* Selezione Torneo */}
                <div>
                  <h3 className="text-xl font-bold border-b pb-2 mb-4" style={{ color: "#0a1628" }}>Selezione Torneo</h3>
                  <div className="grid grid-cols-1 gap-5">
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                      <label className="block text-sm font-bold text-[#0a1628] mb-2">Tornei Attivi </label>
                      <select 
                        name="torneo"
                        required
                        value={formData.torneo}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white font-semibold text-gray-800 shadow-sm cursor-pointer"
                      >
                        {torneiAperti.map((t, idx) => (
                          <option key={idx} value={t.nome}>{t.nome} - {t.data} {t.categoria ? `(${t.categoria})` : ''}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Giocatori */}
                <div className="pt-4">
                  <h3 className="text-xl font-bold border-b pb-2 mb-4" style={{ color: "#0a1628" }}>Anagrafica Giocatori</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Giocatore 1 */}
                    <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <h4 className="font-semibold text-gray-800">Giocatore 1 (Referente)</h4>
                      <input type="text" name="giocatore1" value={formData.giocatore1} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" placeholder="Nome e Cognome" />
                      <input type="email" name="email1" value={formData.email1} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" placeholder="Email" />
                      <input type="tel" name="tel1" value={formData.tel1} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" placeholder="Telefono (WhatsApp)" />
                    </div>
                    {/* Giocatore 2 */}
                    <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <h4 className="font-semibold text-gray-800">Giocatore 2</h4>
                      <input type="text" name="giocatore2" value={formData.giocatore2} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" placeholder="Nome e Cognome" />
                      <input type="email" name="email2" value={formData.email2} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" placeholder="Email (Opzionale)" />
                      <input type="tel" name="tel2" value={formData.tel2} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" placeholder="Telefono (Opzionale)" />
                    </div>
                  </div>
                </div>

                {/* Note */}
                <div className="pt-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Note / Richieste per lo Staff</label>
                  <textarea name="note" value={formData.note} onChange={handleChange} rows="3" className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-400" placeholder="Es. Arriveremo con 30 minuti di ritardo..."></textarea>
                </div>

                {/* Submit */}
                <div className="pt-6">
                  <button type="submit" className="w-full py-4 rounded-full font-bold text-white text-lg transition-all shadow-md hover:opacity-90 hover:shadow-lg" style={{ backgroundColor: "#0a1628" }}>
                    Invia Richiesta di Iscrizione
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
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
              La tua richiesta è stata trasmessa allo staff in attesa di conferma.
            </p>
            <button 
              onClick={() => {
                setShowModal(false);
                router.push("/");
              }}
              className="w-full py-4 rounded-xl font-bold text-white shadow-md hover:opacity-90 transition-all text-lg"
              style={{backgroundColor: "#0a1628"}}
            >
              Torna alla Home
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
