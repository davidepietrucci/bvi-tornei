import StaffHeader from "@/app/components/StaffHeader";

export default function StaffIscrizioni() {
  const [iscrizioni, setIscrizioni] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem("bvi_iscrizioni");
    if (saved) {
      setIscrizioni(JSON.parse(saved));
    } else {
      const initialData = [
        { id: "101", data: "Oggi, 10:45", torneo: "Torneo di Ferragosto - Misto 2x2", giocatori: "Davide P. & Elena M.", tel: "333 1234567", stato: "In Attesa" },
        { id: "102", data: "Oggi, 09:12", torneo: "BVI Summer Cup - Maschile 2x2", giocatori: "Marco R. & Luca B.", tel: "333 7654321", stato: "Approvata" },
        { id: "103", data: "Ieri, 18:30", torneo: "BVI Summer Cup - Femminile 2x2", giocatori: "Giulia M. & Sara L.", tel: "328 1122334", stato: "In Attesa" },
      ];
      setIscrizioni(initialData);
      localStorage.setItem("bvi_iscrizioni", JSON.stringify(initialData));
    }
  }, []);

  const handleApprove = (id) => {
    const updated = iscrizioni.map((isc) => 
      isc.id === id ? { ...isc, stato: "Approvata" } : isc
    );
    setIscrizioni(updated);
    localStorage.setItem("bvi_iscrizioni", JSON.stringify(updated));
  };

  const handleDelete = (id) => {
    if (typeof window !== "undefined" && window.confirm("Sei sicuro di voler eliminare definitivamente questa iscrizione?")) {
      const updated = iscrizioni.filter((isc) => isc.id !== id);
      setIscrizioni(updated);
      localStorage.setItem("bvi_iscrizioni", JSON.stringify(updated));
    }
  };

  const exportToExcel = () => {
    const headers = ["ID", "Data", "Torneo", "Giocatori", "Contatto", "Stato"];
    const csvRows = [
      headers.join(","),
      ...iscrizioni.map(isc => [
        isc.id, 
        `"${isc.data}"`, 
        `"${isc.torneo}"`, 
        `"${isc.giocatori}"`, 
        `"${isc.tel}"`, 
        isc.stato
      ].join(","))
    ];
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "iscrizioni_bvi.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="min-h-screen pb-20 bg-[#f8faff]">
      <StaffHeader />

      <div className="max-w-6xl mx-auto mt-6 md:mt-10 px-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
                <h2 className="text-3xl md:text-5xl font-black text-[#0a1628] uppercase tracking-tighter">Iscrizioni 📝</h2>
                <p className="text-[10px] md:text-xs text-gray-400 font-bold uppercase tracking-widest mt-2">Approvazione e gestione richieste</p>
            </div>
            <button 
              onClick={exportToExcel}
              className="w-full md:w-auto text-xs bg-[#0a1628] text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-transform"
            >
              ⬇️ Scarica CSV
            </button>
        </div>

        {/* Mobile Cards / Desktop Table Wrapper */}
        <div className="space-y-4 md:space-y-0">
            {/* Desktop Table Header (Visible only on MD+) */}
            <div className="hidden md:grid grid-cols-6 bg-gray-50 p-4 rounded-t-[2rem] border-x border-t border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <div className="px-4">Ricevuta</div>
                <div className="px-4 col-span-2">Squadra / Torneo</div>
                <div className="px-4">Contatto</div>
                <div className="px-4">Stato</div>
                <div className="px-4 text-right">Azioni</div>
            </div>

            {/* Content rows/cards */}
            <div className="space-y-4 md:space-y-0 md:bg-white md:rounded-b-[2rem] md:shadow-xl md:border md:border-gray-100 md:divide-y">
                {iscrizioni.map((req) => (
                    <div key={req.id} className="bg-white p-6 rounded-[2rem] shadow-xl md:shadow-none md:rounded-none md:grid md:grid-cols-6 md:items-center hover:bg-blue-50/20 transition-all">
                        {/* Mobile Header: Badge ID e Data */}
                        <div className="flex justify-between items-center mb-4 md:mb-0 md:px-4">
                            <span className="text-[10px] font-black text-gray-300 md:hidden">#{req.id}</span>
                            <span className="text-sm font-bold text-gray-500">{req.data}</span>
                        </div>

                        {/* Squadra e Torneo */}
                        <div className="mb-4 md:mb-0 md:col-span-2 md:px-4">
                            <h4 className="text-lg font-black text-[#0a1628] leading-tight mb-1">{req.giocatori}</h4>
                            <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-black uppercase border border-blue-100">
                                {req.torneo}
                            </span>
                        </div>

                        {/* Contatto */}
                        <div className="mb-4 md:mb-0 md:px-4">
                            <p className="text-xs font-bold text-gray-400 flex items-center gap-1">
                                <span className="md:hidden">📞</span> {req.tel}
                            </p>
                        </div>

                        {/* Stato */}
                        <div className="mb-6 md:mb-0 md:px-4">
                            {req.stato === "In Attesa" ? (
                                <span className="inline-flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-[10px] font-black uppercase">
                                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span> In Attesa
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Approvata
                                </span>
                            )}
                        </div>

                        {/* Azioni */}
                        <div className="flex gap-2 md:justify-end md:px-4">
                            {req.stato === "In Attesa" && (
                                <button 
                                    onClick={() => handleApprove(req.id)}
                                    className="flex-1 md:flex-none h-12 md:w-10 md:h-10 bg-green-500 text-white rounded-xl font-black text-lg flex items-center justify-center shadow-lg shadow-green-200 hover:scale-110 active:scale-95 transition-all"
                                >
                                    ✓
                                </button>
                            )}
                            <button 
                                onClick={() => handleDelete(req.id)}
                                className="flex-1 md:flex-none h-12 md:w-10 md:h-10 bg-red-500 text-white rounded-xl font-black text-lg flex items-center justify-center shadow-lg shadow-red-200 hover:scale-110 active:scale-95 transition-all"
                            >
                                ✕
                            </button>
                        </div>
                    </div>
                ))}

                {iscrizioni.length === 0 && (
                    <div className="py-20 text-center text-gray-400 font-bold italic">
                        Nessuna iscrizione trovata.
                    </div>
                )}
            </div>
        </div>
      </div>
    </main>
  );
}
