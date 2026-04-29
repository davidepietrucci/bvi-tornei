"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NuovoTorneo() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    nome: "",
    data: "",
    location: "",
    categoria: "Misto 2x2",
    stato: "In Programmazione",
    maxSquadre: 16,
    quota: 40
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Recuperiamo i tornei esistenti
    const saved = localStorage.getItem("bvi_tornei");
    const tornei = saved ? JSON.parse(saved) : [];
    
    // Generiamo un nuovo ID
    const newId = tornei.length > 0 ? Math.max(...tornei.map(t => t.id)) + 1 : 1;
    
    const nuovoTorneo = {
      id: newId,
      ...formData,
      iscritti: 0 // Inizialmente ci sono 0 iscritti
    };
    
    // Salviamo in localStorage
    const updatedTornei = [...tornei, nuovoTorneo];
    localStorage.setItem("bvi_tornei", JSON.stringify(updatedTornei));
    
    // Torniamo alla lista
    router.push("/staff/tornei");
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: (name === "maxSquadre" || name === "quota") ? parseInt(value) || 0 : value 
    }));
  };

  return (
    <main className="min-h-screen pb-12" style={{backgroundColor: "#f0f4ff"}}>
      {/* Header Staff */}
      <header className="bg-white py-4 px-8 flex flex-col md:flex-row justify-between items-center shadow-md border-b-4 gap-4" style={{borderColor: "#0a1628"}}>
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="BVI Logo" width={50} height={50} className="object-contain" />
          <h1 className="text-2xl font-bold" style={{color: "#0a1628"}}>BVI Staff</h1>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto mt-10 px-4">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => router.push("/staff/tornei")}
            className="text-gray-500 hover:text-gray-800 transition-colors bg-white p-2 rounded-full shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <h2 className="text-3xl font-extrabold" style={{color: "#0a1628"}}>Crea Nuovo Torneo</h2>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="p-8 flex flex-col gap-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700">Nome Torneo</label>
                <input 
                  type="text" 
                  name="nome" 
                  required
                  value={formData.nome} 
                  onChange={handleChange}
                  placeholder="es. BVI Summer Cup" 
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0a1628]" 
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700">Data (o periodo)</label>
                <input 
                  type="text" 
                  name="data" 
                  required
                  value={formData.data} 
                  onChange={handleChange}
                  placeholder="es. 15 Agosto 2026" 
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0a1628]" 
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-700">Location</label>
              <input 
                type="text" 
                name="location" 
                required
                value={formData.location} 
                onChange={handleChange}
                placeholder="es. Ostia Lido (RM)" 
                className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0a1628]" 
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700">Categoria</label>
                <select 
                  name="categoria" 
                  value={formData.categoria} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0a1628]"
                >
                  <option>Misto 2x2</option>
                  <option>Maschile 2x2</option>
                  <option>Femminile 2x2</option>
                  <option>Misto 4x4</option>
                  <option>Maschile 2x2 / Femminile 2x2</option>
                </select>
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700">Stato</label>
                <select 
                  name="stato" 
                  value={formData.stato} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0a1628]"
                >
                  <option>In Programmazione</option>
                  <option>Iscrizioni Aperte</option>
                  <option>Concluso</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700">Max Squadre</label>
                <input 
                  type="number" 
                  name="maxSquadre" 
                  min="2"
                  value={formData.maxSquadre} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0a1628]" 
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-gray-700">Quota (€)</label>
                <input 
                  type="number" 
                  name="quota" 
                  min="0"
                  value={formData.quota} 
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0a1628]" 
                />
              </div>
            </div>

          </div>
          
          <div className="bg-gray-50 p-6 border-t border-gray-200 flex justify-end gap-4">
            <button 
              type="button" 
              onClick={() => router.push("/staff/tornei")}
              className="px-6 py-3 rounded-lg font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 transition-colors"
            >
              Annulla
            </button>
            <button 
              type="submit" 
              className="px-6 py-3 rounded-lg font-bold text-white shadow-md hover:opacity-90 transition-all"
              style={{backgroundColor: "#0a1628"}}
            >
              Crea Torneo
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
