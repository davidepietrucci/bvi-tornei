import Image from "next/image";

export default function ClassificaLive() {
  // Dati di esempio per la classifica
  const squadre = [
    { pos: 1, nome: "Beach Boys", punti: 15, giocate: 5, vinte: 5, perse: 0, setVinti: 10, setPersi: 1 },
    { pos: 2, nome: "Sabbia Mobile", punti: 12, giocate: 5, vinte: 4, perse: 1, setVinti: 8, setPersi: 3 },
    { pos: 3, nome: "Gli Schiacciatori", punti: 9, giocate: 5, vinte: 3, perse: 2, setVinti: 7, setPersi: 5 },
    { pos: 4, nome: "Muri a Secco", punti: 6, giocate: 5, vinte: 2, perse: 3, setVinti: 4, setPersi: 7 },
    { pos: 5, nome: "Bagheroni", punti: 3, giocate: 5, vinte: 1, perse: 4, setVinti: 3, setPersi: 8 },
    { pos: 6, nome: "Fuori Forma", punti: 0, giocate: 5, vinte: 0, perse: 5, setVinti: 0, setPersi: 10 },
  ];

  return (
    <main className="min-h-screen pb-12" style={{backgroundColor: "#f0f4ff"}}>
      {/* Header */}
      <header style={{backgroundColor: "#0a1628"}} className="text-white py-4 px-8 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="BVI Logo" width={50} height={50} className="object-contain" />
          <h1 className="text-2xl font-bold" style={{color: "#FFD700"}}>BVI Tornei</h1>
        </div>
        <nav className="flex gap-4 items-center">
          <a href="/" className="hover:underline font-medium text-white">Home</a>
          <a href="/tornei" className="hover:underline font-medium text-white">Tornei</a>
          <a href="/classifica" className="font-medium" style={{color: "#FFD700"}}>Classifica</a>
        </nav>
      </header>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto mt-12 px-4">
        {/* Intestazione Sezione */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-4xl font-extrabold" style={{color: "#0a1628"}}>Classifica Live 📊</h2>
            <p className="text-gray-600 mt-2">Torneo Estivo BVI - Girone Unico</p>
          </div>
          <div className="flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-semibold self-start md:self-auto shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
            Aggiornamento Live
          </div>
        </div>

        {/* Tabella Classifica */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border-t-4" style={{borderColor: "#FFD700"}}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr style={{backgroundColor: "#0a1628"}} className="text-white">
                  <th className="py-4 px-6 font-semibold">Pos</th>
                  <th className="py-4 px-6 font-semibold min-w-[150px]">Squadra</th>
                  <th className="py-4 px-6 font-semibold text-center">Punti</th>
                  <th className="py-4 px-6 font-semibold text-center hidden md:table-cell">G</th>
                  <th className="py-4 px-6 font-semibold text-center hidden sm:table-cell">V</th>
                  <th className="py-4 px-6 font-semibold text-center hidden sm:table-cell">P</th>
                  <th className="py-4 px-6 font-semibold text-center hidden lg:table-cell">SV</th>
                  <th className="py-4 px-6 font-semibold text-center hidden lg:table-cell">SP</th>
                </tr>
              </thead>
              <tbody>
                {squadre.map((squadra, index) => (
                  <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 font-bold text-gray-700 whitespace-nowrap">
                      {squadra.pos === 1 && "🥇 "}
                      {squadra.pos === 2 && "🥈 "}
                      {squadra.pos === 3 && "🥉 "}
                      {squadra.pos > 3 && `${squadra.pos}°`}
                    </td>
                    <td className="py-4 px-6 font-bold" style={{color: "#0a1628"}}>{squadra.nome}</td>
                    <td className="py-4 px-6 text-center font-extrabold text-2xl" style={{color: "#0a1628"}}>{squadra.punti}</td>
                    <td className="py-4 px-6 text-center text-gray-500 hidden md:table-cell">{squadra.giocate}</td>
                    <td className="py-4 px-6 text-center text-green-600 font-semibold hidden sm:table-cell">{squadra.vinte}</td>
                    <td className="py-4 px-6 text-center text-red-600 font-semibold hidden sm:table-cell">{squadra.perse}</td>
                    <td className="py-4 px-6 text-center text-gray-500 hidden lg:table-cell">{squadra.setVinti}</td>
                    <td className="py-4 px-6 text-center text-gray-500 hidden lg:table-cell">{squadra.setPersi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legenda */}
        <div className="mt-6 flex flex-wrap gap-4 text-xs text-gray-500 justify-center">
          <span className="flex items-center gap-1"><b className="text-gray-700">G:</b> Partite Giocate</span>
          <span className="flex items-center gap-1"><b className="text-gray-700">V:</b> Vinte</span>
          <span className="flex items-center gap-1"><b className="text-gray-700">P:</b> Perse</span>
          <span className="flex items-center gap-1"><b className="text-gray-700">SV:</b> Set Vinti</span>
          <span className="flex items-center gap-1"><b className="text-gray-700">SP:</b> Set Persi</span>
        </div>

      </div>
    </main>
  );
}
