"use client";

import { useState, useEffect, useMemo, useRef, useImperativeHandle } from "react";
import { readWorkflowConfig, saveWorkflowConfig } from "@/app/utils/tournament-workflow";
import StaffHeader from "@/app/components/StaffHeader";
import TournamentSetupHeader from "@/app/components/TournamentSetupHeader";
import GialloTournament from "@/app/components/GialloTournament";
import { isGiallo } from "@/app/utils/giallo";
import { getTornei, getIscrizioni, syncAssignmentsWithIscrizioni } from "@/app/utils/db";
import { getSchedule as getScheduleShared } from "@/app/utils/ranking";
import MatchScoreEntry from "@/app/components/tournament/MatchScoreEntry";
import { applyTeamGroupScore, applyTeamMatchDetails, teamGroupMatches } from "@/app/utils/match-scoring";

const capitalizeWord = (word) => {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
};

const capitalizeName = (nameStr) => {
  if (!nameStr) return "";
  return nameStr.split(/\s+/).map(capitalizeWord).join(" ");
};

const splitNames = (name) => {
  if (!name) return [""];
  let parts = [];
  if (name.includes(" & ")) {
    parts = name.split(" & ");
  } else if (name.includes(" / ")) {
    parts = name.split(" / ");
  } else if (name.includes(" - ")) {
    parts = name.split(" - ");
  } else if (name.includes("/")) {
    parts = name.split("/");
  } else {
    parts = [name];
  }
  return parts.map((p) => p.trim());
};

const formatPlayerName = (fullName) => {
  if (!fullName) return "";
  return fullName.trim();
};

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function TeamGroups({ tournament = null, embedded = false, active = true, saveRef, onSummary }) {
  const [numGironi, setNumGironi] = useState(4);
  const [teamCounts, setTeamCounts] = useState({ A: 4, B: 4, C: 4, D: 4, E: 4, F: 4, G: 4, H: 4 });
  
  const [torneiAttivi, setTorneiAttivi] = useState(tournament ? [tournament] : []);
  const [selectedTorneo, setSelectedTorneo] = useState(tournament?.nome || "");
  const [tutteLeIscrizioni, setTutteLeIscrizioni] = useState([]);
  const [gironeAssignments, setGironeAssignments] = useState({});
  const [gironeTypes, setGironeTypes] = useState({ A: "Pool", B: "Pool", C: "Pool", D: "Pool", E: "Pool", F: "Pool", G: "Pool", H: "Pool" });
  const [gironeSets, setGironeSets] = useState({ A: "1 set", B: "1 set", C: "1 set", D: "1 set", E: "1 set", F: "1 set", G: "1 set", H: "1 set" });
  const [matchMetadata, setMatchMetadata] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [pubblicato, setPubblicato] = useState(false);
  const [rankingType, setRankingType] = useState("avulsa"); // "avulsa" o "gironi"
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragOverSlot, setDragOverSlot] = useState(null);
  
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const selectedGiallo = torneiAttivi.find((t) => t.nome === selectedTorneo && isGiallo(t));
  const [saveError, setSaveError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [entryMode, setEntryMode] = useState("setup");
  const [scoreDrafts, setScoreDrafts] = useState(0);
  const savedFingerprint = useRef("");
  const pendingTimer = useRef(null);
  const currentConfig = useMemo(() => ({ numGironi, teamCounts, gironeTypes, gironeSets,
    gironeAssignments, matchMetadata, pubblicato, rankingType }),
  [numGironi, teamCounts, gironeTypes, gironeSets, gironeAssignments, matchMetadata, pubblicato, rankingType]);
  const persist = async (force = false) => {
    if (scoreDrafts) throw new Error("Ci sono modifiche alle partite non salvate. Salva punteggi e gestione partita oppure annulla le modifiche prima di cambiare sezione.");
    if (!isLoaded) throw new Error("Attendi il caricamento dei gironi.");
    if (!force && savedFingerprint.current === "null" && !Object.keys(gironeAssignments).length && !pubblicato) return;
    if (savedFingerprint.current === JSON.stringify(currentConfig)) return;
    await saveWorkflowConfig("gironi", selectedTorneo.toLowerCase().trim().replace(/\s+/g, "_"), currentConfig);
    savedFingerprint.current = JSON.stringify(currentConfig);
    setSaveError("");
    onSummary?.({ groupsPublished: pubblicato, groupCount: numGironi });
  };
  useImperativeHandle(saveRef, () => ({ flush: persist }));
  const changeVisibility = async () => {
    if (publishing || !isLoaded || scoreDrafts) return;
    clearTimeout(pendingTimer.current);
    const next = { ...currentConfig, pubblicato: !pubblicato };
    setPublishing(true); setSaveError(""); onSummary?.({ busy: true });
    try {
      await saveWorkflowConfig("gironi", selectedTorneo.toLowerCase().trim().replace(/\s+/g, "_"), next);
      savedFingerprint.current = JSON.stringify(next); setPubblicato(next.pubblicato);
      onSummary?.({ groupsPublished: next.pubblicato });
    } catch (error) { setSaveError(error.message); }
    finally { setPublishing(false); onSummary?.({ busy: false }); }
  };
  const scoringGroups = useMemo(() => teamGroupMatches(currentConfig), [currentConfig]);
  const recordGroupScore = async (game, score, details) => {
    const outcome = applyTeamGroupScore(currentConfig, game.id, score);
    if (details) outcome.config = applyTeamMatchDetails(outcome.config, game.id, details);
    if (outcome.cleared.length && !window.confirm("La correzione cambia le coppie degli incontri successivi della pool. I loro risultati saranno azzerati, mantenendo campo e orario. Continuare?")) return false;
    clearTimeout(pendingTimer.current);
    onSummary?.({ busy: true });
    try {
      await saveWorkflowConfig("gironi", selectedTorneo.toLowerCase().trim().replace(/\s+/g, "_"), outcome.config);
      savedFingerprint.current = JSON.stringify(outcome.config);
      setMatchMetadata(outcome.config.matchMetadata); setSaveError("");
      onSummary?.({ groupsPublished: outcome.config.pubblicato });
      return true;
    } catch (error) { setSaveError(error.message); throw error; }
    finally { onSummary?.({ busy: false }); }
  };

  const recordMatchDetails = async (game, details) => {
    const next = applyTeamMatchDetails(currentConfig, game.id, details);
    clearTimeout(pendingTimer.current); onSummary?.({ busy: true });
    try {
      await saveWorkflowConfig("gironi", selectedTorneo.toLowerCase().trim().replace(/\s+/g, "_"), next);
      savedFingerprint.current = JSON.stringify(next); setMatchMetadata(next.matchMetadata); setSaveError("");
      return true;
    } catch (error) { setSaveError(error.message); throw error; }
    finally { onSummary?.({ busy: false }); }
  };

  const handleSlotClick = (gironeId, idx, playerInSlot) => {
    const hasPlayer = playerInSlot !== "—";
    
    if (selectedAthlete) {
      // Assign selected athlete from sidebar to this slot
      handleAssignmentChange(gironeId, idx, selectedAthlete);
      setSelectedAthlete(null);
    } else if (selectedSlot) {
      if (selectedSlot.gironeId === gironeId && selectedSlot.slotIdx === idx) {
        // Deselect if clicking the same slot
        setSelectedSlot(null);
      } else {
        // Swap or move
        const athlete1 = selectedSlot.name;
        const athlete2 = playerInSlot;
        handleAssignmentChange(selectedSlot.gironeId, selectedSlot.slotIdx, athlete2);
        handleAssignmentChange(gironeId, idx, athlete1);
        setSelectedSlot(null);
      }
    } else {
      // Select slot for moving/swapping
      if (hasPlayer) {
        setSelectedSlot({ gironeId, slotIdx: idx, name: playerInSlot });
        setSelectedAthlete(null);
      }
    }
  };

  const handleSidebarClick = () => {
    if (selectedSlot) {
      // If a slot was selected for moving, tapping the sidebar clears it
      handleAssignmentChange(selectedSlot.gironeId, selectedSlot.slotIdx, "—");
      setSelectedSlot(null);
    }
  };

  useEffect(() => {
    if (embedded) return;
    getTornei().then(parsedTornei => {
      const attivi = parsedTornei.filter(t => !isGiallo(t) && ["Iscrizioni Aperte", "In Programmazione", "Concluso"].includes(t.stato));
      setTorneiAttivi(attivi);
      
      const params = new URLSearchParams(window.location.search);
      const urlTour = params.get('tour');
      if (parsedTornei.some((t) => t.nome === urlTour && isGiallo(t))) {
        window.location.replace(`/staff/giallo?tour=${encodeURIComponent(urlTour)}`);
        return;
      }
      
      if (urlTour && attivi.some(t => t.nome === urlTour)) {
        setSelectedTorneo(urlTour);
      } else if (attivi.length > 0) {
        setSelectedTorneo(attivi[0].nome);
      }
    });

    getIscrizioni().then(data => {
      setTutteLeIscrizioni(data);
    });
  }, [embedded]);

  const getConfigKey = (nomeTorneo) => {
    if (!nomeTorneo) return "";
    return `bvi_gironi_v2_${nomeTorneo.toLowerCase().trim().replace(/\s+/g, '_')}`;
  };

  useEffect(() => {
    if (!selectedTorneo) return;
    let cancelled = false;
    setIsLoaded(false);
    
    const slug = selectedTorneo.toLowerCase().trim().replace(/\s+/g, '_');
    Promise.all([readWorkflowConfig("gironi", slug), getIscrizioni()]).then(([config, iscrizioniList]) => {
      if (cancelled) return;
      savedFingerprint.current = JSON.stringify(config);
      onSummary?.({ groupsPublished: Boolean(config?.pubblicato), groupCount: config?.numGironi || 0 });
      if (iscrizioniList) setTutteLeIscrizioni(iscrizioniList);
      if (config) {
        setEntryMode(Object.values(config.gironeAssignments || {}).some((slots) => Object.values(slots).some((name) => name && name !== "—" && name !== "Slot Libero")) ? "results" : "setup");
        setNumGironi(config.numGironi || 4);
        setTeamCounts(config.teamCounts || { A: 4, B: 4, C: 4, D: 4, E: 4, F: 4, G: 4, H: 4 });
        setGironeTypes(config.gironeTypes || { A: "Pool", B: "Pool", C: "Pool", D: "Pool", E: "Pool", F: "Pool", G: "Pool", H: "Pool" });
        setGironeSets(config.gironeSets || { A: "1 set", B: "1 set", C: "1 set", D: "1 set", E: "1 set", F: "1 set", G: "1 set", H: "1 set" });

        const syncedAssignments = syncAssignmentsWithIscrizioni(config.gironeAssignments || {}, iscrizioniList || []);
        setGironeAssignments(syncedAssignments);

        setMatchMetadata(config.matchMetadata || {});
        setPubblicato(config.pubblicato || false);
        setRankingType(config.rankingType || "avulsa");
      } else {
        setNumGironi(4);
        setTeamCounts({ A: 4, B: 4, C: 4, D: 4, E: 4, F: 4, G: 4, H: 4 });
        setGironeTypes({ A: "Pool", B: "Pool", C: "Pool", D: "Pool", E: "Pool", F: "Pool", G: "Pool", H: "Pool" });
        setGironeSets({ A: "1 set", B: "1 set", C: "1 set", D: "1 set", E: "1 set", F: "1 set", G: "1 set", H: "1 set" });
        setGironeAssignments({});
        setMatchMetadata({});
        setPubblicato(false);
        setRankingType("avulsa");
      }
      setIsLoaded(true);
    }).catch((error) => { if (!cancelled) setSaveError(error.message); });
    return () => { cancelled = true; };
  }, [selectedTorneo, onSummary]);

  // Auto-save whenever configurations change (after they have been fully loaded)
  useEffect(() => {
    if (!selectedTorneo || !isLoaded || selectedGiallo || !active || publishing) return;
    if (savedFingerprint.current === JSON.stringify(currentConfig)) return;
    // Visiting a tournament must not create an empty configuration by itself.
    if (savedFingerprint.current === "null" && !Object.keys(gironeAssignments).length) return;
    const config = {
      numGironi,
      teamCounts,
      gironeTypes,
      gironeSets,
      gironeAssignments,
      matchMetadata,
      pubblicato,
      rankingType
    };
    
    // Cache is updated by saveWorkflowConfig only after a confirmed server save.
    const handler = setTimeout(() => {
      const slug = selectedTorneo.toLowerCase().trim().replace(/\s+/g, '_');
      saveWorkflowConfig("gironi", slug, config).then(() => {
        savedFingerprint.current = JSON.stringify(config); setSaveError("");
        onSummary?.({ groupsPublished: config.pubblicato, groupCount: config.numGironi });
      }).catch((error) => setSaveError(error.message));
    }, 1000);

    pendingTimer.current = handler;
    return () => clearTimeout(handler);
  }, [numGironi, teamCounts, gironeTypes, gironeSets, gironeAssignments, matchMetadata, pubblicato, rankingType, selectedTorneo, isLoaded, selectedGiallo, active, currentConfig, onSummary, publishing]);

  const giocatoriFiltrati = tutteLeIscrizioni.filter(isc => {
    const tName = (isc.torneo || "").toLowerCase().trim();
    const sName = (selectedTorneo || "").toLowerCase().trim();
    const st = (isc.stato || "").toLowerCase().trim();
    const isApp = !st || st.startsWith("approvat") || st === "ok" || st === "confermato" || st === "confermata";
    return tName === sName && isApp;
  });

  const handleAssignmentChange = (gironeId, slotIdx, playerName) => {
    setGironeAssignments(prev => ({
      ...prev,
      [gironeId]: {
        ...(prev[gironeId] || {}),
        [slotIdx]: playerName
      }
    }));
  };

  const handleDragStart = (e, playerName, sourceGirone = null, sourceSlot = null) => {
    e.dataTransfer.setData("text/plain", playerName);
    if (sourceGirone !== null && sourceSlot !== null) {
      e.dataTransfer.setData("sourceGirone", sourceGirone);
      e.dataTransfer.setData("sourceSlot", sourceSlot.toString());
    }
    setIsDragging(true);
  };

  const handleDrop = (e, targetGironeId, targetSlotIdx) => {
    e.preventDefault();
    const playerName = e.dataTransfer.getData("text/plain");
    const sourceGirone = e.dataTransfer.getData("sourceGirone");
    const sourceSlot = e.dataTransfer.getData("sourceSlot");

    if (playerName) {
      if (sourceGirone && sourceSlot) {
        const srcIdx = parseInt(sourceSlot, 10);
        handleAssignmentChange(sourceGirone, srcIdx, "—");
      }
      handleAssignmentChange(targetGironeId, targetSlotIdx, playerName);
    }
    setDragOverSlot(null);
    setIsDragging(false);
  };

  const handleSidebarDrop = (e) => {
    e.preventDefault();
    const sourceGirone = e.dataTransfer.getData("sourceGirone");
    const sourceSlot = e.dataTransfer.getData("sourceSlot");
    if (sourceGirone && sourceSlot) {
      const srcIdx = parseInt(sourceSlot, 10);
      handleAssignmentChange(sourceGirone, srcIdx, "—");
    }
    setIsDragging(false);
  };

  const handleTypeChange = (gironeId, type) => {
    setGironeTypes(prev => ({ ...prev, [gironeId]: type }));
  };

  const handleSetsChange = (gironeId, sets) => {
    setGironeSets(prev => ({ ...prev, [gironeId]: sets }));
  };

  const handleSave = async () => {
    if (!selectedTorneo) return;
    try {
      await persist(true);
      alert(`Gironi salvati per "${selectedTorneo}".`);
    } catch (error) { setSaveError(error.message); }
  };

  const handleSyncNamesFromIscrizioni = () => {
    if (!selectedTorneo || !tutteLeIscrizioni.length) return;
    const approved = tutteLeIscrizioni.filter(i => 
      (i.torneo || "").toLowerCase().trim() === selectedTorneo.toLowerCase().trim() && 
      i.stato === "Approvata"
    );

    let updatedCount = 0;
    const newAssignments = JSON.parse(JSON.stringify(gironeAssignments));

    Object.keys(newAssignments).forEach(gId => {
      const slotsMap = newAssignments[gId] || {};
      Object.keys(slotsMap).forEach(slotIdx => {
        const currentName = slotsMap[slotIdx];
        if (!currentName || currentName === "—" || currentName === "Slot Libero") return;

        const cleanCur = currentName.toLowerCase().trim();
        const words = cleanCur.split(/[^a-z0-9]+/).filter(w => w.length > 2);

        const match = approved.find(i => {
          const gLower = (i.giocatori || "").toLowerCase().trim();
          if (gLower === cleanCur) return true;
          return words.length > 0 && words.every(w => gLower.includes(w));
        });

        if (match && match.giocatori !== currentName) {
          slotsMap[slotIdx] = match.giocatori;
          updatedCount++;
        }
      });
    });

    if (updatedCount > 0) {
      setGironeAssignments(newAssignments);
      alert(`Sincronizzati ${updatedCount} nomi squadra dalle iscrizioni! 🔄 Ricordati di fare clic su SALVA TUTTO.`);
    } else {
      alert("Tutti i nomi squadra nei gironi sono già aggiornati con le iscrizioni! 👍");
    }
  };

  const handleRandomizeGironi = () => {
    if (giocatoriFiltrati.length === 0) {
      alert("Nessun iscritto approvato per questo torneo!");
      return;
    }
    if (!window.confirm("Sei sicuro di voler mescolare e riassegnare casualmente tutti gli iscritti nei gironi? La configurazione attuale verrà sovrascritta.")) return;
    
    // 1. Get and shuffle teams
    const shuffledTeams = shuffle(giocatoriFiltrati.map(gf => gf.giocatori));
    
    // 2. Build new assignments
    const newAssignments = { ...gironeAssignments };
    let teamIdx = 0;
    
    // Loop through all active gironi
    const activeGironiIds = allGironi.slice(0, numGironi).map(g => g.id);
    activeGironiIds.forEach(gid => {
      const count = teamCounts[gid] || 0;
      newAssignments[gid] = {};
      for (let idx = 0; idx < count; idx++) {
        if (teamIdx < shuffledTeams.length) {
          newAssignments[gid][idx] = shuffledTeams[teamIdx];
          teamIdx++;
        } else {
          newAssignments[gid][idx] = "—";
        }
      }
    });
    
    setGironeAssignments(newAssignments);
    alert("Sorteggio completato. Controlla le squadre e usa Salva gironi per confermare il salvataggio.");
  };

  const handleDeleteGironi = async () => {
    if (!selectedTorneo) return;
    if (!window.confirm("Sei sicuro di voler eliminare completamente i gironi di questo torneo? Tutti i dati e i risultati inseriti andranno persi.")) return;
    
    const slug = selectedTorneo.toLowerCase().trim().replace(/\s+/g, '_');
    clearTimeout(pendingTimer.current);
    try { await saveWorkflowConfig("gironi", slug, null); }
    catch (error) { setSaveError(error.message); return; }
    savedFingerprint.current = "null";
    onSummary?.({ groupsPublished: false, groupCount: 0 });
    setNumGironi(4);
    setTeamCounts({ A: 4, B: 4, C: 4, D: 4, E: 4, F: 4, G: 4, H: 4 });
    setGironeTypes({ A: "Pool", B: "Pool", C: "Pool", D: "Pool", E: "Pool", F: "Pool", G: "Pool", H: "Pool" });
    setGironeSets({ A: "1 set", B: "1 set", C: "1 set", D: "1 set", E: "1 set", F: "1 set", G: "1 set", H: "1 set" });
    setGironeAssignments({});
    setMatchMetadata({});
    setPubblicato(false);
    setRankingType("avulsa");
    
    localStorage.removeItem(getConfigKey(selectedTorneo));
    
    alert("Gironi eliminati con successo! 🗑️");
  };

  const handleFillTestScores = () => {
    if (!selectedTorneo) return;
    if (!window.confirm("Vuoi caricare punteggi di test casuali per tutte le partite di tutti i gironi?")) return;

    const newMetadata = { ...matchMetadata };

    allGironi.slice(0, numGironi).forEach((g) => {
      const currentAssignments = {};
      const count = teamCounts[g.id] || 0;
      for (let i = 0; i < count; i++) {
        currentAssignments[i] = gironeAssignments[g.id]?.[i] || "—";
      }
      const schedule = getSchedule(count, g.id, currentAssignments);
      const isThreeSets = gironeSets[g.id] === "3 set";

      schedule.forEach((match, idx) => {
        const matchKey = `${g.id}-${idx}`;
        if (
          !match.left || 
          match.left === "—" || 
          match.left.startsWith("Slot") || 
          match.left.startsWith("Vincente") || 
          match.left.startsWith("Perdente") ||
          !match.right || 
          match.right === "—" || 
          match.right.startsWith("Slot") || 
          match.right.startsWith("Vincente") || 
          match.right.startsWith("Perdente")
        ) {
          return;
        }

        // Assicurati che court e time siano impostati se vuoti
        if (!newMetadata[matchKey]?.court) {
          newMetadata[matchKey] = {
            ...(newMetadata[matchKey] || {}),
            court: (Math.floor(Math.random() * 4) + 1).toString(),
            time: `1${Math.floor(Math.random() * 3)}:00`
          };
        }

        if (isThreeSets) {
          const s1L = Math.random() > 0.5 ? 21 : Math.floor(Math.random() * 5) + 15;
          const s1R = s1L === 21 ? Math.floor(Math.random() * 5) + 15 : 21;
          
          const s2L = s1L === 21 ? Math.floor(Math.random() * 5) + 15 : 21;
          const s2R = s2L === 21 ? Math.floor(Math.random() * 5) + 15 : 21;
          
          let s3L = "";
          let s3R = "";
          if ((s1L > s1R && s2L < s2R) || (s1L < s1R && s2L > s2R)) {
            s3L = Math.random() > 0.5 ? 15 : Math.floor(Math.random() * 4) + 10;
            s3R = s3L === 15 ? Math.floor(Math.random() * 4) + 10 : 15;
          }

          newMetadata[matchKey] = {
            ...newMetadata[matchKey],
            s1L: s1L.toString(),
            s1R: s1R.toString(),
            s2L: s2L.toString(),
            s2R: s2R.toString(),
            s3L: s3L.toString(),
            s3R: s3R.toString()
          };
        } else {
          const s1L = Math.random() > 0.5 ? 21 : Math.floor(Math.random() * 6) + 12;
          const s1R = s1L === 21 ? Math.floor(Math.random() * 6) + 12 : 21;

          newMetadata[matchKey] = {
            ...newMetadata[matchKey],
            s1L: s1L.toString(),
            s1R: s1R.toString()
          };
        }
      });
    });

    setMatchMetadata(newMetadata);
    alert("Punteggi di test inseriti! Non dimenticare di salvare la configurazione.");
  };

  const handleClearScores = async () => {
    if (!selectedTorneo) return;
    if (!window.confirm("Sei sicuro di voler eliminare TUTTI i punteggi inseriti nei gironi? Le squadre e la composizione rimarranno invariate.")) return;

    // Rimuoviamo solo i campi punteggio da ogni voce di metadata,
    // mantenendo campo campo campo court e time se presenti
    const clearedMetadata = {};
    Object.keys(matchMetadata).forEach(key => {
      const existing = matchMetadata[key] || {};
      const cleaned = {};
      if (existing.court) cleaned.court = existing.court;
      if (existing.time) cleaned.time = existing.time;
      if (Object.keys(cleaned).length > 0) clearedMetadata[key] = cleaned;
    });

    setMatchMetadata(clearedMetadata);
    const slug = selectedTorneo.toLowerCase().trim().replace(/\s+/g, '_');
    const config = {
      numGironi,
      teamCounts,
      gironeTypes,
      gironeSets,
      gironeAssignments,
      matchMetadata: clearedMetadata,
      pubblicato,
      rankingType
    };
    try {
      await saveWorkflowConfig("gironi", slug, config);
      savedFingerprint.current = JSON.stringify(config);
      alert("Punteggi eliminati e salvati.");
    } catch (error) { setSaveError(error.message); }
  };

  const allGironi = [
    { id: 'A', colorClass: 'blue' },
    { id: 'B', colorClass: 'red' },
    { id: 'C', colorClass: 'yellow' },
    { id: 'D', colorClass: 'purple' },
    { id: 'E', colorClass: 'green' },
    { id: 'F', colorClass: 'orange' },
    { id: 'G', colorClass: 'pink' },
    { id: 'H', colorClass: 'cyan' },
  ];
  
  const gironi = allGironi.slice(0, numGironi);

  const handleTeamCountChange = (gironeId, value) => {
    const val = parseInt(value, 10);
    if (value === "") {
      setTeamCounts(prev => ({ ...prev, [gironeId]: "" }));
    } else if (!isNaN(val) && val > 0 && val <= 10) {
      setTeamCounts(prev => ({ ...prev, [gironeId]: val }));
    }
  };

  const getSchedule = (numTeams, gironeId, assignments = {}) => {
    return getScheduleShared(numTeams, gironeId, assignments, gironeTypes, gironeSets, matchMetadata);
  };

  const getColors = (color) => {
    switch (color) {
      case 'blue': return { main: 'bg-blue-600', border: 'border-blue-600', light: 'bg-blue-50', inputBg: 'bg-blue-800/50' };
      case 'red': return { main: 'bg-red-500', border: 'border-red-500', light: 'bg-red-50', inputBg: 'bg-red-700/50' };
      case 'yellow': return { main: 'bg-yellow-500', border: 'border-yellow-500', light: 'bg-yellow-50', inputBg: 'bg-yellow-600/50' };
      case 'purple': return { main: 'bg-purple-600', border: 'border-purple-600', light: 'bg-purple-50', inputBg: 'bg-purple-800/50' };
      case 'green': return { main: 'bg-green-600', border: 'border-green-600', light: 'bg-green-50', inputBg: 'bg-green-800/50' };
      case 'orange': return { main: 'bg-orange-500', border: 'border-orange-500', light: 'bg-orange-50', inputBg: 'bg-orange-700/50' };
      case 'pink': return { main: 'bg-pink-500', border: 'border-pink-500', light: 'bg-pink-50', inputBg: 'bg-pink-700/50' };
      case 'cyan': return { main: 'bg-cyan-600', border: 'border-cyan-600', light: 'bg-cyan-50', inputBg: 'bg-cyan-800/50' };
      default: return { main: 'bg-gray-600', border: 'border-gray-600', light: 'bg-gray-50', inputBg: 'bg-gray-800/50' };
    }
  };

  if (selectedGiallo) return <main className="min-h-screen bg-[#f8faff] pb-20"><StaffHeader />
    <GialloTournament tournament={selectedGiallo} editable tournaments={torneiAttivi} onSelect={setSelectedTorneo} />
  </main>;

  const Container = embedded ? "div" : "main";
  return (
    <Container className={embedded ? "text-[#0a1628]" : "min-h-screen bg-[#f8faff] pb-20"}>
      {!embedded && <StaffHeader />}

      <div className="max-w-[1400px] mx-auto px-4 mt-6 md:mt-10" inert={publishing || undefined} aria-busy={publishing}>
        {!embedded && <TournamentSetupHeader tournaments={torneiAttivi} selected={selectedTorneo} onSelect={setSelectedTorneo} />}
        {saveError && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-800">{saveError}</p>}
        <p role="status" className="mb-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{tournament?.stato === "Concluso" ? "Torneo concluso. " : ""}Gironi {pubblicato ? "visibili" : "nascosti"} al pubblico. La visibilità della fase finale si sceglie separatamente nella sezione Fase finale.</p>
        <nav aria-label="Modalità gestione gironi" className="mb-6 flex flex-wrap gap-2">
          {[{ id: "setup", label: "Composizione gironi" }, { id: "results", label: "Segna risultati e gestisci partite" }].map((mode) => <button key={mode.id} type="button" aria-pressed={entryMode === mode.id} onClick={() => {
            if (scoreDrafts && mode.id === "setup") { setSaveError("Salva o scarta le modifiche a punteggi e gestione partita prima di cambiare composizione."); return; }
            setEntryMode(mode.id); setSaveError("");
          }} className={`rounded-xl border px-4 py-3 text-sm font-bold ${entryMode === mode.id ? "border-[#0a1628] bg-[#0a1628] text-white" : "border-slate-200 bg-white"}`}>{mode.label}</button>)}
        </nav>
        <section hidden={entryMode !== "results"}>
          {isLoaded ? <MatchScoreEntry groups={scoringGroups} onSave={recordGroupScore} onSaveDetails={recordMatchDetails} onClear={(game) => recordGroupScore(game, null)} onDirtyChange={setScoreDrafts} /> : <p role="status">Caricamento partite…</p>}
        </section>
        <div hidden={entryMode !== "setup"} className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 text-[#0a1628]">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div><h2 className="text-xl font-bold">Composizione e risultati dei gironi</h2><p className="mt-1 text-sm leading-6 text-slate-500">Imposta il numero di gironi, scegli il formato e distribuisci le squadre approvate.</p></div>
            <div className="flex flex-wrap gap-2">
              <button onClick={handleRandomizeGironi} disabled={!selectedTorneo || !isLoaded} className="rounded-xl bg-[#FFD700] px-5 py-3 text-sm font-bold disabled:opacity-40">Sorteggia squadre</button>
              <button onClick={handleSave} disabled={!selectedTorneo || !isLoaded} className="rounded-xl bg-[#0a1628] px-5 py-3 text-sm font-bold text-white disabled:opacity-40">Salva gironi</button>
            </div>
          </div>
          <p className="mt-4 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-500">Le squadre si possono anche assegnare manualmente. Controlla composizione e formato prima di rendere i gironi visibili al pubblico.</p>
          <details className="mt-4 border-t border-slate-100 pt-3"><summary className="cursor-pointer text-sm font-semibold text-slate-600">Opzioni avanzate e azzeramenti</summary>
            <p className="my-3 text-xs text-slate-500">Usa i punteggi di test soltanto su un torneo di prova. Le altre azioni possono cancellare dati già inseriti.</p>
            <div className="flex flex-wrap gap-3">
              <button disabled={!selectedTorneo} onClick={handleFillTestScores} className="rounded-lg border px-3 py-2 text-sm">Inserisci punteggi di test</button>
              <button disabled={!selectedTorneo} onClick={handleClearScores} className="rounded-lg border border-amber-200 px-3 py-2 text-sm text-amber-800">Azzera punteggi</button>
              <button disabled={!selectedTorneo} onClick={handleDeleteGironi} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700">Elimina gironi</button>
            </div>
          </details>
        </div>

        <div hidden={entryMode !== "setup"}>
        <div className="flex flex-col lg:flex-row gap-6">
            {/* Configurazione Gironi */}
            <div className="flex-1 space-y-8">
                <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-gray-100">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-gray-50 pb-4">
                        <div><h3 className="text-lg font-bold text-[#0a1628]">Configurazione dei gironi</h3><p className="mt-1 text-xs text-slate-500">Numero, formato di gioco e visibilità.</p></div>
                        <div className="flex flex-wrap items-center gap-6">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-500">Visibilità pubblica gironi:</span>
                                <button
                                    onClick={changeVisibility}
                                    disabled={!isLoaded || publishing || Boolean(scoreDrafts)}
                                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                                        pubblicato 
                                            ? 'bg-green-100 text-green-700 border border-green-200' 
                                            : 'bg-amber-100 text-amber-700 border border-amber-200'
                                    }`}
                                >
                                    {publishing ? "Salvataggio…" : pubblicato ? "Nascondi gironi al pubblico" : "Pubblica gironi"}
                                </button>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-gray-500">Tipo Classifica:</span>
                                <select
                                    value={rankingType}
                                    onChange={(e) => setRankingType(e.target.value)}
                                    className="bg-gray-50 border-none rounded-xl px-3 py-2 font-bold text-[#0a1628] text-xs shadow-inner focus:ring-1 focus:ring-[#0a1628] cursor-pointer"
                                >
                                    <option value="avulsa">Classifica Avulsa (Unica)</option>
                                    <option value="gironi">Classifiche Separate (Gironi)</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-gray-500">Numero Gironi:</span>
                                <input 
                                    type="number" 
                                    value={numGironi} 
                                    onChange={(e) => setNumGironi(Math.max(1, Math.min(8, parseInt(e.target.value) || 1)))}
                                    className="w-16 bg-gray-50 border-none rounded-xl px-3 py-2 text-center font-black text-[#0a1628] shadow-inner" 
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {gironi.map((g) => {
                            const c = getColors(g.colorClass);
                            const teamCount = teamCounts[g.id] || 0;
                            return (
                                <div key={g.id} className="bg-white rounded-[2rem] border-2 border-gray-50 shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md">
                                    <div className={`${c.main} p-5 text-white flex justify-between items-center`}>
                                        <h4 className="font-black text-xl uppercase tracking-tighter">GIRONE {g.id}</h4>
                                        <div className="flex gap-2">
                                            <select 
                                                value={gironeTypes[g.id]} 
                                                onChange={(e) => handleTypeChange(g.id, e.target.value)}
                                                className={`${c.inputBg} text-[10px] rounded-lg py-1 px-2 font-black border-none focus:ring-1 focus:ring-white text-white`}
                                            >
                                                <option value="Pool">Pool</option>
                                                <option value="Girone all'italiana">Italiana</option>
                                            </select>
                                            <input 
                                                type="number" 
                                                value={teamCounts[g.id]} 
                                                onChange={(e) => handleTeamCountChange(g.id, e.target.value)}
                                                className={`w-10 text-center ${c.inputBg} rounded-lg py-1 font-black border-none text-[10px] focus:ring-1 focus:ring-white text-white`} 
                                            />
                                        </div>
                                    </div>
                                    <div className="p-5 space-y-3">
                                        {Array.from({ length: teamCount }).map((_, idx) => {
                                            const playerInSlot = gironeAssignments[g.id]?.[idx] || "—";
                                            const hasPlayer = playerInSlot !== "—";
                                            const slotKey = `${g.id}-${idx}`;
                                            return (
                                                <div 
                                                    key={idx} 
                                                    className={`flex items-center gap-3 p-1.5 rounded-2xl transition-all border-2 cursor-pointer ${
                                                        selectedSlot && selectedSlot.gironeId === g.id && selectedSlot.slotIdx === idx
                                                            ? 'border-[#FFD700] bg-yellow-50/50 scale-[1.02] shadow-md'
                                                            : dragOverSlot === slotKey 
                                                                ? `border-dashed ${c.border} ${c.light} scale-[1.02] shadow-sm` 
                                                                : 'border-transparent hover:border-gray-200 hover:bg-gray-50/30'
                                                    }`}
                                                    draggable={hasPlayer}
                                                    onDragStart={(e) => handleDragStart(e, playerInSlot, g.id, idx)}
                                                    onDragEnd={() => {
                                                        setIsDragging(false);
                                                        setDragOverSlot(null);
                                                    }}
                                                    onDragOver={(e) => {
                                                        e.preventDefault();
                                                        setDragOverSlot(slotKey);
                                                    }}
                                                    onDragLeave={() => setDragOverSlot(null)}
                                                    onDrop={(e) => handleDrop(e, g.id, idx)}
                                                    onClick={() => handleSlotClick(g.id, idx, playerInSlot)}
                                                >
                                                    <span className="text-[10px] font-black text-gray-300 w-4 cursor-default select-none">{idx + 1}</span>
                                                    <select 
                                                        className="flex-1 bg-gray-50/80 border-none rounded-xl py-2.5 px-3 text-xs sm:text-sm font-bold text-gray-900 focus:ring-2 focus:ring-[#0a1628] cursor-pointer"
                                                        value={playerInSlot}
                                                        onChange={(e) => handleAssignmentChange(g.id, idx, e.target.value)}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <option value="—">—</option>
                                                        {giocatoriFiltrati.map(gf => (
                                                            <option key={gf.id} value={gf.giocatori}>{gf.giocatori}</option>
                                                        ))}
                                                    </select>
                                                    {hasPlayer && (
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleAssignmentChange(g.id, idx, "—");
                                                            }}
                                                            className="text-gray-400 hover:text-red-500 text-xs font-bold px-2 py-1 transition-colors"
                                                            title="Rimuovi dal girone"
                                                            type="button"
                                                        >
                                                            ✕
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>


                {/* Partite */}
                <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-gray-100">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-2">Riepilogo partite</h3>
                    <p className="mb-6 text-xs text-slate-500">Campo, orario e stato si modificano in Segna risultati e gestisci partite.</p>
                    <div className="space-y-10">
                        {gironi.map((g) => {
                            const c = getColors(g.colorClass);
                            const currentAssignments = {};
                            for(let i = 0; i < (teamCounts[g.id] || 0); i++) {
                                currentAssignments[i] = gironeAssignments[g.id]?.[i] || "—";
                            }
                            const schedule = getSchedule(teamCounts[g.id] || 0, g.id, currentAssignments);
                            return (
                                <div key={`partite-${g.id}`} className="space-y-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className={`w-3 h-3 rounded-full ${c.main}`}></div>
                                        <h4 className="text-sm font-black text-[#0a1628] uppercase tracking-widest">Girone {g.id}</h4>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {schedule.map((row, idx) => {
                                            const meta = matchMetadata[`${g.id}-${idx}`] || {};
                                            return (
                                                <div key={idx} className="bg-gray-50/50 rounded-2xl p-4 border border-gray-100 flex flex-col gap-3">
                                                    <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-1">
                                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Gara {idx + 1}</span>
                                                        <div className="flex gap-2">
                                                            <span className="text-[10px] text-slate-500">{[meta.time, meta.court && `Campo ${meta.court}`].filter(Boolean).join(" · ") || "Da programmare"}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-4">
                                                        <span className="flex-1 text-[11px] font-black text-[#0a1628] text-right truncate">
                                                            {row.left && row.left !== "—" && row.left !== "Slot Libero" ? splitNames(row.left).map(formatPlayerName).join(" - ") : (row.left || "Slot Libero")}
                                                        </span>
                                                        <span className="text-xs font-bold text-slate-400">VS</span>
                                                        <span className="flex-1 text-[11px] font-black text-[#0a1628] text-left truncate">
                                                            {row.right && row.right !== "—" && row.right !== "Slot Libero" ? splitNames(row.right).map(formatPlayerName).join(" - ") : (row.right || "Slot Libero")}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div 
                className={`w-full lg:w-80 bg-white rounded-[2.5rem] shadow-xl border p-6 h-fit sticky top-10 transition-all duration-300 ${
                    isDragging || selectedSlot
                        ? 'border-dashed border-red-300 bg-red-50/20 cursor-pointer shadow-lg' 
                        : 'border-gray-100'
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleSidebarDrop}
                onClick={handleSidebarClick}
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-black uppercase tracking-widest transition-colors text-gray-400">
                        {isDragging || selectedSlot ? "Rilascia/Clicca qui per rimuovere 🗑️" : "Iscritti Approvati"}
                    </h3>
                    <span className="bg-green-100 text-green-700 text-[10px] font-black px-3 py-1 rounded-full">{giocatoriFiltrati.length}</span>
                </div>
                <div className="space-y-3 max-h-[500px] overflow-y-auto no-scrollbar">
                    {giocatoriFiltrati.map((g, i) => {
                        const isAssigned = Object.values(gironeAssignments).some(slots => 
                            Object.values(slots).includes(g.giocatori)
                        );
                        return (
                            <div 
                                key={i} 
                                draggable
                                onDragStart={(e) => handleDragStart(e, g.giocatori)}
                                onDragEnd={() => setIsDragging(false)}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (isAssigned) return;
                                    if (selectedAthlete === g.giocatori) {
                                        setSelectedAthlete(null);
                                    } else {
                                        setSelectedAthlete(g.giocatori);
                                        setSelectedSlot(null);
                                    }
                                }}
                                className={`p-4 rounded-2xl border transition-all flex justify-between items-center group ${
                                    isAssigned 
                                        ? 'opacity-40 border-gray-100 hover:border-gray-100 bg-gray-50' 
                                        : selectedAthlete === g.giocatori
                                            ? 'border-blue-500 bg-blue-50/80 shadow-md scale-[1.02] cursor-pointer'
                                            : 'border-gray-100 bg-gray-50 hover:border-blue-200 hover:bg-white hover:shadow-md cursor-pointer'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-300 group-hover:text-blue-500 transition-colors select-none">⋮⋮</span>
                                    <span className={`font-bold text-xs ${isAssigned ? 'text-gray-400 line-through' : 'text-[#0a1628]'}`}>{g.giocatori}</span>
                                </div>
                                <span className={`text-[10px] font-black ${isAssigned ? 'text-gray-300' : 'text-blue-600'}`}>#{g.id}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
        </div>
      </div>
    </Container>
  );
}
