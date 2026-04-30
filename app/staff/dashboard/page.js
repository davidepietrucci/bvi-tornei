"use client";

import StaffHeader from "@/app/components/StaffHeader";

export default function StaffDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({
    torneiAttivi: 0,
    iscrizioniInAttesa: 0,
    squadreConfermate: 0
  });

  useEffect(() => {
    const savedTornei = localStorage.getItem("bvi_tornei");
    let countTorneiAttivi = 0;
    if (savedTornei) {
      const tornei = JSON.parse(savedTornei);
      countTorneiAttivi = tornei.filter(t => t.stato === "Iscrizioni Aperte" || t.stato === "In Programmazione").length;
    }

    const savedIscrizioni = localStorage.getItem("bvi_iscrizioni");
    let countInAttesa = 0;
    let countConfermate = 0;
    if (savedIscrizioni) {
      const iscrizioni = JSON.parse(savedIscrizioni);
      countInAttesa = iscrizioni.filter(i => i.stato === "In Attesa").length;
      countConfermate = iscrizioni.filter(i => i.stato === "Approvata").length;
    }

    setStats({
      torneiAttivi: countTorneiAttivi,
      iscrizioniInAttesa: countInAttesa,
      squadreConfermate: countConfermate
    });
  }, []);

  return (
    <main className="min-h-screen pb-12 bg-[#f8faff]">
      <StaffHeader />

      <div className="max-w-6xl mx-auto mt-6 md:mt-10 px-4">
        <div className="mb-8">
            <h2 className="text-3xl md:text-5xl font-black text-[#0a1628] uppercase tracking-tighter leading-none">Dashboard 🏢</h2>
            <p className="text-[10px] md:text-xs text-gray-400 font-bold uppercase tracking-widest mt-2">Controllo Centrale Torneo</p>
        </div>
        
        {/* Widget Statistici - Mobile Optimized */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          <div className="bg-white rounded-[2rem] shadow-xl p-6 md:p-8 border-b-8 transition-transform active:scale-95" style={{borderColor: "#FFD700"}}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-black text-gray-400 uppercase tracking-widest">Tornei Attivi</span>
              <span className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center text-xl">🏆</span>
            </div>
            <p className="text-5xl md:text-6xl font-black text-[#0a1628]">{stats.torneiAttivi}</p>
          </div>

          <div className="bg-white rounded-[2rem] shadow-xl p-6 md:p-8 border-b-8 transition-transform active:scale-95" style={{borderColor: "#0a1628"}}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-black text-gray-400 uppercase tracking-widest">In Attesa</span>
              <span className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-xl">⏳</span>
            </div>
            <p className="text-5xl md:text-6xl font-black text-yellow-600">{stats.iscrizioniInAttesa}</p>
          </div>

          <div className="bg-white rounded-[2rem] shadow-xl p-6 md:p-8 border-b-8 border-green-500 transition-transform active:scale-95 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-black text-gray-400 uppercase tracking-widest">Confermate</span>
              <span className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-xl">✅</span>
            </div>
            <p className="text-5xl md:text-6xl font-black text-green-600">{stats.squadreConfermate}</p>
          </div>
        </div>

        {/* Quick Actions - Full width buttons on mobile */}
        <div className="mt-10 bg-white p-6 md:p-10 rounded-[2.5rem] shadow-2xl border border-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full -mr-16 -mt-16"></div>
          <h3 className="text-xl md:text-2xl font-black mb-6 uppercase tracking-tight text-[#0a1628] relative z-10">Azioni Rapide ⚡</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 relative z-10">
            <button onClick={() => router.push('/staff/tornei/nuovo')} className="flex items-center justify-between p-5 bg-gray-50 hover:bg-[#0a1628] hover:text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all group shadow-sm">
              Crea Torneo <span className="text-xl group-hover:translate-x-2 transition-transform">➕</span>
            </button>
            <button onClick={() => router.push('/staff/iscrizioni')} className="flex items-center justify-between p-5 bg-gray-50 hover:bg-[#0a1628] hover:text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all group shadow-sm">
              Valuta Iscrizioni <span className="text-xl group-hover:translate-x-2 transition-transform">📝</span>
            </button>
            <button onClick={() => router.push('/staff/pagamenti')} className="flex items-center justify-between p-5 bg-gray-50 hover:bg-[#0a1628] hover:text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all group shadow-sm">
              Pagamenti <span className="text-xl group-hover:translate-x-2 transition-transform">💰</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
