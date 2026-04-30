"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StaffAtleti() {
  const router = useRouter();
  const [atleti, setAtleti] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const savedUsers = localStorage.getItem("bvi_users");
    if (savedUsers) {
      setAtleti(JSON.parse(savedUsers));
    } else {
        // Mock data se vuoto
        const mock = [
            { id: "1", nome: "Davide", cognome: "Pietrucci", email: "davide@example.com", dataRegistrazione: "01/01/2024" },
            { id: "2", nome: "Marco", cognome: "Rossi", email: "marco@example.com", dataRegistrazione: "15/02/2024" }
        ];
        setAtleti(mock);
        localStorage.setItem("bvi_users", JSON.stringify(mock));
    }
  }, []);

  const filteredAtleti = atleti.filter(a => 
    `${a.nome} ${a.cognome}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <main className="min-h-screen pb-20 bg-[#f8faff]">
      <header className="bg-white py-4 px-8 flex justify-between items-center shadow-md border-b-4 border-[#0a1628]">
        <div className="flex items-center gap-6">
          <Image src="/logo.png" alt="BVI" width={50} height={50} />
          <nav className="flex gap-2 bg-gray-50 p-1 rounded-xl border overflow-x-auto">
            <a href="/staff/dashboard" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Dashboard</a>
            <a href="/staff/iscrizioni" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Iscrizioni</a>
            <a href="/staff/atleti" className="px-4 py-2 rounded-lg text-sm font-bold bg-white text-[#0a1628] shadow-sm border border-gray-200 transition-all whitespace-nowrap">Anagrafica Atleti</a>
            <a href="/staff/tornei" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Tornei</a>
            <a href="/staff/gironi" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Gironi</a>
            <a href="/staff/classifica" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Classifica</a>
            <a href="/staff/tabellone" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Tabellone</a>
            <a href="/staff/pagamenti" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Pagamenti</a>
          </nav>
        </div>
        <a href="/" className="font-bold text-red-500 text-sm">Esci</a>
      </header>

      <div className="max-w-6xl mx-auto mt-10 px-4">
        <div className="flex justify-between items-center mb-8">
            <div>
                <h2 className="text-4xl font-black text-[#0a1628] uppercase tracking-tighter">Anagrafica Atleti 👤</h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Gestione Utenti Registrati</p>
            </div>
            <div className="relative">
                <input 
                    type="text" 
                    placeholder="Cerca per nome o email..." 
                    className="pl-10 pr-4 py-3 bg-white border-2 border-gray-100 rounded-2xl w-80 focus:border-[#0a1628] outline-none transition-all shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <span className="absolute left-4 top-1/2 -translate-y-1/2">🔍</span>
            </div>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-gray-100">
            <table className="w-full text-left">
                <thead className="bg-gray-50/50 border-b">
                    <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <th className="px-8 py-5">Atleta</th>
                        <th className="px-8 py-5">Email</th>
                        <th className="px-8 py-5 text-center">Data Reg.</th>
                        <th className="px-8 py-5 text-right">Azioni</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                    {filteredAtleti.map((atleta) => (
                        <tr key={atleta.id} className="hover:bg-blue-50/20 transition-all group">
                            <td className="px-8 py-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-[#0a1628] text-white flex items-center justify-center font-black text-sm">
                                        {atleta.nome.charAt(0)}{atleta.cognome.charAt(0)}
                                    </div>
                                    <span className="font-bold text-lg text-[#0a1628]">{atleta.nome} {atleta.cognome}</span>
                                </div>
                            </td>
                            <td className="px-8 py-6 text-gray-500 font-medium">{atleta.email}</td>
                            <td className="px-8 py-6 text-center font-bold text-gray-400">{atleta.dataRegistrazione}</td>
                            <td className="px-8 py-6 text-right">
                                <button className="text-xs font-black text-blue-600 uppercase tracking-widest hover:underline">Vedi Profilo</button>
                            </td>
                        </tr>
                    ))}
                    {filteredAtleti.length === 0 && (
                        <tr>
                            <td colSpan="4" className="py-20 text-center text-gray-400 font-bold italic">Nessun atleta trovato.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
      </div>
    </main>
  );
}
