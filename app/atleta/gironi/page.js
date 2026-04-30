import AthleteHeader from "@/app/components/AthleteHeader";

export default function AtletaGironi() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [torneiAttivi, setTorneiAttivi] = useState([]);
  const [selectedTorneo, setSelectedTorneo] = useState("");
  const [config, setConfig] = useState(null);
  const [bracketConfig, setBracketConfig] = useState(null);

  const nomeAtleta = session?.user?.name || "Davide P.";

  useEffect(() => {
    if (status === "unauthenticated" && localStorage.getItem("bvi_atleta_logged_in") !== "true") {
      router.push("/atleta"); return;
    }
    const savedTornei = localStorage.getItem("bvi_tornei");
    if (savedTornei) {
      const parsed = JSON.parse(savedTornei);
      const attivi = parsed.filter(t => t.stato === "Iscrizioni Aperte" || t.stato === "In Programmazione");
      setTorneiAttivi(attivi);
      if (attivi.length > 0) setSelectedTorneo(attivi[0].nome);
    }
  }, [router, status]);

  useEffect(() => {
    if (!selectedTorneo) return;
    const key = `bvi_gironi_v2_${selectedTorneo.toLowerCase().trim().replace(/\s+/g, '_')}`;
    const saved = localStorage.getItem(key);
    if (saved) setConfig(JSON.parse(saved)); else setConfig(null);

    const bKey = `bvi_bracket_v1_${selectedTorneo.toLowerCase().trim().replace(/\s+/g, '_')}`;
    const bSaved = localStorage.getItem(bKey);
    if (bSaved) setBracketConfig(JSON.parse(bSaved)); else setBracketConfig(null);
  }, [selectedTorneo]);

  const getWinner = (gid, mIdx) => {
    if (!config) return `Vincente G${mIdx+1}`;
    const assignments = config.gironeAssignments[gid];
    const metadata = config.matchMetadata || {};
    const meta = metadata[`${gid}-${mIdx}`];
    const getName = (idx) => assignments[idx] || `Slot ${idx + 1}`;
    
    if (!meta) return `Vincente G${mIdx+1}`;
    const s1L = parseInt(meta.s1L||0), s1R = parseInt(meta.s1R||0);
    if (s1L === 0 && s1R === 0) return `Vincente G${mIdx+1}`;
    if (mIdx === 0) return s1L > s1R ? getName(0) : getName(3);
    if (mIdx === 1) return s1L > s1R ? getName(1) : getName(2);
    return "TBD";
  };

  const getLoser = (gid, mIdx) => {
    if (!config) return `Perdente G${mIdx+1}`;
    const assignments = config.gironeAssignments[gid];
    const metadata = config.matchMetadata || {};
    const meta = metadata[`${gid}-${mIdx}`];
    const getName = (idx) => assignments[idx] || `Slot ${idx + 1}`;
    
    if (!meta) return `Perdente G${mIdx+1}`;
    const s1L = parseInt(meta.s1L||0), s1R = parseInt(meta.s1R||0);
    if (s1L === 0 && s1R === 0) return `Perdente G${mIdx+1}`;
    if (mIdx === 0) return s1L > s1R ? getName(3) : getName(0);
    if (mIdx === 1) return s1L > s1R ? getName(2) : getName(1);
    return "TBD";
  };

  const getGironeMatches = (gid) => {
    if (!config || !config.gironeAssignments[gid]) return [];
    const assignments = config.gironeAssignments[gid];
    const metadata = config.matchMetadata || {};
    const getName = (idx) => assignments[idx] || `Slot ${idx + 1}`;

    return [
        { left: getName(0), right: getName(3), label: "Gara 1", meta: metadata[`${gid}-0`] },
        { left: getName(1), right: getName(2), label: "Gara 2", meta: metadata[`${gid}-1`] },
        { left: getWinner(gid, 0), right: getWinner(gid, 1), label: "Finale Vincenti", meta: metadata[`${gid}-2`] },
        { left: getLoser(gid, 0), right: getLoser(gid, 1), label: "Finale Perdenti", meta: metadata[`${gid}-3`] }
    ];
  };

  const getAllBracketMatches = () => {
    if (!bracketConfig || !bracketConfig.bracketAssignments) return [];
    const assignments = bracketConfig.bracketAssignments;
    const metadata = bracketConfig.bracketMetadata || {};
    const matchIds = Object.keys(assignments).map(k => k.replace(/-L$|-R$/, '')).filter((v, i, a) => a.indexOf(v) === i);
    return matchIds.map(mid => ({
        id: mid, label: mid.toUpperCase(), left: assignments[`${mid}-L`], right: assignments[`${mid}-R`],
        scoreL: metadata[mid]?.scoreL, scoreR: metadata[mid]?.scoreR, time: metadata[mid]?.time, court: metadata[mid]?.court
    }));
  };

  const gironiIds = config ? Array.from({ length: config.numGironi || 0 }, (_, i) => String.fromCharCode(65 + i)) : [];
  const bracketMatches = getAllBracketMatches();
  const isMe = (name) => name?.toLowerCase().includes(nomeAtleta.toLowerCase());

  if (status === "loading") return (
    <div className="min-h-screen bg-[#f8faff] flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-[#0a1628] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#f8faff] pb-20">
      <AthleteHeader />

      <div className="max-w-6xl mx-auto mt-6 md:mt-10 px-4">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-8">
            <div>
                <h2 className="text-4xl md:text-6xl font-black text-[#0a1628] uppercase tracking-tighter leading-none">Gironi & Calendario</h2>
                <p className="text-[10px] md:text-xs text-gray-400 font-bold uppercase tracking-[0.3em] mt-4">Match in tempo reale 🏐</p>
            </div>
            
            <div className="w-full md:w-auto relative group">
                <div className="absolute inset-0 bg-[#0a1628] rounded-3xl blur-xl opacity-10 group-hover:opacity-20 transition-opacity"></div>
                <select 
                    className="w-full md:w-auto relative bg-white border-4 border-white rounded-[2rem] px-8 py-5 font-black text-[#0a1628] uppercase text-xs tracking-widest shadow-xl outline-none focus:ring-4 focus:ring-[#0a1628]/5 transition-all appearance-none pr-14" 
                    value={selectedTorneo} 
                    onChange={e=>setSelectedTorneo(e.target.value)}
                >
                    {torneiAttivi.map(t=><option key={t.id} value={t.nome}>{t.nome}</option>)}
                </select>
                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-[#0a1628]">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={4} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                </div>
            </div>
        </div>

        <div className="space-y-12 md:space-y-20">
            {gironiIds.map(gid => (
                <section key={gid} className="relative">
                    <div className="flex items-center gap-4 mb-8">
                        <span className="w-14 h-14 bg-[#0a1628] text-[#FFD700] rounded-[1.5rem] flex items-center justify-center text-2xl font-black shadow-xl">
                            {gid}
                        </span>
                        <h3 className="text-2xl font-black text-[#0a1628] uppercase tracking-tighter">Girone {gid}</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                        {getGironeMatches(gid).map((m, i) => (
                            <div key={i} className={`bg-white p-8 md:p-10 rounded-[3rem] shadow-xl border-l-[12px] transition-all hover:scale-[1.02] ${isMe(m.left) || isMe(m.right) ? 'border-[#FFD700] ring-8 ring-[#FFD700]/5' : 'border-[#0a1628]/10'}`}>
                                <div className="flex justify-between items-start mb-6">
                                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">{m.label}</span>
                                    {m.meta?.time && <span className="text-[10px] font-black text-[#0a1628] bg-gray-50 px-3 py-1 rounded-full uppercase tracking-widest">{m.meta.time}</span>}
                                </div>
                                <div className="flex justify-between items-center gap-6">
                                    <div className="space-y-4 flex-1 min-w-0">
                                        <div className={`flex items-center gap-3 ${isMe(m.left) ? 'text-[#0a1628]' : 'text-gray-500'}`}>
                                            {isMe(m.left) && <span className="w-2 h-2 rounded-full bg-[#FFD700] animate-pulse shrink-0"></span>}
                                            <p className={`font-black text-lg md:text-xl truncate uppercase tracking-tighter ${isMe(m.left) ? '' : ''}`}>{m.left}</p>
                                        </div>
                                        <div className="h-px bg-gray-50 w-full relative">
                                            <span className="absolute left-0 top-1/2 -translate-y-1/2 bg-white px-2 text-[9px] font-black text-gray-200 uppercase tracking-widest">Contro</span>
                                        </div>
                                        <div className={`flex items-center gap-3 ${isMe(m.right) ? 'text-[#0a1628]' : 'text-gray-500'}`}>
                                            {isMe(m.right) && <span className="w-2 h-2 rounded-full bg-[#FFD700] animate-pulse shrink-0"></span>}
                                            <p className={`font-black text-lg md:text-xl truncate uppercase tracking-tighter`}>{m.right}</p>
                                        </div>
                                    </div>
                                    <div className="shrink-0 flex flex-col items-center justify-center w-24 h-24 bg-gray-50 rounded-[2rem] border border-gray-100 shadow-inner">
                                        {m.meta?.s1L || m.meta?.s1R ? (
                                            <p className="text-3xl font-black text-[#0a1628] tracking-tighter">{m.meta.s1L}<span className="text-gray-300 mx-1">:</span>{m.meta.s1R}</p>
                                        ) : (
                                            <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest text-center px-4 leading-tight">In<br/>Attesa</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            ))}

            {bracketMatches.length > 0 && (
                <section className="bg-[#0a1628] p-10 md:p-16 rounded-[4rem] text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-[#FFD700] rounded-full blur-[100px] -mr-48 -mt-48 opacity-5 group-hover:opacity-10 transition-opacity"></div>
                    <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500 rounded-full blur-[100px] -ml-40 -mb-40 opacity-5"></div>
                    
                    <div className="relative z-10">
                        <div className="text-center mb-16">
                            <h3 className="text-4xl md:text-6xl font-black text-[#FFD700] uppercase tracking-tighter leading-none mb-4">Fasi Finali</h3>
                            <p className="text-[10px] font-bold text-blue-300 uppercase tracking-[0.4em]">Battle for the Throne ⚔️</p>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                            {bracketMatches.map((m, i) => (
                                <div key={i} className={`p-10 rounded-[3rem] border-4 transition-all hover:-translate-y-2 duration-500 ${isMe(m.left) || isMe(m.right) ? 'bg-[#FFD700]/5 border-[#FFD700] shadow-[0_20px_50px_rgba(255,215,0,0.1)]' : 'bg-white/5 border-white/5'}`}>
                                    <div className="flex justify-between items-center mb-8">
                                        <span className="text-[10px] font-black text-[#FFD700] uppercase tracking-widest">{m.label}</span>
                                        <div className="flex gap-2">
                                            {m.time && <span className="text-[9px] font-black bg-white/10 px-2 py-1 rounded-lg">{m.time}</span>}
                                            {m.court && <span className="text-[9px] font-black bg-[#FFD700]/20 text-[#FFD700] px-2 py-1 rounded-lg">C.{m.court}</span>}
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <div className="flex justify-between items-center">
                                            <span className={`font-black text-sm md:text-base uppercase tracking-tighter truncate pr-4 ${isMe(m.left) ? 'text-[#FFD700]' : 'text-gray-300'}`}>{m.left || "TBD"}</span>
                                            <span className={`text-2xl font-black ${isMe(m.left) ? 'text-[#FFD700]' : ''}`}>{m.scoreL || 0}</span>
                                        </div>
                                        <div className="h-px bg-white/5 w-full"></div>
                                        <div className="flex justify-between items-center">
                                            <span className={`font-black text-sm md:text-base uppercase tracking-tighter truncate pr-4 ${isMe(m.right) ? 'text-[#FFD700]' : 'text-gray-300'}`}>{m.right || "TBD"}</span>
                                            <span className={`text-2xl font-black ${isMe(m.right) ? 'text-[#FFD700]' : ''}`}>{m.scoreR || 0}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}
        </div>
      </div>
      
      <button 
        onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} 
        className="fixed bottom-8 right-8 w-16 h-16 bg-[#0a1628] text-[#FFD700] rounded-3xl shadow-2xl flex items-center justify-center text-2xl border-4 border-[#FFD700] hover:scale-110 active:scale-90 transition-all z-50 md:hidden"
      >
        ↑
      </button>
    </main>
  );
}
