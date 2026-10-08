"use client";

import { useState, useEffect, useRef } from "react";
import StaffHeader from "@/app/components/StaffHeader";
import { getTornei, getIscrizioni, saveIscrizioni, saveTornei, getGironi, saveGironi, getBracket, saveBracket, syncAssignmentsWithIscrizioni } from "@/app/utils/db";

export default function StaffIscrizioni() {
  const [iscrizioni, setIscrizioni] = useState([]);
  const [tornei, setTornei] = useState([]);
  const isSavingRef = useRef(false);
  const loadVersionRef = useRef(0);
  
  const [selectedTorneoFilter, setSelectedTorneoFilter] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("Tutte");
  const [searchTerm, setSearchTerm] = useState("");

  // Detail modal for custom fields
  const [selectedIscrizioneDetail, setSelectedIscrizioneDetail] = useState(null);

  // Edit Modal States
  const [editingIscrizione, setEditingIscrizione] = useState(null);
  const [editFormData, setEditFormData] = useState({
    giocatori: "",
    tel: "",
    email: "",
    email2: "",
    torneo: "",
    stato: "Approvata",
    note: "",
    piazzamentoCircuito: "",
  });

  const startEdit = (req) => {
    setEditingIscrizione(req);
    setEditFormData({
      giocatori: req.giocatori || "",
      tel: req.tel || "",
      email: req.email || "",
      email2: req.atletaEmail2 || req.email2 || "",
      torneo: req.torneo || "",
      stato: req.stato || "Approvata",
      note: req.note || "",
      piazzamentoCircuito: req.piazzamentoCircuito || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editFormData.giocatori.trim()) {
      alert("Il campo Giocatori non può essere vuoto.");
      return;
    }
    if (editFormData.piazzamentoCircuito && (!Number.isInteger(Number(editFormData.piazzamentoCircuito)) || Number(editFormData.piazzamentoCircuito) < 1)) {
      alert("Il piazzamento deve essere un numero intero maggiore di zero.");
      return;
    }
    isSavingRef.current = true;
    try {
      const oldTeamName = editingIscrizione.giocatori;
      const newTeamName = editFormData.giocatori.trim();
      const tournamentName = editingIscrizione.torneo;

      const updated = iscrizioni.map((isc) => 
        String(isc.id) === String(editingIscrizione.id) 
          ? { 
              ...isc, 
              giocatori: newTeamName,
              tel: editFormData.tel.trim(),
              email: editFormData.email.trim(),
              ...(editFormData.email.trim() ? { atletaEmail1: editFormData.email.trim().toLocaleLowerCase("it-IT") } : {}),
              atletaEmail2: editFormData.email2.trim().toLowerCase(),
              torneo: tournamentName,
              stato: editFormData.stato,
              note: editFormData.note.trim(),
              piazzamentoCircuito: Number(editFormData.piazzamentoCircuito) > 0
                ? Number(editFormData.piazzamentoCircuito)
                : null,
            } 
          : isc
      );
      setIscrizioni(updated);
      await saveIscrizioni(updated);

      // Synchronize team name in gironi and bracket across all tournaments
      const allTorneiList = tornei.length > 0 ? tornei : await getTornei();
      for (const t of allTorneiList) {
        const slug = t.nome.toLowerCase().trim().replace(/\s+/g, '_');
        
        // Update Gironi assignments
        try {
          const gConfig = await getGironi(slug);
          if (gConfig && gConfig.gironeAssignments) {
            const syncedAssignments = syncAssignmentsWithIscrizioni(gConfig.gironeAssignments, updated);
            await saveGironi(slug, { ...gConfig, gironeAssignments: syncedAssignments });
          }
        } catch (err) {
          console.error("Errore aggiornamento gironi:", err);
        }

        // Update Bracket assignments
        try {
          const bConfig = await getBracket(slug);
          if (bConfig && bConfig.bracketAssignments) {
            const syncedAssignments = syncAssignmentsWithIscrizioni(bConfig.bracketAssignments, updated);
            await saveBracket(slug, { ...bConfig, bracketAssignments: syncedAssignments });
          }
        } catch (err) {
          console.error("Errore aggiornamento tabellone:", err);
        }
      }

      setEditingIscrizione(null);
      alert("Iscrizione modificata e sincronizzata con successo! 💾");
    } catch (err) {
      console.error("Errore nel salvataggio della modifica:", err);
    } finally {
      isSavingRef.current = false;
    }
  };

  const caricaDati = async () => {
    if (isSavingRef.current) return;
    const loadVersion = loadVersionRef.current;
    try {
      const data = await getIscrizioni();
      if (isSavingRef.current || loadVersion !== loadVersionRef.current) return;
      setIscrizioni(data || []);
      const parsed = await getTornei();
      if (isSavingRef.current || loadVersion !== loadVersionRef.current) return;
      setTornei(parsed || []);
      if (parsed && parsed.length > 0) {
        setSelectedTorneoFilter((current) => parsed.some((t) => t.nome === current) ? current : parsed[0].nome);
        setSelectedTorneoImport((current) => parsed.some((t) => t.nome === current) ? current : parsed[0].nome);
      }
    } catch (err) {
      console.error("Errore ricaricamento iscrizioni:", err);
    }
  };

  useEffect(() => {
    caricaDati();
    const handleFocus = () => caricaDati();
    window.addEventListener("focus", handleFocus);

    const interval = setInterval(() => {
      caricaDati();
    }, 4000);

    return () => {
      window.removeEventListener("focus", handleFocus);
      clearInterval(interval);
    };
  }, []);

  const handleApprove = async (id) => {
    loadVersionRef.current += 1;
    isSavingRef.current = true;
    try {
      const updated = iscrizioni.map((isc) => 
        String(isc.id) === String(id) ? { ...isc, stato: "Approvata" } : isc
      );
      setIscrizioni(updated);
      await saveIscrizioni(updated);
    } catch (err) {
      console.error("Errore approvazione iscrizione:", err);
    } finally {
      isSavingRef.current = false;
    }
  };

  const handleDelete = async (id) => {
    if (typeof window !== "undefined" && window.confirm("Sei sicuro di voler eliminare definitivamente questa iscrizione?")) {
      isSavingRef.current = true;
      loadVersionRef.current += 1;
      try {
        const deletedIsc = iscrizioni.find((isc) => String(isc.id) === String(id));
        const updated = iscrizioni.filter((isc) => String(isc.id) !== String(id));
        setIscrizioni(updated);
        await saveIscrizioni(updated);

        if (deletedIsc) {
          const allTornei = await getTornei();
          const updatedTornei = allTornei.map(t => {
            if (t.nome.toLowerCase().trim() === (deletedIsc.torneo || "").toLowerCase().trim()) {
              return { ...t, iscritti: Math.max(0, (t.iscritti || 0) - 1) };
            }
            return t;
          });
          await saveTornei(updatedTornei);
        }
      } catch (err) {
        console.error("Errore eliminazione iscrizione:", err);
      } finally {
        isSavingRef.current = false;
      }
    }
  };

  const exportToExcel = () => {
    const targetIscrizioni = iscrizioni.filter(isc => (isc.torneo || "").toLowerCase().trim() === selectedTorneoFilter.toLowerCase().trim());

    const escapeCSV = (val) => {
      if (val === undefined || val === null) return '""';
      const str = String(val);
      const escaped = str.replace(/"/g, '""');
      return `"${escaped}"`;
    };

    // Raccoglie tutte le domande/etichette personalizzate uniche presenti nelle iscrizioni filtrate
    const customLabels = [];
    targetIscrizioni.forEach(isc => {
      if (isc.risposte && Array.isArray(isc.risposte)) {
        isc.risposte.forEach(r => {
          if (r.label && !customLabels.includes(r.label)) {
            customLabels.push(r.label);
          }
        });
      }
    });

    const headers = [
      "ID",
      "Data Iscrizione",
      "Torneo",
      "Giocatori / Squadra",
      "Email",
      "Telefono",
      "Quota Pagata",
      "Stato",
      "Note",
      ...customLabels
    ];

    const csvRows = [
      headers.map(escapeCSV).join(","),
      ...targetIscrizioni.map(isc => {
        const row = [
          isc.id,
          isc.data,
          isc.torneo,
          isc.giocatori,
          isc.email || "",
          isc.tel || "",
          isc.quotaPagata !== undefined ? isc.quotaPagata : 0,
          isc.stato,
          isc.note || ""
        ];

        // Aggiunge le risposte ai campi custom corrispondenti
        customLabels.forEach(label => {
          const answer = isc.risposte && Array.isArray(isc.risposte)
            ? isc.risposte.find(r => r.label === label)
            : null;
          row.push(answer ? answer.valore : "");
        });

        return row.map(escapeCSV).join(",");
      })
    ];

    const csvContent = "\uFEFF" + csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `iscrizioni_bvi_${(selectedTorneoFilter || "torneo").replace(/\s+/g, '_').toLowerCase()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const selectedTorneo = tornei.find((torneo) => torneo.nome === selectedTorneoFilter);
  const tournamentIscrizioni = selectedTorneoFilter
    ? iscrizioni.filter((isc) => (isc.torneo || "").toLowerCase().trim() === selectedTorneoFilter.toLowerCase().trim())
    : [];
  const pendingCount = tournamentIscrizioni.filter((isc) => isc.stato === "In Attesa").length;
  const filteredIscrizioni = tournamentIscrizioni.filter((isc) => {
    const matchesStatus = selectedStatusFilter === "Tutte" || isc.stato === selectedStatusFilter;
    const query = searchTerm.trim().toLocaleLowerCase("it-IT");
    const matchesSearch = !query || [isc.giocatori, isc.email, isc.tel, isc.id].some((value) => String(value || "").toLocaleLowerCase("it-IT").includes(query));
    return matchesStatus && matchesSearch;
  });

  return (
    <main className="min-h-screen pb-20 bg-[#f8faff]">
      <StaffHeader />

      <div className="max-w-6xl mx-auto mt-6 md:mt-10 px-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 w-full">
            <div>
                <h2 className="text-3xl md:text-5xl font-black text-[#0a1628] uppercase tracking-tighter">Iscrizioni 📝</h2>
                <p className="text-[10px] md:text-xs text-gray-400 font-bold uppercase tracking-widest mt-2">Approvazione e gestione richieste</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <button 
                  onClick={exportToExcel}
                  disabled={!selectedTorneoFilter || tournamentIscrizioni.length === 0}
                  className="text-xs bg-[#0a1628] text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:scale-105 transition-transform"
                >
                  ⬇️ Scarica CSV
                </button>
            </div>
        </div>

        <section className="mb-6 rounded-[2rem] border border-blue-100 bg-white p-5 shadow-sm md:p-7">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Contesto attivo · un torneo alla volta</p>
              <h3 className="mt-1 text-xl font-black text-[#0a1628]">Seleziona il torneo da gestire</h3>
              <p className="mt-1 text-sm text-gray-500">Elenco ed esportazione seguono il torneo selezionato.</p>
            </div>
            <select
              value={selectedTorneoFilter}
              onChange={(event) => setSelectedTorneoFilter(event.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-[#0a1628] outline-none focus:ring-4 focus:ring-blue-500/10 md:max-w-md"
              aria-label="Seleziona torneo da gestire"
            >
              {tornei.length === 0 && <option value="">Nessun torneo disponibile</option>}
              {tornei.length > 0 && !selectedTorneoFilter && <option value="" disabled>Seleziona un torneo</option>}
              {tornei.map((torneo) => {
                const count = iscrizioni.filter((isc) => (isc.torneo || "").toLowerCase().trim() === torneo.nome.toLowerCase().trim()).length;
                return <option key={torneo.id} value={torneo.nome}>{torneo.nome} · {count} iscrizioni</option>;
              })}
            </select>
          </div>
          {selectedTorneo && <div className="mt-5 flex flex-wrap gap-3 border-t border-gray-100 pt-4 text-xs font-bold">
            <span className="rounded-full bg-blue-50 px-3 py-2 text-blue-700">{tournamentIscrizioni.length} iscrizioni totali</span>
            <span className="rounded-full bg-amber-50 px-3 py-2 text-amber-700">{pendingCount} da approvare</span>
            <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-700">{tournamentIscrizioni.length - pendingCount} approvate</span>
          </div>}
        </section>

        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtra iscrizioni per stato">
            {["Tutte", "In Attesa", "Approvata"].map((status) => {
              const count = status === "Tutte" ? tournamentIscrizioni.length : tournamentIscrizioni.filter((isc) => isc.stato === status).length;
              return <button key={status} onClick={() => setSelectedStatusFilter(status)} className={`rounded-xl px-4 py-2.5 text-xs font-black transition-colors ${selectedStatusFilter === status ? "bg-[#0a1628] text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>{status} ({count})</button>;
            })}
          </div>
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Cerca atleta, squadra o contatto" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-blue-500/10 md:max-w-sm" />
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
                {filteredIscrizioni.map((req) => (
                    <div key={req.id} className="bg-white p-6 rounded-[2rem] shadow-xl md:shadow-none md:rounded-none md:grid md:grid-cols-6 md:items-center hover:bg-blue-50/20 transition-all">
                        {/* Mobile Header: Badge ID e Data */}
                        <div className="flex justify-between items-center mb-4 md:mb-0 md:px-4">
                            <span className="text-[10px] font-black text-gray-300 md:hidden">#{req.id}</span>
                            <span className="text-sm font-bold text-gray-500">{req.data}</span>
                        </div>

                        {/* Squadra e Torneo */}
                        <div className="mb-4 md:mb-0 md:col-span-2 md:px-4">
                            <h4 className="text-lg font-black text-[#0a1628] leading-tight mb-1">{req.giocatori}</h4>
                            <div className="flex flex-wrap gap-1.5 items-center">
                                <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-black uppercase border border-blue-100">
                                    {req.torneo}
                                </span>
                                <button 
                                    onClick={() => setSelectedIscrizioneDetail(req)}
                                    className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded text-[9px] font-black uppercase border border-indigo-100 transition-colors"
                                >
                                    📋 {req.risposte && req.risposte.length > 0 ? "Info Modulo" : "Dettagli"}
                                </button>
                            </div>
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
                            <button 
                                onClick={() => startEdit(req)}
                                className="flex-1 md:flex-none h-12 md:w-10 md:h-10 bg-blue-500 text-white rounded-xl font-black text-sm flex items-center justify-center shadow-lg shadow-blue-200 hover:scale-110 active:scale-95 transition-all"
                                title="Modifica Iscrizione"
                            >
                                ✏️
                            </button>
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

                {filteredIscrizioni.length === 0 && (
                    <div className="py-20 text-center text-gray-400 font-bold italic">
                        Nessuna iscrizione trovata.
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Details Modal */}
      {selectedIscrizioneDetail && (
        <div className="fixed inset-0 bg-[#0a1628]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 max-w-xl w-full p-6 sm:p-10 relative">
            <button 
              onClick={() => setSelectedIscrizioneDetail(null)}
              className="absolute top-6 right-6 text-gray-400 hover:text-[#0a1628] font-black text-xl w-10 h-10 flex items-center justify-center bg-gray-50 hover:bg-gray-100 rounded-full transition-all"
            >
              ✕
            </button>

            <h3 className="text-2xl font-black text-[#0a1628] uppercase tracking-tight mb-1">Dettagli Iscrizione 📋</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">
              Risposte fornite nel modulo personalizzato
            </p>

            <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl mb-6">
               <p className="text-[10px] font-black text-blue-600 uppercase tracking-wider mb-1">Squadra / Atleti</p>
               <h4 className="text-lg font-black text-[#0a1628]">{selectedIscrizioneDetail.giocatori}</h4>
               <p className="text-xs text-gray-500 font-bold mt-1 uppercase">Torneo: {selectedIscrizioneDetail.torneo}</p>
            </div>

            <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-2">
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Telefono</p>
                  <p className="text-sm font-bold text-[#0a1628]">{selectedIscrizioneDetail.tel || "Non inserito"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Email</p>
                  <p className="text-sm font-bold text-[#0a1628] break-all">{selectedIscrizioneDetail.email || "Non inserita"}</p>
                </div>
              </div>

              {selectedIscrizioneDetail.risposte && selectedIscrizioneDetail.risposte.length > 0 ? (
                <div>
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2 mt-4">Risposte Modulo Personalizzato</p>
                  <div className="space-y-3 bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100/60">
                    {selectedIscrizioneDetail.risposte.map((r, rIdx) => (
                      <div key={rIdx} className="border-b border-indigo-100/40 pb-2.5 last:border-b-0">
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-0.5">{r.label}</p>
                        <p className="text-sm font-bold text-[#0a1628] whitespace-pre-wrap">{r.valore || "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              
              {selectedIscrizioneDetail.note && (
                <div className="border-t border-gray-200 pt-3 mt-3">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Note Aggiuntive</p>
                  <p className="text-sm font-bold text-[#0a1628] whitespace-pre-wrap">{selectedIscrizioneDetail.note}</p>
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-gray-100 mt-6 flex justify-end">
              <button
                onClick={() => setSelectedIscrizioneDetail(null)}
                className="px-8 py-3 bg-[#0a1628] hover:bg-blue-900 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg transition-all"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingIscrizione && (
        <div className="fixed inset-0 bg-[#0a1628]/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 max-w-md w-full p-6 sm:p-10 relative">
            <button 
              onClick={() => setEditingIscrizione(null)}
              className="absolute top-6 right-6 text-gray-400 hover:text-[#0a1628] font-black text-xl w-10 h-10 flex items-center justify-center bg-gray-50 hover:bg-gray-100 rounded-full transition-all"
            >
              ✕
            </button>

            <h3 className="text-2xl font-black text-[#0a1628] uppercase tracking-tight mb-1">Modifica Iscrizione ✏️</h3>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">
              Modifica i dettagli del contatto e dei giocatori
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Nomi Giocatori / Squadra</label>
                <input 
                  type="text"
                  value={editFormData.giocatori}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, giocatori: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 font-bold text-sm text-[#0a1628] outline-none focus:ring-4 focus:ring-blue-500/5 transition-all"
                />
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Torneo associato</p>
                <p className="mt-1 text-sm font-black text-[#0a1628]">{editingIscrizione.torneo || "Torneo non specificato"}</p>
                <p className="mt-1 text-[10px] font-semibold text-blue-700">Il torneo resta invariato durante la modifica per evitare spostamenti accidentali.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Recapito Telefonico</label>
                  <input 
                    type="text"
                    value={editFormData.tel}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, tel: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 font-bold text-sm text-[#0a1628] outline-none focus:ring-4 focus:ring-blue-500/5 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Indirizzo Email</label>
                  <input 
                    type="email"
                    value={editFormData.email}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 font-bold text-sm text-[#0a1628] outline-none focus:ring-4 focus:ring-blue-500/5 transition-all"
                  />
                  <p className="mt-1 text-[10px] text-gray-400">Per collegare questa iscrizione al profilo atleta, inserisci l'email usata per accedere al portale.</p>
                </div>
              </div>

              {!tornei.some((torneo) => torneo.nome === editFormData.torneo && (torneo.circuitRole === "tappa" || torneo.circuitRole === "finale" || String(torneo.categoria || "").toLowerCase().includes("giallo"))) && (
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Email compagno/a (facoltativa)</label>
                  <input
                    type="email"
                    value={editFormData.email2}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, email2: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 font-bold text-sm text-[#0a1628] outline-none focus:ring-4 focus:ring-blue-500/5 transition-all"
                  />
                  <p className="mt-1 text-[10px] text-gray-400">Collega l'iscrizione al profilo dell'altro atleta tramite la sua email di accesso.</p>
                </div>
              )}

              {tornei.some((torneo) => torneo.nome === editFormData.torneo && (torneo.circuitRole === "tappa" || torneo.circuitRole === "finale")) && (
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <label className="block text-[10px] font-black text-blue-800 uppercase tracking-widest mb-2">Piazzamento finale dell’atleta</label>
                  <input
                    type="number"
                    min="1"
                    max="64"
                    step="1"
                    value={editFormData.piazzamentoCircuito}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, piazzamentoCircuito: e.target.value }))}
                    placeholder="es. 3"
                    className="w-full bg-white border border-blue-100 rounded-xl px-4 py-3 font-bold text-sm text-[#0a1628] outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  <p className="mt-1 text-[10px] text-blue-700">I punti dell’atleta saranno calcolati dalla tabella del tour quando il torneo è concluso.</p>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Stato Iscrizione</label>
                <select
                  value={editFormData.stato}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, stato: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 font-bold text-sm text-[#0a1628] outline-none focus:ring-4 focus:ring-blue-500/5 transition-all cursor-pointer"
                >
                  <option value="Approvata">Approvata</option>
                  <option value="In Attesa">In Attesa</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Note Aggiuntive</label>
                <textarea
                  rows={3}
                  value={editFormData.note}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, note: e.target.value }))}
                  placeholder="Note interne o dettagli pagamento..."
                  className="w-full bg-gray-50 border border-gray-100 rounded-2xl p-4 font-bold text-xs text-[#0a1628] outline-none focus:ring-4 focus:ring-blue-500/5 transition-all resize-none"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-gray-100 mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setEditingIscrizione(null)}
                className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-[#0a1628] font-black text-xs uppercase tracking-widest rounded-2xl transition-all"
              >
                Annulla
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg transition-all"
              >
                Salva Modifiche ✅
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
