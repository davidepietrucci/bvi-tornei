import Image from "next/image";

export default function AtletaLogin() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4" style={{backgroundColor: "#f0f4ff"}}>
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full border-t-4" style={{borderColor: "#FFD700"}}>
        
        {/* Intestazione */}
        <div className="flex justify-center mb-6">
          <Image src="/logo.png" alt="BVI Logo" width={80} height={80} className="object-contain" priority />
        </div>
        <h2 className="text-2xl font-bold text-center mb-2" style={{color: "#0a1628"}}>Portale Atleta</h2>
        <p className="text-center text-gray-500 mb-6 text-sm">Accedi per gestire le tue iscrizioni ai tornei</p>
        
        {/* Form di Login */}
        <form className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input 
              type="email" 
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2" 
              style={{focusRingColor: "#0a1628"}}
              placeholder="atleta@esempio.com" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input 
              type="password" 
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2" 
              style={{focusRingColor: "#0a1628"}}
              placeholder="••••••••" 
            />
          </div>
          
          <button 
            type="button" 
            className="w-full py-3 mt-4 rounded-lg font-semibold text-white transition-all shadow-md hover:opacity-90" 
            style={{backgroundColor: "#0a1628"}}
          >
            Accedi come Atleta
          </button>
        </form>

        {/* Link utili */}
        <div className="mt-6 text-center text-sm text-gray-500">
          Non hai un account? <a href="#" className="font-semibold hover:underline" style={{color: "#0a1628"}}>Registrati ora</a>
        </div>
        <div className="mt-4 text-center border-t border-gray-100 pt-4">
          <a href="/" className="text-sm font-medium hover:underline text-gray-400">← Torna alla selezione</a>
        </div>
      </div>
    </main>
  );
}
