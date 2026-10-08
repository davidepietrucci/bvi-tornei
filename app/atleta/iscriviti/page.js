"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import AthleteHeader from "@/app/components/AthleteHeader";
import AthleteBottomNav from "@/app/components/AthleteBottomNav";
import { getTornei } from "@/app/utils/db";

export default function AtletaIscriviti() {
  const router = useRouter();
  const { user, isLoaded } = useUser();

  const [torneiAperti, setTorneiAperti] = useState([]);
  const [qualificazioneTour, setQualificazioneTour] = useState({});
  const [torneiLoading, setTorneiLoading] = useState(true);
  const [step, setStep] = useState(1); // 1: torneo, 2: dati, 3: conferma
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errore, setErrore] = useState("");
  const [telefonoPrecompilato, setTelefonoPrecompilato] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    torneo: "",
    giocatore1: "",
    giocatore2: "",
    emailCompagno: "",
    atletaUserId2: "",
    telefono: "",
    email: "",
  });

  // Partner Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [manualInvite, setManualInvite] = useState(false);

  useEffect(() => {
    if (isLoaded && !user) {
      const currentUrl = `${window.location.pathname}${window.location.search}`;
      router.push(`/atleta?redirect_url=${encodeURIComponent(currentUrl)}`);
      return;
    }
    if (user) {
      const initialName = user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || "";
      const initialEmail = user.primaryEmailAddress?.emailAddress || "";
      setFormData((prev) => ({
        ...prev,
        giocatore1: prev.giocatore1 || initialName,
        email: initialEmail || prev.email,
      }));
    }
    if (user) {
      Promise.all([
        getTornei(),
        fetch("/api/atleta/profilo", { cache: "no-store" }).then((response) => response.ok ? response.json() : null),
      ]).then(([all, profile]) => {
        const aperti = (all || []).filter((t) => t.stato === "Iscrizioni Aperte");
        setTorneiAperti(aperti);
        if (profile?.data?.telefono) {
          setFormData((prev) => ({ ...prev, telefono: prev.telefono || profile.data.telefono }));
          setTelefonoPrecompilato(true);
        }
        const qualification = {};
        for (const circuit of profile?.data?.circuiti || []) {
          for (const final of circuit.finali || []) qualification[final.torneo] = final.qualificato;
        }
        setQualificazioneTour(qualification);
        const requestedTournament = new URLSearchParams(window.location.search).get("tour");
        const requested = requestedTournament && aperti.find((t) =>
          t.nome.toLocaleLowerCase("it-IT").trim() === requestedTournament.toLocaleLowerCase("it-IT").trim()
        );
        const selectable = (requested && (requested.circuitRole !== "finale" || qualification[requested.nome]))
          || aperti.find((t) => t.circuitRole !== "finale" || qualification[t.nome]);
        if (selectable) setFormData((prev) => ({ ...prev, torneo: selectable.nome }));
      }).catch((error) => {
        console.error("Errore nel caricamento dei tornei:", error);
        setErrore("Non è stato possibile caricare i tornei. Ricarica la pagina.");
      }).finally(() => setTorneiLoading(false));
    }
  }, [router, isLoaded, user]);

  // Debounce search per la ricerca compagno
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/atleta/compagni?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const json = await res.json();
          setSearchResults(json.data || []);
        }
      } catch (err) {
        console.error("Errore ricerca compagni:", err);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSelectPartner = (athlete) => {
    setSelectedPartner(athlete);
    setFormData((prev) => ({
      ...prev,
      giocatore2: athlete.fullName,
      emailCompagno: athlete.email,
      atletaUserId2: athlete.id,
    }));
    setSearchQuery("");
    setSearchResults([]);
    setErrore("");
  };

  const handleClearPartner = () => {
    setSelectedPartner(null);
    setFormData((prev) => ({
      ...prev,
      giocatore2: "",
      emailCompagno: "",
      atletaUserId2: "",
    }));
  };

  const handleManualChange = (field, val) => {
    setSelectedPartner(null);
    setFormData((prev) => ({
      ...prev,
      [field]: val,
      atletaUserId2: "",
    }));
  };

  const selectedTorneo = torneiAperti.find((t) => t.nome === formData.torneo);
  const isIndividualTournament = ["tappa", "finale"].includes(selectedTorneo?.circuitRole) ||
    selectedTorneo?.formato === "singolo" ||
    selectedTorneo?.tipoIscrizione === "singola";

  const handleContinueToSummary = () => {
    setErrore("");
    const tel = (formData.telefono || "").trim();
    const g1 = (formData.giocatore1 || "").trim();
    const g2 = (formData.giocatore2 || "").trim();
    const email2 = (formData.emailCompagno || "").trim().toLowerCase();
    const myEmail = (user?.primaryEmailAddress?.emailAddress || formData.email || "").trim().toLowerCase();

    if (!g1) {
      setErrore("Inserisci il tuo nome e cognome.");
      return;
    }
    if (!tel) {
      setErrore("Inserisci un numero di cellulare.");
      return;
    }

    if (!isIndividualTournament) {
      if (!g2) {
        setErrore("Cerca o inserisci il nome del compagno o della compagna.");
        return;
      }
      if (!email2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email2)) {
        setErrore("Inserisci un'email valida per il compagno o la compagna.");
        return;
      }
      if (email2 === myEmail) {
        setErrore("L'email del compagno non può essere uguale alla tua email.");
        return;
      }
    }

    setStep(3);
  };

  const handleSubmit = async () => {
    if (submitting) return; // protezione doppio click
    setSubmitting(true);
    setErrore("");
    try {
      const res = await fetch("/api/iscrizioni/registra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          torneo: formData.torneo,
          giocatore1: formData.giocatore1,
          ...(!isIndividualTournament ? {
            giocatore2: formData.giocatore2,
            email2: formData.emailCompagno,
            atletaUserId2: formData.atletaUserId2 || "",
          } : {}),
          tel: formData.telefono,
          note: "Iscrizione effettuata dal portale atleti.",
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Errore durante il salvataggio.");
      }

      setShowModal(true);
    } catch (e) {
      setErrore(e.message || "Errore durante l'invio. Riprova.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#f0f4ff] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#0a1628] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isStep2Valid =
    Boolean((formData.giocatore1 || "").trim()) &&
    Boolean((formData.telefono || "").trim()) &&
    (isIndividualTournament || (
      Boolean((formData.giocatore2 || "").trim()) &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((formData.emailCompagno || "").trim())
    ));

  return (
    <main className="min-h-screen bg-[#f0f4ff] pb-28 xl:pb-10 xl:pl-72">
      <AthleteHeader />

      <div className="max-w-2xl mx-auto px-4 pt-6">

        {/* Titolo */}
        <div className="mb-6">
          <h1 className="text-3xl font-black text-[#0a1628] uppercase tracking-tighter">Iscriviti</h1>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Prenota il tuo posto sulla sabbia 🏐</p>
        </div>

        {errore && step !== 3 && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-black text-red-600">{errore}</div>
        )}

        {torneiLoading ? (
          <div className="rounded-[2rem] bg-white p-10 text-center text-xs font-bold text-gray-400">Caricamento tornei…</div>
        ) : torneiAperti.length === 0 ? (
          <div className="bg-white rounded-[2rem] p-10 shadow-sm border border-gray-100 flex flex-col items-center gap-4 text-center">
            <span className="text-5xl">🏜️</span>
            <p className="font-black text-[#0a1628] text-lg uppercase tracking-tighter">Nessun torneo aperto</p>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              Al momento non ci sono tornei con iscrizioni aperte. Torna presto!
            </p>
            <button
              onClick={() => router.push("/atleta/dashboard")}
              className="mt-2 px-8 py-3.5 bg-[#0a1628] text-[#FFD700] rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform"
            >
              ← Torna alla Dashboard
            </button>
          </div>
        ) : (
          <>
            {/* Step indicator */}
            <div className="flex items-center gap-0 mb-7">
              {[1, 2, 3].map((s, idx) => (
                <div key={s} className="flex items-center flex-1">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full font-black text-xs transition-all ${
                    step === s
                      ? "bg-[#0a1628] text-white shadow-lg scale-110"
                      : step > s
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-400"
                  }`}>
                    {step > s ? "✓" : s}
                  </div>
                  {idx < 2 && (
                    <div className={`flex-1 h-1 mx-1 rounded-full transition-colors ${step > s ? "bg-green-400" : "bg-gray-200"}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[9px] font-black text-gray-400 uppercase tracking-widest -mt-5 mb-6 px-0.5">
              <span className={step >= 1 ? "text-[#0a1628]" : ""}>Torneo</span>
              <span className={step >= 2 ? "text-[#0a1628]" : ""}>Dati</span>
              <span className={step >= 3 ? "text-[#0a1628]" : ""}>Conferma</span>
            </div>

            {/* Step 1: Selezione Torneo */}
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Seleziona il torneo</p>
                {torneiAperti.map((t) => (
                  <button
                    key={t.id}
                    disabled={t.circuitRole === "finale" && !qualificazioneTour[t.nome]}
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, torneo: t.nome }));
                    }}
                    className={`w-full text-left p-5 rounded-[1.8rem] border-2 transition-all active:scale-[0.99] ${
                      t.circuitRole === "finale" && !qualificazioneTour[t.nome]
                        ? "bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed"
                        :
                      formData.torneo === t.nome
                        ? "bg-[#0a1628] border-[#0a1628] shadow-xl"
                        : "bg-white border-gray-100 shadow-sm hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${
                        formData.torneo === t.nome ? "bg-[#FFD700]" : "bg-gray-50"
                      }`}>
                        🏆
                      </div>
                      <div>
                        <p className={`font-black text-sm uppercase tracking-tight ${formData.torneo === t.nome ? "text-white" : "text-[#0a1628]"}`}>
                          {t.nome}
                        </p>
                        <p className={`text-[10px] font-semibold mt-0.5 ${formData.torneo === t.nome ? "text-white/60" : "text-gray-400"}`}>
                          {t.data} · {t.categoria}
                        </p>
                        {t.circuitRole === "finale" && (
                          <p className={`text-[10px] font-bold mt-1 ${qualificazioneTour[t.nome] ? "text-green-300" : "text-amber-700"}`}>
                            {qualificazioneTour[t.nome] ? "✓ Qualificato/a alla finale" : `Riservato ai migliori atleti del tour ${t.circuitName || ""}`}
                          </p>
                        )}
                      </div>
                      {formData.torneo === t.nome && (
                        <div className="ml-auto w-6 h-6 rounded-full bg-[#FFD700] flex items-center justify-center text-[#0a1628] font-black text-xs">
                          ✓
                        </div>
                      )}
                    </div>
                  </button>
                ))}

                <button
                  disabled={!formData.torneo || (selectedTorneo?.circuitRole === "finale" && !qualificazioneTour[selectedTorneo.nome])}
                  onClick={() => setStep(2)}
                  className="w-full py-4 bg-[#0a1628] text-[#FFD700] rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl disabled:opacity-40 active:scale-95 transition-all mt-2"
                >
                  Continua →
                </button>
              </div>
            )}

            {/* Step 2: Inserimento dati */}
            {step === 2 && (
              <div className="space-y-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">I tuoi dati</p>

                {/* Sezione Giocatore 1 (Tu) */}
                <div className="bg-white rounded-[1.8rem] p-5 shadow-sm border border-gray-100 space-y-4">
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 block mb-1.5">
                      {isIndividualTournament ? "Atleta (Tu) *" : "Giocatore 1 (Tu) *"}
                    </label>
                    <input
                      type="text"
                      name="giocatore1"
                      value={formData.giocatore1}
                      onChange={handleChange}
                      placeholder="Il tuo nome e cognome"
                      readOnly={Boolean(user?.fullName?.trim())}
                      className={`w-full rounded-2xl px-4 py-3.5 font-bold text-sm transition-all ${
                        user?.fullName?.trim()
                          ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                          : "bg-gray-50 border border-gray-200 text-[#0a1628] focus:outline-none focus:ring-2 focus:ring-[#0a1628]"
                      }`}
                    />
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 block mb-1.5">
                      Cellulare *
                    </label>
                    <input
                      type="tel"
                      name="telefono"
                      value={formData.telefono}
                      onChange={handleChange}
                      placeholder="es. 333 1234567"
                      required
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 font-bold text-[#0a1628] text-sm focus:outline-none focus:ring-2 focus:ring-[#0a1628] transition-all"
                    />
                    <p className="mt-1 text-[9px] font-semibold text-gray-400">
                      {telefonoPrecompilato ? "Precompilato dal tuo profilo: aggiornalo se è cambiato." : "Lo useremo per comunicazioni urgenti sul torneo."}
                    </p>
                  </div>

                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1 block mb-1.5">
                      Email account
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={user?.primaryEmailAddress?.emailAddress || formData.email}
                      readOnly
                      className="w-full bg-gray-100 rounded-2xl px-4 py-3.5 font-bold text-gray-500 text-sm cursor-not-allowed"
                    />
                    <p className="mt-1 text-[9px] font-semibold text-gray-400">Riceverai la conferma a questo indirizzo.</p>
                  </div>
                </div>

                {/* Sezione Compagno di Squadra (Solo per tornei a coppie) */}
                {!isIndividualTournament && (
                  <div className="bg-white rounded-[1.8rem] p-5 shadow-sm border border-gray-100 space-y-4">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-[#0a1628] flex items-center gap-1.5">
                        <span>👥</span> Compagno / Compagna di Squadra *
                      </h3>
                      <p className="text-[10px] font-semibold text-gray-400 mt-0.5">
                        Cerca tra gli atleti iscritti al portale BVI oppure invitalo via email
                      </p>
                    </div>

                    {selectedPartner ? (
                      /* Compagno selezionato da directory */
                      <div className="p-4 rounded-2xl bg-[#0a1628] text-white flex items-center justify-between gap-3 shadow-md">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-[#FFD700] text-[#0a1628] font-black flex items-center justify-center text-sm shrink-0">
                            {(selectedPartner.nome?.[0] || selectedPartner.fullName?.[0] || "A").toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-black text-sm text-white truncate">{selectedPartner.fullName}</p>
                              <span className="bg-green-500/20 text-green-300 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                Portale BVI
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-300 truncate">{selectedPartner.email}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleClearPartner}
                          className="text-[10px] font-black text-white/70 hover:text-white px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all shrink-0"
                        >
                          Cambia ✕
                        </button>
                      </div>
                    ) : (
                      /* Ricerca compagno */
                      <div className="space-y-3">
                        {!manualInvite ? (
                          <div className="space-y-2">
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">🔍</span>
                              <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Cerca atleta per nome, cognome o email..."
                                className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-10 py-3.5 font-bold text-[#0a1628] text-sm focus:outline-none focus:ring-2 focus:ring-[#0a1628] transition-all"
                              />
                              {searching && (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#0a1628] border-t-transparent rounded-full animate-spin" />
                              )}
                            </div>

                            {/* Risultati ricerca */}
                            {searchResults.length > 0 && (
                              <div className="max-h-52 overflow-y-auto rounded-2xl border border-gray-100 bg-gray-50 p-2 space-y-1">
                                {searchResults.map((ath) => (
                                  <div
                                    key={ath.id}
                                    className="p-2.5 rounded-xl bg-white hover:bg-[#0a1628] hover:text-white transition-all flex items-center justify-between gap-3 group cursor-pointer shadow-xs"
                                    onClick={() => handleSelectPartner(ath)}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-8 h-8 rounded-lg bg-gray-100 group-hover:bg-[#FFD700] group-hover:text-[#0a1628] font-black flex items-center justify-center text-xs shrink-0">
                                        {(ath.nome?.[0] || ath.fullName?.[0] || "A").toUpperCase()}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-black text-xs text-[#0a1628] group-hover:text-white truncate">{ath.fullName}</p>
                                        <p className="text-[9px] text-gray-400 group-hover:text-gray-300 truncate">{ath.email}</p>
                                      </div>
                                    </div>
                                    <span className="text-[9px] font-black text-[#0a1628] group-hover:text-[#FFD700] uppercase tracking-wider shrink-0">
                                      Scegli +
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {searchQuery.trim().length >= 2 && !searching && searchResults.length === 0 && (
                              <p className="text-[10px] font-bold text-gray-400 px-2">
                                Nessun atleta registrato corrisponde a &quot;{searchQuery}&quot;.
                              </p>
                            )}

                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => { setManualInvite(true); setSearchQuery(""); setSearchResults([]); }}
                                className="text-[10px] font-black text-[#0a1628] hover:underline uppercase tracking-wider flex items-center gap-1.5"
                              >
                                <span>➕</span> Il compagno non è ancora registrato? Inseriscilo manualmente
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Inserimento manuale */
                          <div className="space-y-3 p-4 rounded-2xl bg-amber-50/50 border border-amber-200/60">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] font-black text-[#0a1628] uppercase tracking-wider">
                                Inserisci dati compagno/a
                              </p>
                              <button
                                type="button"
                                onClick={() => setManualInvite(false)}
                                className="text-[9px] font-bold text-gray-500 hover:text-[#0a1628]"
                              >
                                ← Torna alla ricerca atleti
                              </button>
                            </div>
                            <div>
                              <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1">
                                Nome e Cognome compagno/a *
                              </label>
                              <input
                                type="text"
                                name="giocatore2"
                                value={formData.giocatore2}
                                onChange={(e) => handleManualChange("giocatore2", e.target.value)}
                                placeholder="es. Elena Rossi"
                                className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold text-[#0a1628] text-xs focus:ring-2 focus:ring-[#0a1628] focus:outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest block mb-1">
                                Email compagno/a *
                              </label>
                              <input
                                type="email"
                                name="emailCompagno"
                                value={formData.emailCompagno}
                                onChange={(e) => handleManualChange("emailCompagno", e.target.value)}
                                placeholder="es. elena.rossi@email.it"
                                className="w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold text-[#0a1628] text-xs focus:ring-2 focus:ring-[#0a1628] focus:outline-none"
                              />
                              <p className="mt-1 text-[9px] font-semibold text-gray-400">
                                Invieremo un&apos;email di invito a questo indirizzo per unirsi alla tua squadra e registrarsi al portale.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="py-4 px-6 bg-white border border-gray-200 text-gray-500 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                  >
                    ← Indietro
                  </button>
                  <button
                    disabled={!isStep2Valid}
                    onClick={handleContinueToSummary}
                    className="flex-1 py-4 bg-[#0a1628] text-[#FFD700] rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl disabled:opacity-40 active:scale-95 transition-all"
                  >
                    Continua →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Riepilogo */}
            {step === 3 && (
              <div className="space-y-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Riepilogo iscrizione</p>

                <div className="bg-white rounded-[1.8rem] p-5 shadow-sm border border-gray-100 space-y-4">
                  <RiepilogoRow label="Torneo" value={formData.torneo} />
                  <RiepilogoRow label="Data torneo" value={selectedTorneo?.data || "—"} />
                  <RiepilogoRow label="Categoria" value={selectedTorneo?.categoria || "—"} />
                  <div className="border-t border-gray-50 pt-4">
                    <RiepilogoRow label={isIndividualTournament ? "Atleta" : "Giocatore 1"} value={formData.giocatore1} />
                    {!isIndividualTournament && (
                      <RiepilogoRow
                        label="Giocatore 2"
                        value={`${formData.giocatore2} ${formData.atletaUserId2 ? "✓ (Portale)" : "(Invitato)"}`}
                      />
                    )}
                    <RiepilogoRow label="Cellulare" value={formData.telefono} />
                    <RiepilogoRow label="Email conferma" value={user?.primaryEmailAddress?.emailAddress || formData.email} />
                    {!isIndividualTournament && (
                      <RiepilogoRow label="Email compagno/a" value={formData.emailCompagno} />
                    )}
                  </div>
                </div>

                <div className="bg-[#FFD700]/10 rounded-2xl p-4 border border-[#FFD700]/30">
                  <p className="text-[10px] font-black text-[#0a1628] uppercase tracking-widest">
                    ⚠️ La tua iscrizione sarà in attesa di approvazione dello staff BVI.
                  </p>
                </div>

                {errore && (
                  <div className="bg-red-50 rounded-2xl p-4 border border-red-200 flex items-center gap-2">
                    <span className="text-base shrink-0">🚫</span>
                    <p className="text-xs font-black text-red-600">{errore}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(2)}
                    className="py-4 px-6 bg-white border border-gray-200 text-gray-500 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                  >
                    ← Indietro
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 py-4 bg-[#0a1628] text-[#FFD700] rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl disabled:opacity-60 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-[#FFD700] border-t-transparent rounded-full animate-spin" />
                        Invio...
                      </>
                    ) : (
                      "Invia Iscrizione 🚀"
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal successo */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 w-full max-w-sm text-center shadow-2xl">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5 text-3xl">✅</div>
            <h2 className="text-2xl font-black text-[#0a1628] uppercase tracking-tighter mb-2">Iscrizione Inviata!</h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-loose mb-6">
              La richiesta è stata trasmessa allo staff. Riceverai conferma a{" "}
              <span className="text-[#0a1628]">{user?.primaryEmailAddress?.emailAddress || formData.email}</span>.
              {!isIndividualTournament && formData.emailCompagno && (
                <> Abbiamo inviato una notifica anche a <span className="text-[#0a1628]">{formData.emailCompagno}</span>.</>
              )}
            </p>
            <button
              onClick={() => {
                setShowModal(false);
                router.push("/atleta/dashboard");
              }}
              className="w-full py-4 bg-[#0a1628] text-[#FFD700] rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-transform"
            >
              Torna alla Dashboard
            </button>
          </div>
        </div>
      )}

      <AthleteBottomNav />
    </main>
  );
}

function RiepilogoRow({ label, value }) {
  return (
    <div className="flex justify-between items-center py-2">
      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
      <span className="text-xs font-black text-[#0a1628] max-w-[60%] text-right truncate">{value || "—"}</span>
    </div>
  );
}
