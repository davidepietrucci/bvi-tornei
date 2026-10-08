"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { calculateSingleGroupStats, calculateUnifiedRanking } from "@/app/utils/ranking";

export default function TournamentPublicView({
  tournament,
  confirmedRegistrations,
  gironiData,
  bracketData,
  isIndividual,
  capacity,
  isOpen,
  isFull,
  placesLeft,
  category,
  participantLabel,
  heroImage
}) {
  const [isIscrizioniModalOpen, setIsIscrizioniModalOpen] = useState(false);
  const [searchIscrizioni, setSearchIscrizioni] = useState("");
  const [isClassificaModalOpen, setIsClassificaModalOpen] = useState(false);
  const [activeGironeTab, setActiveGironeTab] = useState("A");

  const isFinished = tournament.stato === "Concluso";

  // Prevent background scroll when any modal is open
  useEffect(() => {
    if (isIscrizioniModalOpen || isClassificaModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isIscrizioniModalOpen, isClassificaModalOpen]);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsIscrizioniModalOpen(false);
        setIsClassificaModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Filter registrations for the popup modal
  const filteredRegistrations = useMemo(() => {
    if (!searchIscrizioni.trim()) return confirmedRegistrations;
    const q = searchIscrizioni.toLowerCase().trim();
    return confirmedRegistrations.filter((reg) =>
      String(reg.giocatori || "").toLowerCase().includes(q)
    );
  }, [confirmedRegistrations, searchIscrizioni]);

  // Gironi available
  const gironiDisponibili = useMemo(() => {
    if (!gironiData || !gironiData.numGironi) return [];
    return Array.from({ length: gironiData.numGironi }, (_, i) => String.fromCharCode(65 + i));
  }, [gironiData]);

  // Ensure active girone is valid
  useEffect(() => {
    if (gironiDisponibili.length > 0 && !gironiDisponibili.includes(activeGironeTab)) {
      setActiveGironeTab(gironiDisponibili[0]);
    }
  }, [gironiDisponibili, activeGironeTab]);

  // Calculate Group Rankings
  const groupStats = useMemo(() => {
    if (!gironiData || !gironiData.gironeAssignments) return {};
    const statsMap = {};
    gironiDisponibili.forEach((gid) => {
      try {
        const stats = calculateSingleGroupStats(gid, gironiData);
        if (Array.isArray(stats)) {
          // Sort: Wins desc, then points quotient desc, then point difference desc
          statsMap[gid] = [...stats].sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            const qzA = a.puntiSubiti === 0 ? (a.puntiFatti > 0 ? 999 : 0) : a.puntiFatti / a.puntiSubiti;
            const qzB = b.puntiSubiti === 0 ? (b.puntiFatti > 0 ? 999 : 0) : b.puntiFatti / b.puntiSubiti;
            if (qzB !== qzA) return qzB - qzA;
            const diffA = (a.puntiFatti || 0) - (a.puntiSubiti || 0);
            const diffB = (b.puntiFatti || 0) - (b.puntiSubiti || 0);
            if (diffB !== diffA) return diffB - diffA;
            return (b.puntiFatti || 0) - (a.puntiFatti || 0);
          });
        } else {
          statsMap[gid] = [];
        }
      } catch (err) {
        console.warn("Calcolo statistiche girone", gid, err);
        statsMap[gid] = [];
      }
    });
    return statsMap;
  }, [gironiData, gironiDisponibili]);

  // Calculate Unified Ranking across all groups
  const unifiedRankings = useMemo(() => {
    if (!gironiData) return [];
    try {
      const res = calculateUnifiedRanking(gironiData);
      return Array.isArray(res) ? res : [];
    } catch (e) {
      return [];
    }
  }, [gironiData]);

  // Calculate Bracket Podium
  const bracketPodium = useMemo(() => {
    if (!bracketData) return null;

    try {
      const assignments = bracketData?.bracketAssignments || {};
      const metadata = bracketData?.bracketMetadata || {};

      const getWinnerOfMatch = (matchId) => {
        const meta = metadata[matchId] || {};
        const scoreL = parseInt(meta.scoreL || 0);
        const scoreR = parseInt(meta.scoreR || 0);
        if (scoreL === 0 && scoreR === 0) return null;
        return scoreL > scoreR ? assignments[`${matchId}-L`] : assignments[`${matchId}-R`];
      };

      const getLoserOfMatch = (matchId) => {
        const meta = metadata[matchId] || {};
        const scoreL = parseInt(meta.scoreL || 0);
        const scoreR = parseInt(meta.scoreR || 0);
        if (scoreL === 0 && scoreR === 0) return null;
        return scoreL > scoreR ? assignments[`${matchId}-R`] : assignments[`${matchId}-L`];
      };

      const isGoldSilver = bracketData?.phaseType === "gold_silver";
      const isSingle = bracketData?.phaseType === "single";

      if (isGoldSilver) {
        const goldRank = [
          { pos: "1°", label: "1° Oro", team: getWinnerOfMatch("gold-f1") },
          { pos: "2°", label: "2° Oro", team: getLoserOfMatch("gold-f1") },
          { pos: "3°", label: "3° Oro", team: getWinnerOfMatch("gold-f3") },
          { pos: "4°", label: "4° Oro", team: getLoserOfMatch("gold-f3") },
        ].filter((x) => Boolean(x.team));

        const silverRank = [
          { pos: "1°", label: "1° Silver", team: getWinnerOfMatch("silver-f1") },
          { pos: "2°", label: "2° Silver", team: getLoserOfMatch("silver-f1") },
          { pos: "3°", label: "3° Silver", team: getWinnerOfMatch("silver-f3") },
          { pos: "4°", label: "4° Silver", team: getLoserOfMatch("silver-f3") },
        ].filter((x) => Boolean(x.team));

        if (goldRank.length > 0 || silverRank.length > 0) {
          return { type: "gold_silver", goldRank, silverRank };
        }
      } else if (isSingle) {
        const rank = [
          { pos: "1°", label: "1° Classificato", team: getWinnerOfMatch("gold-f1") },
          { pos: "2°", label: "2° Classificato", team: getLoserOfMatch("gold-f1") },
          { pos: "3°", label: "3° Classificato", team: getWinnerOfMatch("gold-f3") },
          { pos: "4°", label: "4° Classificato", team: getLoserOfMatch("gold-f3") },
        ].filter((x) => Boolean(x.team));

        if (rank.length > 0) {
          return { type: "single", rank };
        }
      } else {
        // Double elimination
        const rank = [
          { pos: "1°", label: "1° Classificato", team: getWinnerOfMatch("grand-final") },
          { pos: "2°", label: "2° Classificato", team: getLoserOfMatch("grand-final") },
          { pos: "3°", label: "3° Classificato", team: getLoserOfMatch("lb-f") },
          { pos: "4°", label: "4° Classificato", team: getLoserOfMatch("lb-s2") },
        ].filter((x) => Boolean(x.team));

        if (rank.length > 0) {
          return { type: "double", rank };
        }
      }
    } catch (err) {
      console.warn("Errore calcolo podio bracket:", err);
    }

    return null;
  }, [bracketData]);

  // Check if matches have started in gironi
  const hasGironiMatches = useMemo(() => {
    if (!gironiData?.matchMetadata) return false;
    return Object.values(gironiData.matchMetadata).some((m) => {
      const s1L = parseInt(m?.s1L || 0);
      const s1R = parseInt(m?.s1R || 0);
      return s1L > 0 || s1R > 0;
    });
  }, [gironiData]);

  const hasStandingsData = Boolean(bracketPodium || hasGironiMatches || (gironiDisponibili.length > 0));

  const activeGroupList = groupStats[activeGironeTab] || [];

  return (
    <div className="w-full">
      {/* Hero section */}
      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-8 sm:px-8 sm:py-12 lg:grid-cols-[1.1fr_.9fr] lg:items-stretch">
        <div className="flex flex-col justify-center py-3">
          <Link
            href="/#tornei"
            className="mb-8 inline-flex w-fit items-center gap-2 text-xs font-bold text-[#657080] hover:text-[#101d2c]"
          >
            ← Torna al calendario
          </Link>
          <p className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.23em] text-[#78600d]">
            <span className="h-2 w-2 rounded-full bg-[#d6aa16]" /> Torneo BVI · {tournament.stato || "In Programmazione"}
          </p>
          <h1 className="max-w-3xl text-4xl font-black leading-[.98] tracking-[-.045em] sm:text-6xl">
            {tournament.nome}
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#596574]">
            {tournament.circuitName
              ? `${tournament.circuitRole === "finale" ? "Finale" : "Tappa del tour"} ${tournament.circuitName}. `
              : "Una giornata di beach volley firmata Beach Volley Institute. "}
            {category}
          </p>

          <div className="mt-8 grid max-w-xl grid-cols-2 gap-px overflow-hidden rounded-xl border border-[#101d2c]/10 bg-[#101d2c]/10 sm:grid-cols-4">
            <InfoTile label="Data" value={tournament.data || "Da definire"} />
            <InfoTile label="Luogo" value={tournament.location || "Da definire"} />
            <InfoTile label="Categoria" value={category} />
            <InfoTile label="Quota" value={`€${Number(tournament.quota ?? 40)}`} />
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {isOpen && !isFull && (
              <Link
                href={`/atleta/iscriviti?tour=${encodeURIComponent(tournament.nome)}`}
                className="rounded-xl bg-[#101d2c] px-6 py-4 text-sm font-black text-white shadow-lg transition hover:bg-[#263d57]"
              >
                Iscriviti dal Portale Atleta <span className="ml-2 text-[#f5ca3e]">↗</span>
              </Link>
            )}
            {isOpen && isFull && (
              <span className="rounded-xl bg-gray-200 px-6 py-4 text-sm font-black text-gray-500">
                Posti esauriti
              </span>
            )}
            {!isOpen && (
              <Link
                href="/atleta"
                className="rounded-xl bg-[#101d2c] px-6 py-4 text-sm font-black text-white shadow-lg hover:bg-[#263d57]"
              >
                Accedi all’Area Atleta ↗
              </Link>
            )}

            {/* Pulsante Partecipanti: apre direttamente il popup con tutte le iscrizioni */}
            <button
              type="button"
              onClick={() => setIsIscrizioniModalOpen(true)}
              className="cursor-pointer rounded-xl border border-[#101d2c]/20 bg-white px-5 py-4 text-sm font-bold text-[#101d2c] shadow-sm transition hover:bg-[#f5f4ef] hover:border-[#101d2c]"
            >
              👥 Partecipanti ({confirmedRegistrations.length})
            </button>

            {/* Pulsante Classifica: scrolla alla card classifica in linea */}
            <a
              href="#classifica-section"
              className="rounded-xl border border-[#101d2c]/20 bg-[#f5ca3e]/20 px-5 py-4 text-sm font-bold text-[#78600d] transition hover:bg-[#f5ca3e]/40"
            >
              🏆 Classifica ↓
            </a>
          </div>
          {isOpen && !isFull && (
            <p className="mt-3 text-xs text-[#657080]">
              Iscrizione personale e gestione della richiesta dalla tua Area Atleta.
            </p>
          )}
        </div>

        <div className="relative min-h-[360px] overflow-hidden rounded-[1.7rem] bg-[#101d2c] shadow-[0_28px_70px_-28px_rgba(16,29,44,.65)] sm:min-h-[470px]">
          <Image
            src={heroImage}
            alt={`Beach volley, ${tournament.nome}`}
            fill
            priority
            unoptimized={Boolean(heroImage && !heroImage.startsWith("/"))}
            sizes="(max-width: 1024px) 100vw, 45vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#071321]/90 via-[#071321]/10 to-transparent" />
          <div className="absolute left-5 top-5 rounded-lg border border-white/20 bg-[#101d2c]/75 px-3 py-2 text-[9px] font-black uppercase tracking-[.2em] text-white backdrop-blur-sm">
            BVI · {tournament.id ? `Evento #${tournament.id}` : "Evento"}
          </div>
          <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/15 bg-[#101d2c]/90 p-5 text-white backdrop-blur-md sm:inset-x-6 sm:bottom-6 sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#f5ca3e]">
              {capacity ? `Posti ${participantLabel}` : `Iscritti ${participantLabel}`}
            </p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="text-3xl font-black">
                {confirmedRegistrations.length}
                {capacity > 0 && <span className="text-lg text-white/50"> / {capacity}</span>}
              </p>
              <p className="text-right text-xs font-semibold text-white/60">
                {placesLeft === null
                  ? "Iscrizioni da confermare"
                  : isFull
                  ? "Capienza raggiunta"
                  : `${placesLeft} ${placesLeft === 1 ? "posto" : "posti"} disponibili`}
              </p>
            </div>
            {capacity > 0 && (
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-[#f5ca3e] transition-all duration-500"
                  style={{ width: `${Math.min(100, (confirmedRegistrations.length / capacity) * 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SEZIONE IN LINEA: Informazioni Utili | Partecipanti (con popup) | Classifiche del Torneo */}
      <section id="classifica-section" className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 sm:pb-20">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[.25em] text-[#78600d]">
              Panoramica Torneo
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-[#101d2c] tracking-tight">
              Dettagli, Iscrizioni e Classifiche
            </h2>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-[#657080]">Dati aggiornati in tempo reale</span>
          </div>
        </div>

        {/* Griglia a 3 colonne perfettamente allineata in linea */}
        <div className="grid gap-6 lg:grid-cols-3 items-stretch">

          {/* CARD 1: Informazioni Utili */}
          <div className="flex flex-col justify-between rounded-2xl bg-[#101d2c] p-6 text-white shadow-sm sm:p-7">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.23em] text-[#f5ca3e]">
                Informazioni utili
              </p>
              <h3 className="mt-2 text-2xl font-black tracking-tight">Tutto sul torneo</h3>
              <dl className="mt-5 divide-y divide-white/10">
                <DetailRow label="Stato" value={tournament.stato || "In Programmazione"} />
                <DetailRow label="Formato" value={isIndividual ? "Iscrizione singola" : "Iscrizione a coppie"} />
                <DetailRow label="Quota" value={`€${Number(tournament.quota ?? 40)}`} />
                <DetailRow label="Capienza" value={capacity > 0 ? `${capacity} ${participantLabel}` : "Da definire"} />
                <DetailRow label="Data" value={tournament.data || "Da definire"} />
                <DetailRow label="Luogo" value={tournament.location || "Da definire"} />
                {tournament.circuitName && <DetailRow label="Tour" value={tournament.circuitName} />}
              </dl>
            </div>
            <div className="mt-6 border-t border-white/10 pt-4">
              <p className="text-xs leading-5 text-white/50">
                Per iscriverti o gestire la tua richiesta, accedi al Portale Atleta BVI.
              </p>
              <Link
                href="/atleta"
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-black text-[#f5ca3e] hover:text-yellow-200"
              >
                Vai all’Area Atleta ↗
              </Link>
            </div>
          </div>

          {/* CARD 2: Partecipanti / Iscrizioni (con preview e pulsante popup per vederle tutte) */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#101d2c]/10 bg-white p-6 shadow-sm sm:p-7">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.23em] text-[#78600d]">
                    {String(confirmedRegistrations.length).padStart(2, "0")} confermati
                  </p>
                  <h3 className="mt-2 text-2xl font-black tracking-tight text-[#101d2c]">
                    Partecipanti
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsIscrizioniModalOpen(true)}
                  className="cursor-pointer rounded-lg bg-[#f5f4ef] px-3 py-1.5 text-xs font-bold text-[#101d2c] hover:bg-[#f5ca3e]/30 transition"
                  title="Apri scheda pop-up per vedere tutte le iscrizioni"
                >
                  Vedi tutte ↗
                </button>
              </div>

              {/* Lista anteprima (fino a 5 partecipanti per mantenere l'altezza allineata) */}
              {confirmedRegistrations.length > 0 ? (
                <div className="mt-5 space-y-2">
                  {confirmedRegistrations.slice(0, 5).map((registration, index) => (
                    <div
                      key={registration.id || index}
                      className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-[#f5f4ef] px-3.5 py-2.5 transition hover:bg-gray-100"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#101d2c] text-[11px] font-black text-[#f5ca3e]">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="truncate text-xs font-bold text-[#101d2c]">
                          {registration.giocatori || "Partecipante"}
                        </span>
                      </div>
                      <span className="shrink-0 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                        ✓
                      </span>
                    </div>
                  ))}

                  {confirmedRegistrations.length > 5 && (
                    <p className="pt-1 text-center text-xs font-semibold text-[#657080]">
                      + altre {confirmedRegistrations.length - 5} {participantLabel} iscritte
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-6 rounded-xl border border-dashed border-[#101d2c]/20 bg-[#f5f4ef] px-4 py-8 text-center">
                  <span className="text-3xl block mb-2">🏐</span>
                  <p className="text-sm font-bold text-[#101d2c]">Nessun partecipante confermato</p>
                  {isOpen && (
                    <p className="mt-1 text-xs text-[#657080]">Puoi essere il primo a iscriverti!</p>
                  )}
                </div>
              )}
            </div>

            {/* Pulsante popup iscrizioni in evidenza */}
            <div className="mt-6 border-t border-[#101d2c]/10 pt-4">
              <button
                type="button"
                onClick={() => setIsIscrizioniModalOpen(true)}
                className="w-full cursor-pointer flex items-center justify-center gap-2 rounded-xl bg-[#101d2c] px-4 py-3 text-xs font-black text-white shadow-md transition hover:bg-[#263d57]"
              >
                <span>👥 Mostra tutte le iscrizioni ({confirmedRegistrations.length})</span>
                <span className="text-[#f5ca3e]">↗</span>
              </button>
            </div>
          </div>

          {/* CARD 3: Classifiche Torneo (visibili direttamente in linea con gli altri elementi) */}
          <div className="flex flex-col justify-between rounded-2xl border border-[#101d2c]/10 bg-white p-6 shadow-sm sm:p-7">
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.23em] text-[#78600d]">
                    {isFinished ? "Risultati Ufficiali" : hasGironiMatches ? "In Tempo Reale" : "Tabellone & Gironi"}
                  </p>
                  <h3 className="mt-2 text-2xl font-black tracking-tight text-[#101d2c] flex items-center gap-2">
                    🏆 Classifica
                  </h3>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                    isFinished
                      ? "bg-amber-100 text-amber-800"
                      : hasGironiMatches
                      ? "bg-emerald-100 text-emerald-800 animate-pulse"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {isFinished ? "Concluso" : hasGironiMatches ? "Live" : "In attesa"}
                </span>
              </div>

              {/* Selettore Gironi se presenti più gironi */}
              {gironiDisponibili.length > 1 && !isFinished && (
                <div className="mt-4 flex flex-wrap gap-1.5 rounded-xl bg-[#f5f4ef] p-1">
                  {gironiDisponibili.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setActiveGironeTab(g)}
                      className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-black transition ${
                        activeGironeTab === g
                          ? "bg-[#101d2c] text-white shadow-sm"
                          : "text-[#657080] hover:text-[#101d2c]"
                      }`}
                    >
                      Girone {g}
                    </button>
                  ))}
                  {unifiedRankings.length > 0 && (
                    <button
                      key="all"
                      type="button"
                      onClick={() => setActiveGironeTab("ALL")}
                      className={`cursor-pointer rounded-lg px-3 py-1 text-xs font-black transition ${
                        activeGironeTab === "ALL"
                          ? "bg-[#101d2c] text-white shadow-sm"
                          : "text-[#657080] hover:text-[#101d2c]"
                      }`}
                    >
                      Generale
                    </button>
                  )}
                </div>
              )}

              {/* CONTENUTO CLASSIFICA: Podio o Tabella Gironi o Placeholder */}
              <div className="mt-4">
                {/* 1. SE C'È UN PODIO / CONCLUSO */}
                {bracketPodium ? (
                  <div className="space-y-2">
                    {bracketPodium.type === "gold_silver" ? (
                      <>
                        <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">Podio Gold</p>
                        {bracketPodium.goldRank.slice(0, 3).map((item, idx) => (
                          <PodiumRow key={idx} pos={item.pos} label={item.label} team={item.team} />
                        ))}
                        {bracketPodium.silverRank.length > 0 && (
                          <p className="pt-2 text-[10px] font-black uppercase tracking-wider text-gray-500">
                            1° Silver: <span className="text-[#101d2c] font-bold">{bracketPodium.silverRank[0]?.team}</span>
                          </p>
                        )}
                      </>
                    ) : (
                      bracketPodium.rank.slice(0, 4).map((item, idx) => (
                        <PodiumRow key={idx} pos={item.pos} label={item.label} team={item.team} />
                      ))
                    )}
                  </div>
                ) : hasStandingsData && (activeGroupList.length > 0 || unifiedRankings.length > 0) ? (
                  /* 2. CLASSIFICA GIRONI ATTIVA */
                  <div className="overflow-hidden rounded-xl border border-[#101d2c]/10 bg-[#f5f4ef]/60">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#101d2c]/5 text-[10px] font-black uppercase tracking-wider text-[#657080]">
                        <tr>
                          <th className="py-2 pl-3 pr-1">#</th>
                          <th className="py-2 px-2">Squadra</th>
                          <th className="py-2 px-1 text-center">V-P</th>
                          <th className="py-2 pr-3 pl-1 text-right">Pt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#101d2c]/5">
                        {(activeGironeTab === "ALL" ? unifiedRankings : activeGroupList)
                          .slice(0, 5)
                          .map((team, idx) => (
                            <tr key={team.nome || idx} className="hover:bg-white/80 transition-colors">
                              <td className="py-2 pl-3 pr-1 font-black text-[#101d2c]">
                                <span
                                  className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] ${
                                    idx === 0
                                      ? "bg-[#f5ca3e] text-[#101d2c] font-black"
                                      : "bg-gray-200 text-gray-700 font-bold"
                                  }`}
                                >
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="py-2 px-2 font-bold text-[#101d2c] truncate max-w-[130px]" title={team.nome}>
                                {team.nome}
                              </td>
                              <td className="py-2 px-1 text-center font-medium text-[#657080]">
                                {team.vinte}-{team.perse}
                              </td>
                              <td className="py-2 pr-3 pl-1 text-right font-black text-[#101d2c]">
                                {team.score}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* 3. PLACEHOLDER QUANDO IL TORNEO NON HA ANCORA GARE DISPUTATE */
                  <div className="rounded-xl border border-dashed border-[#101d2c]/20 bg-[#f5f4ef] p-5 text-center">
                    <span className="text-3xl block mb-2">📊</span>
                    <p className="text-sm font-bold text-[#101d2c]">Classifica in arrivo</p>
                    <p className="mt-1 text-xs text-[#657080]">
                      I punteggi e i risultati verranno calcolati in tempo reale all’inizio delle partite.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Pulsante per aprire i dettagli completi della classifica */}
            <div className="mt-6 border-t border-[#101d2c]/10 pt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setIsClassificaModalOpen(true)}
                className="flex-1 cursor-pointer flex items-center justify-center gap-1.5 rounded-xl border border-[#101d2c]/15 bg-white px-3 py-3 text-xs font-black text-[#101d2c] hover:bg-[#f5f4ef] transition"
              >
                <span>Dettagli completi</span>
                <span className="text-[#f5ca3e]">↗</span>
              </button>
              <Link
                href={`/classifica?tour=${encodeURIComponent(tournament.nome)}`}
                className="cursor-pointer flex items-center justify-center rounded-xl bg-[#101d2c] px-3.5 py-3 text-xs font-black text-white hover:bg-[#263d57] transition"
                title="Apri pagina classifica dedicata"
              >
                Vai alla pagina ↗
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* ========================================================================= */}
      {/* POP-UP MODAL 1: TUTTE LE ISCRIZIONI (con ricerca in tempo reale)          */}
      {/* ========================================================================= */}
      {isIscrizioniModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#101d2c]/80 p-4 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsIscrizioniModalOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="flex items-center justify-between border-b border-gray-100 bg-[#101d2c] px-6 py-5 text-white">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#f5ca3e]">
                  Elenco Completo Partecipanti
                </p>
                <h3 className="mt-1 text-xl font-black">{tournament.nome}</h3>
                <p className="text-xs text-white/60">
                  {confirmedRegistrations.length} {participantLabel} confermati
                  {capacity > 0 && ` su un massimo di ${capacity}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsIscrizioniModalOpen(false)}
                className="cursor-pointer flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg font-bold text-white transition hover:bg-white/20"
                aria-label="Chiudi finestra"
              >
                ✕
              </button>
            </div>

            {/* Barra di ricerca in tempo reale */}
            <div className="border-b border-gray-100 bg-[#f5f4ef] px-6 py-4">
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                <input
                  type="text"
                  placeholder="Cerca per nome atleta o coppia..."
                  value={searchIscrizioni}
                  onChange={(e) => setSearchIscrizioni(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-10 text-sm font-semibold text-[#101d2c] placeholder:text-gray-400 focus:border-[#101d2c] focus:outline-none focus:ring-1 focus:ring-[#101d2c]"
                  autoFocus
                />
                {searchIscrizioni && (
                  <button
                    type="button"
                    onClick={() => setSearchIscrizioni("")}
                    className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between text-xs font-bold text-[#657080]">
                <span>Mostrati: {filteredRegistrations.length} di {confirmedRegistrations.length}</span>
                {capacity > 0 && <span>Capienza: {capacity}</span>}
              </div>
            </div>

            {/* Elenco completo scrollabile */}
            <div className="flex-1 overflow-y-auto p-6">
              {filteredRegistrations.length > 0 ? (
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {filteredRegistrations.map((registration, index) => (
                    <div
                      key={registration.id || index}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-[#f5f4ef]/60 p-3.5 transition hover:border-[#101d2c]/20 hover:bg-white hover:shadow-sm"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#101d2c] text-xs font-black text-[#f5ca3e]">
                          #{index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#101d2c]">
                            {registration.giocatori || "Partecipante"}
                          </p>
                          {registration.data && (
                            <p className="text-[10px] font-semibold text-[#657080]">
                              Iscritto: {registration.data}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-lg bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-800">
                        Confermato
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <span className="text-4xl block mb-2">🔍</span>
                  <p className="text-base font-bold text-[#101d2c]">Nessuna iscrizione trovata</p>
                  <p className="mt-1 text-xs text-[#657080]">
                    Nessun partecipante corrisponde alla ricerca &quot;{searchIscrizioni}&quot;
                  </p>
                </div>
              )}
            </div>

            {/* Footer del Modal */}
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-6 py-4">
              <span className="text-xs font-semibold text-[#657080]">
                🔒 Privacy protetta · Dati sensibili oscurati
              </span>
              <button
                type="button"
                onClick={() => setIsIscrizioniModalOpen(false)}
                className="cursor-pointer rounded-xl bg-[#101d2c] px-5 py-2.5 text-xs font-black text-white hover:bg-[#263d57] transition"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POP-UP MODAL 2: CLASSIFICA COMPLETA E DETTAGLIATA                         */}
      {/* ========================================================================= */}
      {isClassificaModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#101d2c]/80 p-4 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsClassificaModalOpen(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="flex items-center justify-between border-b border-gray-100 bg-[#101d2c] px-6 py-5 text-white">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.25em] text-[#f5ca3e]">
                  Classifica &amp; Risultati Completi
                </p>
                <h3 className="mt-1 text-xl font-black">{tournament.nome}</h3>
                <p className="text-xs text-white/60">
                  {isFinished ? "Torneo concluso" : hasGironiMatches ? "Gare in corso" : "In attesa di avvio"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsClassificaModalOpen(false)}
                className="cursor-pointer flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg font-bold text-white transition hover:bg-white/20"
                aria-label="Chiudi finestra"
              >
                ✕
              </button>
            </div>

            {/* Tab switchers if multiple groups exist */}
            <div className="border-b border-gray-100 bg-[#f5f4ef] px-6 py-3 flex flex-wrap items-center gap-2">
              {bracketPodium && (
                <button
                  type="button"
                  onClick={() => setActiveGironeTab("PODIUM")}
                  className={`cursor-pointer rounded-xl px-4 py-2 text-xs font-black transition ${
                    activeGironeTab === "PODIUM"
                      ? "bg-[#101d2c] text-white shadow"
                      : "bg-white text-[#657080] hover:text-[#101d2c]"
                  }`}
                >
                  🏆 Podio Finale
                </button>
              )}
              {gironiDisponibili.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setActiveGironeTab(g)}
                  className={`cursor-pointer rounded-xl px-4 py-2 text-xs font-black transition ${
                    activeGironeTab === g
                      ? "bg-[#101d2c] text-white shadow"
                      : "bg-white text-[#657080] hover:text-[#101d2c]"
                  }`}
                >
                  Girone {g}
                </button>
              ))}
              {unifiedRankings.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveGironeTab("ALL")}
                  className={`cursor-pointer rounded-xl px-4 py-2 text-xs font-black transition ${
                    activeGironeTab === "ALL"
                      ? "bg-[#101d2c] text-white shadow"
                      : "bg-white text-[#657080] hover:text-[#101d2c]"
                  }`}
                >
                  📊 Generale Unificata
                </button>
              )}
            </div>

            {/* Contenuto modale classifica */}
            <div className="flex-1 overflow-y-auto p-6">
              {activeGironeTab === "PODIUM" && bracketPodium ? (
                <div className="space-y-6">
                  {bracketPodium.type === "gold_silver" ? (
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div className="rounded-2xl border-2 border-yellow-400/40 bg-amber-50/30 p-5">
                        <h4 className="text-base font-black uppercase text-amber-900 mb-4 flex items-center gap-2">
                          🏆 Classifica Finale GOLD
                        </h4>
                        <div className="space-y-2.5">
                          {bracketPodium.goldRank.map((item, idx) => (
                            <PodiumRow key={idx} pos={item.pos} label={item.label} team={item.team} />
                          ))}
                        </div>
                      </div>
                      <div className="rounded-2xl border-2 border-gray-300 bg-gray-50/50 p-5">
                        <h4 className="text-base font-black uppercase text-gray-800 mb-4 flex items-center gap-2">
                          🥈 Classifica Finale SILVER
                        </h4>
                        <div className="space-y-2.5">
                          {bracketPodium.silverRank.map((item, idx) => (
                            <PodiumRow key={idx} pos={item.pos} label={item.label} team={item.team} />
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-md mx-auto rounded-2xl border border-gray-200 bg-gray-50/50 p-6">
                      <h4 className="text-lg font-black uppercase text-center text-[#101d2c] mb-6 flex items-center justify-center gap-2">
                        🏆 Podio Ufficiale
                      </h4>
                      <div className="space-y-3">
                        {bracketPodium.rank.map((item, idx) => (
                          <PodiumRow key={idx} pos={item.pos} label={item.label} team={item.team} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Tabella dettagliata per girone o classifica unificata */
                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#101d2c] text-white">
                      <tr>
                        <th className="py-3 px-3 text-center">Pos</th>
                        <th className="py-3 px-4">Squadra / Atleti</th>
                        <th className="py-3 px-3 text-center">G</th>
                        <th className="py-3 px-3 text-center">V</th>
                        <th className="py-3 px-3 text-center">P</th>
                        <th className="py-3 px-3 text-center">PF</th>
                        <th className="py-3 px-3 text-center">PS</th>
                        <th className="py-3 px-3 text-center">Diff</th>
                        <th className="py-3 px-4 text-right">Punti</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {(activeGironeTab === "ALL" ? unifiedRankings : (groupStats[activeGironeTab] || [])).length > 0 ? (
                        (activeGironeTab === "ALL" ? unifiedRankings : (groupStats[activeGironeTab] || [])).map(
                          (team, idx) => {
                            const diff = (team.puntiFatti || 0) - (team.puntiSubiti || 0);
                            return (
                              <tr key={team.nome || idx} className="hover:bg-gray-50/80 transition-colors">
                                <td className="py-3 px-3 text-center font-black">
                                  <span
                                    className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs ${
                                      idx === 0
                                        ? "bg-[#f5ca3e] text-[#101d2c] font-black"
                                        : idx === 1
                                        ? "bg-gray-300 text-gray-800 font-bold"
                                        : idx === 2
                                        ? "bg-amber-600 text-white font-bold"
                                        : "bg-gray-100 text-gray-600"
                                    }`}
                                  >
                                    {idx + 1}
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-black text-sm text-[#101d2c]">
                                  {team.nome}
                                </td>
                                <td className="py-3 px-3 text-center font-bold text-gray-600">{team.giocate}</td>
                                <td className="py-3 px-3 text-center font-black text-emerald-700">{team.vinte}</td>
                                <td className="py-3 px-3 text-center font-bold text-red-600">{team.perse}</td>
                                <td className="py-3 px-3 text-center font-semibold text-gray-600">{team.puntiFatti}</td>
                                <td className="py-3 px-3 text-center font-semibold text-gray-600">{team.puntiSubiti}</td>
                                <td
                                  className={`py-3 px-3 text-center font-bold ${
                                    diff > 0 ? "text-emerald-600" : diff < 0 ? "text-red-500" : "text-gray-500"
                                  }`}
                                >
                                  {diff > 0 ? `+${diff}` : diff}
                                </td>
                                <td className="py-3 px-4 text-right font-black text-base text-[#101d2c]">
                                  {team.score}
                                </td>
                              </tr>
                            );
                          }
                        )
                      ) : (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-sm font-semibold text-gray-400">
                            Nessun dato registrato per questo girone
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer modale classifica */}
            <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-6 py-4">
              <span className="text-xs font-semibold text-[#657080]">
                Criteri: Vittorie &gt; Quoziente Punti &gt; Differenza Punti
              </span>
              <button
                type="button"
                onClick={() => setIsClassificaModalOpen(false)}
                className="cursor-pointer rounded-xl bg-[#101d2c] px-5 py-2.5 text-xs font-black text-white hover:bg-[#263d57] transition"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="min-w-0 bg-white p-4">
      <dt className="text-[9px] font-black uppercase tracking-wider text-[#657080]">{label}</dt>
      <dd className="mt-1 truncate text-xs font-black text-[#101d2c]">{value}</dd>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-xs text-white/55">{label}</dt>
      <dd className="text-right text-xs font-bold text-white">{value}</dd>
    </div>
  );
}

function PodiumRow({ pos, label, team }) {
  const isGold = pos === "1°";
  const isSilver = pos === "2°";
  const isBronze = pos === "3°";

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white p-3 border border-gray-100 shadow-xs">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black ${
            isGold
              ? "bg-[#f5ca3e] text-[#101d2c] shadow-xs"
              : isSilver
              ? "bg-gray-300 text-gray-800"
              : isBronze
              ? "bg-amber-600 text-white"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {pos}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-[#101d2c]">{team || "In fase di definizione"}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#657080]">{label}</p>
        </div>
      </div>
    </div>
  );
}
