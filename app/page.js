import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen" style={{backgroundColor: "#f0f4ff"}}>
      
      {/* Header */}
      <header style={{backgroundColor: "#0a1628"}} className="text-white py-4 px-8 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <Image src="/logo.png" alt="BVI Logo" width={50} height={50} className="rounded-full" />
          <h1 className="text-2xl font-bold" style={{color: "#FFD700"}}>BVI Tornei</h1>
        </div>
        <nav className="flex gap-4 items-center">
          <a href="/tornei" className="hover:underline font-medium text-white">Tornei</a>
          <a href="/classifica" className="hover:underline font-medium text-white">Classifica</a>
          <a href="/login" className="px-4 py-1 rounded-full font-semibold" style={{backgroundColor: "#FFD700", color: "#0a1628"}}>Login</a>
        </nav>
      </header>

      {/* Hero / Login Section */}
      <section className="py-24 px-8 flex justify-center">
        <div className="bg-white border-t-4 rounded-2xl p-10 max-w-md w-full flex flex-col items-center shadow-lg" style={{borderColor: "#FFD700"}}>
          
          {/* Logo Section */}
          <div className="mb-6 flex justify-center">
            <Image 
              src="/logo.png" 
              alt="BVI Logo" 
              width={180} 
              height={100} 
              className="object-contain"
              priority
            />
          </div>

          {/* Welcome Text */}
          <h2 className="text-3xl font-extrabold mb-2" style={{color: "#0a1628"}}>Benvenuto</h2>
          <p className="text-gray-500 mb-8 font-medium">Scegli il tuo accesso:</p>

          {/* Action Buttons */}
          <div className="flex gap-4 w-full">
            <a 
              href="/atleta" 
              className="flex-1 py-3 px-4 rounded-full text-center text-lg font-semibold text-white hover:opacity-90 shadow-md transition-all"
              style={{backgroundColor: "#0a1628"}}
            >
              Atleta
            </a>
            <a 
              href="/staff" 
              className="flex-1 py-3 px-4 rounded-full text-center text-lg font-semibold hover:opacity-90 shadow-sm transition-all"
              style={{border: "2px solid #0a1628", color: "#0a1628"}}
            >
              Staff
            </a>
          </div>

        </div>
      </section>

      {/* Cards funzionalità */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 px-16 pb-24">
        <a href="/atleta/iscriviti" className="bg-white rounded-2xl shadow p-8 text-center border-t-4 block transition-transform hover:-translate-y-2 hover:shadow-2xl cursor-pointer" style={{borderColor: "#FFD700"}}>
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-xl font-bold mb-2" style={{color: "#0a1628"}}>Iscrizioni</h3>
          <p className="text-gray-500">Invia la tua richiesta di iscrizione e partecipa ai prossimi tornei BVI.</p>
        </a>
        <a href="/gironi" className="bg-white rounded-2xl shadow p-8 text-center border-t-4 block transition-transform hover:-translate-y-2 hover:shadow-2xl cursor-pointer" style={{borderColor: "#FFD700"}}>
          <div className="text-5xl mb-4">🏆</div>
          <h3 className="text-xl font-bold mb-2" style={{color: "#0a1628"}}>Gironi & Bracket</h3>
          <p className="text-gray-500">Visualizza i gironi e il calendario delle partite in tempo reale.</p>
        </a>
        <a href="/classifica" className="bg-white rounded-2xl shadow p-8 text-center border-t-4 block transition-transform hover:-translate-y-2 hover:shadow-2xl cursor-pointer" style={{borderColor: "#FFD700"}}>
          <div className="text-5xl mb-4">📊</div>
          <h3 className="text-xl font-bold mb-2" style={{color: "#0a1628"}}>Classifica Live</h3>
          <p className="text-gray-500">Segui la classifica aggiornata in tempo reale durante il torneo.</p>
        </a>
      </section>

    </main>
  );
}
