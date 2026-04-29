import Image from "next/image";

export default function AtletaDashboard() {
  return (
    <main className="min-h-screen pb-12" style={{backgroundColor: "#f0f4ff"}}>
      {/* Header Atleta */}
      <header className="bg-white py-4 px-8 flex flex-col md:flex-row justify-between items-center shadow-md border-b-4 gap-4" style={{borderColor: "#FFD700"}}>
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="BVI Logo" width={50} height={50} className="object-contain" />
            <h1 className="text-2xl font-bold" style={{color: "#0a1628"}}>Area Atleta</h1>
          </div>
          
          {/* Menu Navigazione Atleta */}
          <nav className="flex gap-2 bg-gray-50 p-1 rounded-xl border border-gray-200 overflow-x-auto">
            <a href="/atleta/dashboard" className="px-4 py-2 rounded-lg text-sm font-bold bg-white text-[#0a1628] shadow-sm border border-gray-200 transition-all whitespace-nowrap">Dashboard</a>
            <a href="/atleta/iscrizioni" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Le Mie Iscrizioni</a>
            <a href="/tornei" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Trova Tornei</a>
            <a href="/atleta/profilo" className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-500 hover:text-gray-800 transition-all whitespace-nowrap">Profilo & Documenti</a>
          </nav>
        </div>

        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-800 font-bold border-2" style={{borderColor: "#0a1628"}}>
              D
            </div>
            <span className="font-medium text-gray-700 hidden sm:inline">Davide</span>
          </div>
          <a href="/atleta" className="hover:underline font-bold text-red-500 text-sm ml-4">Esci</a>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto mt-10 px-4">
        
        {/* Banner Alert (es: Certificato Medico) */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8 rounded-r-lg flex items-start justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-yellow-600 text-xl">⚠️</span>
            <div>
              <p className="font-bold text-yellow-800">Certificato Medico in Scadenza</p>
              <p className="text-yellow-700 text-sm mt-1">Il tuo certificato medico agonistico scadrà tra 15 giorni. Aggiornalo per poter partecipare ai prossimi tornei.</p>
            </div>
          </div>
          <button className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg text-sm font-bold hover:bg-yellow-200 transition-colors">
            Carica Ora
          </button>
        </div>

        <h2 className="text-3xl font-extrabold mb-6" style={{color: "#0a1628"}}>La Tua Panoramica</h2>
        
        {/* Widget Statistici */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4" style={{borderColor: "#FFD700"}}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-500 font-semibold">Tornei Giocati</h3>
              <span className="text-2xl">🏅</span>
            </div>
            <div className="flex items-end gap-2">
              <p className="text-4xl font-bold" style={{color: "#0a1628"}}>12</p>
              <span className="text-sm text-gray-400 mb-1">questa stagione</span>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4" style={{borderColor: "#0a1628"}}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-500 font-semibold">Punti Ranking</h3>
              <span className="text-2xl">⭐</span>
            </div>
            <div className="flex items-end gap-2">
              <p className="text-4xl font-bold" style={{color: "#0a1628"}}>850</p>
              <span className="text-sm text-green-500 font-bold mb-1">↑ +45</span>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-lg p-6 border-t-4 border-green-500">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-500 font-semibold">Stato Iscrizioni</h3>
              <span className="text-2xl">📝</span>
            </div>
            <p className="text-xl font-bold text-green-600 mt-2">1 Torneo Confermato</p>
            <p className="text-sm text-gray-500">Torneo Estivo Beach Volley</p>
          </div>
        </div>

        {/* Sezioni Inferiori */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-10">
          
          {/* Prossimi Impegni */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 p-4 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-xl font-bold" style={{color: "#0a1628"}}>I Tuoi Prossimi Tornei</h3>
              <a href="/atleta/iscrizioni" className="text-sm font-semibold text-blue-600 hover:underline">Vedi tutti</a>
            </div>
            <div className="p-0">
              {/* Item Torneo */}
              <div className="p-5 border-b border-gray-50 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="flex gap-4 items-center">
                  <div className="w-14 h-14 rounded-xl bg-blue-50 flex flex-col items-center justify-center flex-shrink-0 border" style={{borderColor: "#e0e7ff"}}>
                    <span className="text-xs font-bold text-blue-500 uppercase">Lug</span>
                    <span className="text-xl font-extrabold" style={{color: "#0a1628"}}>15</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg" style={{color: "#0a1628"}}>Torneo BVI Summer Cup</h4>
                    <p className="text-sm text-gray-500 flex items-center gap-1">📍 Ostia Lido (RM) • 👨‍👦 2x2 Maschile</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 whitespace-nowrap">
                  Iscrizione Confermata
                </span>
              </div>
              
              {/* Item Torneo 2 */}
              <div className="p-5 hover:bg-gray-50 transition-colors flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="flex gap-4 items-center">
                  <div className="w-14 h-14 rounded-xl bg-gray-50 flex flex-col items-center justify-center flex-shrink-0 border border-gray-200">
                    <span className="text-xs font-bold text-gray-500 uppercase">Ago</span>
                    <span className="text-xl font-extrabold text-gray-700">02</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-lg" style={{color: "#0a1628"}}>Coppa di Fine Estate</h4>
                    <p className="text-sm text-gray-500 flex items-center gap-1">📍 Fregene • 👫 2x2 Misto</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 whitespace-nowrap">
                  In Attesa di Pagamento
                </span>
              </div>
            </div>
          </div>

          {/* Azioni Rapide e Compagno */}
          <div className="flex flex-col gap-6">
            
            {/* Azioni Rapide */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-xl font-bold mb-4" style={{color: "#0a1628"}}>Azioni Rapide</h3>
              <div className="grid grid-cols-2 gap-4">
                <a href="/tornei" className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-[#0a1628] hover:bg-gray-50 transition-all group">
                  <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">🔍</span>
                  <span className="font-semibold text-gray-700 text-center text-sm">Trova Torneo</span>
                </a>
                <a href="/atleta/profilo" className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-[#0a1628] hover:bg-gray-50 transition-all group">
                  <span className="text-3xl mb-2 group-hover:scale-110 transition-transform">📄</span>
                  <span className="font-semibold text-gray-700 text-center text-sm">Carica Documenti</span>
                </a>
              </div>
            </div>

            {/* Il mio compagno preferito */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-xl font-bold mb-4" style={{color: "#0a1628"}}>Squadra Principale</h3>
              <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div className="flex -space-x-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-800 font-bold border-2 border-white z-10">MR</div>
                  <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center text-orange-800 font-bold border-2 border-white z-0">LB</div>
                </div>
                <div>
                  <h4 className="font-bold text-gray-800">I Beach Boys</h4>
                  <p className="text-sm text-gray-500">con <span className="font-semibold">Luca Bianchi</span></p>
                </div>
                <button className="ml-auto text-gray-400 hover:text-[#0a1628]">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
                  </svg>
                </button>
              </div>
            </div>

          </div>

        </div>
      </div>
    </main>
  );
}
