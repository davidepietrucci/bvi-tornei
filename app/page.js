"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { getTornei, getPublicIscrizioni } from "@/app/utils/db";
import SponsorBanner from "@/app/components/SponsorBanner";


export default function Home() {
  const [torneiLive, setTorneiLive] = useState([]);
  const [torneiAperti, setTorneiAperti] = useState([]);
  const [torneiConclusi, setTorneiConclusi] = useState([]);
  const [allIscrizioni, setAllIscrizioni] = useState([]);

  // State for Coppie Iscritte modal
  const [selectedTorneoModal, setSelectedTorneoModal] = useState(null);
  const [searchCoppia, setSearchCoppia] = useState("");

  useEffect(() => {
    // Leggi i tornei dal database per mostrarli in home
    getTornei().then(allTornei => {
      // Filtriamo i tornei in programmazione per la sezione live
      const live = allTornei.filter(t => t.stato === "In Programmazione");
      setTorneiLive(live);

      // Mostriamo i tornei che sono "Iscrizioni Aperte" (o non hanno stato impostato, escludendo conclusi/in programmazione)
      const aperti = allTornei.filter(t => t.stato === "Iscrizioni Aperte" || (!t.stato && t.stato !== "Concluso" && t.stato !== "In Programmazione"));
      setTorneiAperti(aperti.slice(0, 6)); // Mostriamo un massimo di 6 tornei in home

      // Mostriamo i tornei conclusi
      const conclusi = allTornei.filter(t => t.stato === "Concluso");
      setTorneiConclusi(conclusi);
    });

    getPublicIscrizioni().then(isc => {
      setAllIscrizioni(isc || []);
    });
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f6f1] text-[#101d2c]">
      <header className="relative z-10 bg-[#101d2c] text-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-4 sm:flex-row sm:px-8">
          <a href="/" className="flex items-center gap-3" aria-label="BVI Tornei, home">
            <Image src="/logo.png" alt="BVI" width={46} height={46} className="rounded-full bg-white" />
            <span className="text-xl font-black tracking-tight">BVI <span className="text-[#f5ca3e]">TORNEI</span></span>
          </a>
          <nav className="flex flex-wrap items-center justify-center gap-2 sm:gap-5" aria-label="Navigazione principale">
            <a href="#tornei" className="px-3 py-2 text-sm font-semibold text-white/80 transition hover:text-[#f5ca3e]">Tornei</a>
            <a href="/gironi" className="px-3 py-2 text-sm font-semibold text-white/80 transition hover:text-[#f5ca3e]">Live</a>
            <a href="/classifica" className="px-3 py-2 text-sm font-semibold text-white/80 transition hover:text-[#f5ca3e]">Classifiche</a>
            <a href="/atleta" className="rounded-full bg-[#f5ca3e] px-5 py-2.5 text-sm font-black text-[#101d2c] shadow-lg transition hover:bg-yellow-300">Area atleta <span aria-hidden="true">↗</span></a>
            <a href="/staff" className="px-3 py-2 text-sm font-semibold text-white/60 transition hover:text-white">Staff</a>
          </nav>
        </div>
      </header>

      <section className="relative isolate flex min-h-[620px] items-center overflow-hidden bg-[#101d2c] px-5 py-20 text-white sm:min-h-[680px] sm:px-10">
        <div className="absolute inset-0 -z-20 bg-cover bg-[center_38%]" style={{ backgroundImage: "url('/images/maschile-bg.jpg')" }} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#071321]/95 via-[#071321]/70 to-[#071321]/15" />
        <div className="mx-auto w-full max-w-7xl">
          <div className="max-w-3xl">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#f5ca3e] backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-[#f5ca3e]" /> Beach volley · BVI
            </p>
            <h1 className="max-w-3xl text-5xl font-black leading-[0.98] tracking-tight sm:text-7xl">La tua prossima partita <span className="text-[#f5ca3e]">inizia qui.</span></h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-white/80 sm:text-xl">Tornei, risultati e giornate in spiaggia. Entra nella community BVI e vivi il beach volley, punto dopo punto.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a href="/atleta" className="inline-flex items-center justify-center gap-3 rounded-full bg-[#f5ca3e] px-7 py-4 text-sm font-black uppercase tracking-wider text-[#101d2c] shadow-xl transition hover:-translate-y-0.5 hover:bg-yellow-300">Entra nell’Area Atleta <span aria-hidden="true">→</span></a>
              <a href="#tornei" className="inline-flex items-center justify-center rounded-full border border-white/50 bg-white/10 px-7 py-4 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/20">Prossimi tornei</a>
            </div>
          </div>
          <div className="mt-14 flex flex-wrap gap-x-8 gap-y-3 text-xs font-bold uppercase tracking-[0.18em] text-white/70">
            <span>🏐 Tornei per tutti i livelli</span><span>📍 Spiaggia e community</span><span>🏆 Risultati in diretta</span>
          </div>
        </div>
        <div className="absolute bottom-7 right-8 hidden text-right text-[10px] font-bold uppercase tracking-[0.25em] text-white/60 md:block">#Live your passion</div>
      </section>

      {torneiLive.length > 0 && <section className="mx-auto -mt-8 max-w-7xl px-5 sm:px-8">
        <div className="rounded-2xl border border-red-100 bg-white p-5 shadow-xl sm:p-7">
          <div className="mb-5 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-red-600"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" /> In campo adesso</div>
          <div className="grid gap-5 md:grid-cols-2">
            {torneiLive.map((t, idx) => <article key={t.id || idx} className="flex flex-col justify-between gap-4 border-t border-gray-100 pt-4 sm:flex-row sm:items-center">
              <div><h2 className="text-xl font-black">{t.nome}</h2><p className="mt-1 text-sm text-gray-500">{t.categoria || "Categoria libera"} · {t.data}{t.location ? ` · ${t.location}` : ""}</p></div>
              <a href={`/gironi?tour=${encodeURIComponent(t.nome)}`} className="shrink-0 rounded-full bg-red-600 px-5 py-3 text-center text-xs font-black uppercase tracking-wider text-white transition hover:bg-red-700">Segui il live →</a>
            </article>)}
          </div>
        </div>
      </section>}

      <section id="tornei" className="mx-auto max-w-7xl scroll-mt-8 px-5 py-20 sm:px-8 sm:py-24">
        <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-[#b18a0d]">Prossimi appuntamenti</p><h2 className="text-4xl font-black tracking-tight sm:text-5xl">Scendi in campo.</h2></div>
          <p className="max-w-md text-base leading-7 text-gray-600">Trova il torneo che fa per te. L’iscrizione si completa in modo semplice e sicuro dalla tua Area Atleta.</p>
        </div>

        {torneiAperti.length === 0 ? <div className="rounded-3xl border border-[#e8e4d8] bg-white px-6 py-16 text-center shadow-sm"><span className="text-5xl">🏖️</span><h3 className="mt-5 text-2xl font-black">I prossimi tornei stanno arrivando</h3><p className="mx-auto mt-2 max-w-lg text-gray-600">Al momento non ci sono iscrizioni aperte. Torna presto a trovarci e preparati a scendere in campo.</p><a href="/atleta" className="mt-6 inline-flex rounded-full bg-[#101d2c] px-6 py-3 text-sm font-bold text-white hover:bg-[#223750]">Vai all’Area Atleta →</a></div> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {torneiAperti.map((t, i) => <article key={t.id || i} className="group overflow-hidden rounded-3xl border border-[#e8e4d8] bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
            <div className="relative h-44 overflow-hidden bg-[#101d2c]">
              <div className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105" style={{ backgroundImage: `linear-gradient(90deg, rgba(7,19,33,.76), rgba(7,19,33,.12)), url('/images/${i % 2 ? "femminile-bg.jpg" : "maschile-bg.jpg"}')` }} />
              <span className="absolute left-5 top-5 rounded-full bg-[#dff4e7] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#166534]">Iscrizioni aperte</span>
              <span className="absolute bottom-5 left-5 text-sm font-bold text-white">{t.data}</span>
            </div>
            <div className="p-6">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#b18a0d]">{t.categoria || "Categoria libera"}</p>
              <h3 className="mt-2 text-2xl font-black leading-tight">{t.nome}</h3>
              {t.location && <p className="mt-3 text-sm text-gray-500">⌖ {t.location}</p>}
              <div className="mt-6 grid grid-cols-2 gap-2 border-t border-gray-100 pt-5">
                <a href={`/atleta/iscriviti?tour=${encodeURIComponent(t.nome)}`} className="rounded-xl bg-[#f5ca3e] px-3 py-3 text-center text-xs font-black text-[#101d2c] transition hover:bg-yellow-300">Iscriviti →</a>
                <button onClick={() => { setSelectedTorneoModal(t); setSearchCoppia(""); }} className="cursor-pointer rounded-xl border border-[#101d2c]/15 px-3 py-3 text-xs font-bold text-[#101d2c] transition hover:border-[#101d2c] hover:bg-gray-50">Atleti iscritti</button>
              </div>
            </div>
          </article>)}
        </div>}
      </section>

      <section className="bg-[#101d2c] px-5 py-12 text-white sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div><p className="text-xs font-black uppercase tracking-[0.2em] text-[#f5ca3e]">Dentro e fuori dal campo</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">Segui il tuo percorso BVI.</h2></div>
          <div className="flex flex-wrap gap-3"><a href="/gironi" className="rounded-full border border-white/30 px-5 py-3 text-sm font-bold transition hover:bg-white/10">Gironi e live</a><a href="/classifica" className="rounded-full border border-white/30 px-5 py-3 text-sm font-bold transition hover:bg-white/10">Classifiche</a><a href="/iscritti" className="rounded-full border border-white/30 px-5 py-3 text-sm font-bold transition hover:bg-white/10">Iscritti</a></div>
        </div>
      </section>

      {torneiConclusi.length > 0 && <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="mb-8 flex items-end justify-between"><div><p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-[#b18a0d]">Archivio</p><h2 className="text-3xl font-black">I tornei passati</h2></div><a href="/classifica" className="text-sm font-bold text-[#101d2c] underline decoration-[#f5ca3e] decoration-2 underline-offset-4">Tutte le classifiche →</a></div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{torneiConclusi.slice(0, 3).map((t, i) => <article key={t.id || i} className="flex items-center justify-between gap-4 rounded-2xl border border-[#e8e4d8] bg-white p-5"><div><p className="text-xs font-bold text-gray-500">{t.data} · {t.categoria || "Categoria libera"}</p><h3 className="mt-1 font-black">{t.nome}</h3></div><a href={`/classifica?tour=${encodeURIComponent(t.nome)}`} className="shrink-0 rounded-full bg-[#f5ca3e] px-4 py-2 text-xs font-black">Classifica</a></article>)}</div>
      </section>}

      {/* Modal Coppie Iscritte */}
      {selectedTorneoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 text-white flex justify-between items-center" style={{ backgroundColor: "#0a1628" }}>
              <div>
                <span className="text-xs font-bold text-yellow-400 uppercase tracking-widest block mb-1">
                  {selectedTorneoModal.categoria || "Coppie Iscritte"}
                </span>
                <h3 className="text-2xl font-black">{selectedTorneoModal.nome}</h3>
              </div>
              <button
                onClick={() => setSelectedTorneoModal(null)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center font-bold text-lg transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4">
              {/* Search & Info bar */}
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                  <input
                    type="text"
                    placeholder="Cerca coppia o giocatore..."
                    value={searchCoppia}
                    onChange={(e) => setSearchCoppia(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0a1628] focus:bg-white transition-all text-gray-800"
                  />
                </div>
              </div>

              {(() => {
                const modalTorneoName = (selectedTorneoModal.nome || "").toLowerCase().trim();
                const listTorneo = allIscrizioni.filter((isc) => {
                  const iscTorneoLower = (isc.torneo || "").toLowerCase().trim();
                  if (!iscTorneoLower || !modalTorneoName) return false;
                  return (
                    iscTorneoLower === modalTorneoName ||
                    iscTorneoLower.includes(modalTorneoName) ||
                    modalTorneoName.includes(iscTorneoLower)
                  );
                });
                const filteredList = listTorneo.filter((isc) =>
                  (isc.giocatori || "").toLowerCase().includes(searchCoppia.toLowerCase())
                );

                if (listTorneo.length === 0) {
                  return (
                    <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-2xl border border-dashed border-gray-200 my-2">
                      <span className="text-4xl block mb-2">🏐</span>
                      <p className="font-bold text-gray-700">Ancora nessuna coppia iscritta</p>
                      <p className="text-xs text-gray-400 mt-1">Sii il primo ad iscriverti a questo torneo!</p>
                    </div>
                  );
                }

                if (filteredList.length === 0) {
                  return (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-2xl my-2">
                      <p className="font-semibold text-sm">Nessuna coppia trovata per "{searchCoppia}"</p>
                    </div>
                  );
                }

                return (
                  <div className="flex flex-col gap-3 mt-1">
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">
                      Coppia / Giocatori ({filteredList.length})
                    </div>
                    <div className="divide-y divide-gray-100 bg-gray-50/50 rounded-2xl border border-gray-100 overflow-hidden">
                      {filteredList.map((isc, index) => (
                        <div key={isc.id || index} className="p-4 flex items-center justify-between gap-4 bg-white hover:bg-gray-50/80 transition-colors">
                          <div className="flex items-center gap-3.5 min-w-0">
                            <span className="w-8 h-8 rounded-full bg-blue-50 text-[#0a1628] font-black text-xs flex items-center justify-center shrink-0">
                              #{index + 1}
                            </span>
                            <h4 className="font-bold text-gray-900 text-sm sm:text-base leading-snug truncate">
                              {isc.giocatori || "Coppia non specificata"}
                            </h4>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
              <span className="text-xs text-gray-400 font-medium">
                Privacy protetta • Nessun dato sensibile visibile
              </span>
              <button
                onClick={() => setSelectedTorneoModal(null)}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sponsor Banner */}
      <SponsorBanner />

      {/* Footer */}
      <footer className="text-white py-12 px-8 mt-auto border-t-4" style={{ borderColor: "#FFD700", backgroundColor: "#0a1628" }}>

        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="BVI Logo" width={50} height={50} className="rounded-full bg-white p-0.5" />
            <div className="flex flex-col text-left">
              <h4 className="text-lg font-bold" style={{ color: "#FFD700" }}>Beach Volley Institute</h4>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">#Live your passion 🏐</p>
            </div>
          </div>

          <div className="flex gap-6 items-center">
            <a
              href="https://www.beachvolleyinstitute.it"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3.5 bg-white/10 hover:bg-white/20 rounded-2xl text-xs font-black uppercase tracking-widest transition-all text-white border border-white/10 hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer"
            >
              🌐 Sito BVI
            </a>
            <a
              href="https://www.instagram.com/beachvolleyinstitutebvi/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:scale-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center bg-gradient-to-tr from-[#f9ce3f] via-[#e1306c] to-[#833ab4] p-3 rounded-2xl shadow-lg border border-white/10"
              aria-label="Seguici su Instagram"
            >
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
              </svg>
            </a>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-8 border-t border-white/10 text-center text-xs text-gray-500 font-medium">
          &copy; {new Date().getFullYear()} Beach Volley Institute. Tutti i diritti riservati.
        </div>
      </footer>
    </main>
  );
}
