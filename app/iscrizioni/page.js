import Image from "next/image";

export default function Iscrizioni() {
  return (
    <main className="min-h-screen pb-12" style={{ backgroundColor: "#f0f4ff" }}>
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
            <p className="text-gray-500 mb-8 font-medium">Compila i dati della tua squadra per richiedere la partecipazione. Lo staff valuterà la richiesta e ti invierà la conferma via email.</p>

            <form className="space-y-6">
              {/* Selezione Torneo */}
              <div>
                <h3 className="text-xl font-bold border-b pb-2 mb-4" style={{ color: "#0a1628" }}>Selezione Torneo</h3>
                <div className="grid grid-cols-1 gap-5">
                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                    <label className="block text-sm font-bold text-[#0a1628] mb-2">Tornei Attivi </label>
                    <select className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-400 bg-white font-semibold text-gray-800 shadow-sm cursor-pointer">
                      <option>🏆 Torneo di Ferragosto - Misto 2x2 (15/08/2026)</option>
                      <option>🏆 BVI Summer Cup - Maschile 2x2 (22/08/2026)</option>
                      <option>🏆 BVI Summer Cup - Femminile 2x2 (23/08/2026)</option>
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
                    <h4 className="font-semibold text-gray-800">Giocatore 1</h4>
                    <input type="text" className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" placeholder="Nome e Cognome" />
                    <input type="email" className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" placeholder="Email" />
                    <input type="tel" className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" placeholder="Telefono (WhatsApp)" />
                  </div>
                  {/* Giocatore 2 */}
                  <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <h4 className="font-semibold text-gray-800">Giocatore 2</h4>
                    <input type="text" className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" placeholder="Nome e Cognome" />
                    <input type="email" className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" placeholder="Email (Opzionale)" />
                    <input type="tel" className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400" placeholder="Telefono (Opzionale)" />
                  </div>
                </div>
              </div>

              {/* Note */}
              <div className="pt-4">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Note / Richieste per lo Staff</label>
                <textarea rows="3" className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-yellow-400" placeholder="Es. Arriveremo con 30 minuti di ritardo..."></textarea>
              </div>

              {/* Submit */}
              <div className="pt-6">
                <button type="button" className="w-full py-4 rounded-full font-bold text-white text-lg transition-all shadow-md hover:opacity-90 hover:shadow-lg" style={{ backgroundColor: "#0a1628" }}>
                  Invia Richiesta di Iscrizione
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
