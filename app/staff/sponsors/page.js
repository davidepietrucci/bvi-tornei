"use client";

import { useState, useEffect } from "react";
import StaffHeader from "@/app/components/StaffHeader";
import { getSponsors, saveSponsors } from "@/app/utils/db";

export default function StaffSponsorsPage() {
  const [sponsorsList, setSponsorsList] = useState([]);
  const [sponsorForm, setSponsorForm] = useState({ nome: "", logoUrl: "", linkUrl: "" });
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    getSponsors().then((data) => {
      setSponsorsList(data || []);
      setLoading(false);
    });
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert("L'immagine è troppo grande. Seleziona un file inferiore a 1MB.");
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSponsorForm((prev) => ({ ...prev, logoUrl: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddSponsor = async (e) => {
    e.preventDefault();
    if (!sponsorForm.nome.trim() || !sponsorForm.logoUrl.trim()) {
      alert("Inserisci un nome e carica un logo per lo sponsor.");
      return;
    }

    setIsSaving(true);
    const newSponsor = {
      id: Date.now().toString(),
      nome: sponsorForm.nome.trim(),
      logoUrl: sponsorForm.logoUrl.trim(),
      linkUrl: sponsorForm.linkUrl.trim()
    };

    const updatedSponsors = [...sponsorsList, newSponsor];
    setSponsorsList(updatedSponsors);
    setSponsorForm({ nome: "", logoUrl: "", linkUrl: "" });

    try {
      await saveSponsors(updatedSponsors);
      alert("Sponsor aggiunto con successo!");
    } catch (err) {
      console.error(err);
      alert("Errore nel salvataggio dello sponsor.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveSponsor = async (id) => {
    if (typeof window !== "undefined" && !window.confirm("Sei sicuro di voler eliminare questo sponsor?")) {
      return;
    }

    setIsSaving(true);
    const updatedSponsors = sponsorsList.filter((sp) => sp.id !== id);
    setSponsorsList(updatedSponsors);

    try {
      await saveSponsors(updatedSponsors);
    } catch (err) {
      console.error(err);
      alert("Errore nell'eliminazione dello sponsor.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen pb-12 bg-[#f8faff]">
      <StaffHeader />

      <div className="max-w-5xl mx-auto mt-6 md:mt-10 px-4">
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-3xl md:text-5xl font-black text-[#0a1628] uppercase tracking-tighter leading-none">
              Gestione Sponsor 🤝
            </h2>
            <p className="text-[10px] md:text-xs text-gray-400 font-bold uppercase tracking-widest mt-2">
              Aggiungi o rimuovi gli sponsor visibili sulla piattaforma
            </p>
          </div>
        </div>

        {/* Form Aggiunta Sponsor */}
        <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-2xl border border-white relative overflow-hidden mb-8">
          <h3 className="text-xl font-black uppercase tracking-tight text-[#0a1628] mb-6">
            Aggiungi Nuovo Sponsor
          </h3>

          <form onSubmit={handleAddSponsor} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                  Nome Sponsor *
                </label>
                <input
                  type="text"
                  placeholder="es. Decathlon"
                  value={sponsorForm.nome}
                  onChange={(e) => setSponsorForm((prev) => ({ ...prev, nome: e.target.value }))}
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs font-bold text-[#0a1628] focus:ring-2 focus:ring-[#0a1628] outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                  Carica Logo (PNG/JPG max 1MB) *
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  required={!sponsorForm.logoUrl}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs font-bold text-[#0a1628] focus:ring-2 focus:ring-[#0a1628] file:mr-3 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-[#0a1628] file:text-white hover:file:bg-[#FFD700] hover:file:text-[#0a1628] cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                  Link Sito Web (Opzionale)
                </label>
                <input
                  type="url"
                  placeholder="es. https://www.decathlon.it"
                  value={sponsorForm.linkUrl}
                  onChange={(e) => setSponsorForm((prev) => ({ ...prev, linkUrl: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs font-bold text-[#0a1628] focus:ring-2 focus:ring-[#0a1628] outline-none"
                />
              </div>
            </div>

            {/* Anteprima logo */}
            {sponsorForm.logoUrl && (
              <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-200 max-w-max shadow-sm">
                <img
                  src={sponsorForm.logoUrl}
                  alt="Anteprima Logo"
                  className="w-12 h-12 object-contain rounded-xl bg-white p-1.5 border border-gray-200"
                />
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                  Anteprima Logo caricato
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-white bg-[#0a1628] hover:bg-[#FFD700] hover:text-[#0a1628] hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer"
            >
              {isSaving ? "Salvataggio..." : "Inserisci Sponsor ➕"}
            </button>
          </form>
        </div>

        {/* Lista Sponsor */}
        <div className="bg-white p-6 md:p-10 rounded-[2.5rem] shadow-2xl border border-white relative overflow-hidden">
          <h3 className="text-xl font-black uppercase tracking-tight text-[#0a1628] mb-6">
            Sponsor Attivi ({sponsorsList.length})
          </h3>

          {loading ? (
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center py-8">
              Caricamento sponsor...
            </p>
          ) : sponsorsList.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {sponsorsList.map((sp) => (
                <div
                  key={sp.id || sp.nome}
                  className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-2xl shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    {sp.logoUrl && (
                      <img
                        src={sp.logoUrl}
                        alt={sp.nome}
                        className="w-12 h-12 object-contain rounded-xl bg-white p-1 border border-gray-200 shrink-0"
                      />
                    )}
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-xs font-black text-[#0a1628] truncate">
                        {sp.nome}
                      </span>
                      {sp.linkUrl ? (
                        <a
                          href={sp.linkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[9px] font-black text-blue-600 hover:underline truncate"
                        >
                          Visita sito 🔗
                        </a>
                      ) : (
                        <span className="text-[9px] font-bold text-gray-400">
                          Nessun link
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleRemoveSponsor(sp.id)}
                    className="w-8 h-8 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white font-bold text-sm flex items-center justify-center transition-all cursor-pointer border-none shrink-0"
                    title="Elimina Sponsor"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              Nessuno sponsor inserito al momento
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
