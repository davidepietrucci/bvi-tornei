"use client";

import { useState, useEffect, useMemo, useRef, useImperativeHandle, Suspense } from "react";
import { readWorkflowConfig, saveWorkflowConfig } from "@/app/utils/tournament-workflow";
import { useRouter, useSearchParams } from "next/navigation";
import StaffHeader from "@/app/components/StaffHeader";
import TournamentSetupHeader from "@/app/components/TournamentSetupHeader";
import FinalsSetupPanel from "@/app/components/tournament/FinalsSetupPanel";
import MatchScoreEntry from "@/app/components/tournament/MatchScoreEntry";
import { finalMatchGroups, applyFinalScore, applyFinalDetails, applyFinalAssignment } from "@/app/utils/final-scoring";
import { completedMatch } from "@/app/utils/match-scoring";
import GialloTournament from "@/app/components/GialloTournament";
import { isGiallo } from "@/app/utils/giallo";
import { getTornei, getGironi, getIscrizioni, syncAssignmentsWithIscrizioni } from "@/app/utils/db";
import { calculateUnifiedRanking, getSchedule as getScheduleShared } from "@/app/utils/ranking";

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

const getSchedule = (numTeams, gironeId, assignments = {}, gironeTypes = {}, gironeSets = {}, matchMetadata = {}) => {
  return getScheduleShared(numTeams, gironeId, assignments, gironeTypes, gironeSets, matchMetadata);
};

function TabelloneContent({ tournament = null, embedded = false, active = true, workspaceMode, saveRef, onSummary: summaryCallback }) {
  // Async saves must not report stale summaries after this editor becomes inactive.
  const summaryTarget = useRef({ active, callback: summaryCallback });
  useEffect(() => { summaryTarget.current = { active, callback: summaryCallback }; }, [active, summaryCallback]);
  const onSummary = useMemo(() => (summary) => {
    if (summaryTarget.current.active) summaryTarget.current.callback?.(summary);
  }, []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlTour = searchParams.get("tour");

  const [torneiAttivi, setTorneiAttivi] = useState(tournament ? [tournament] : []);
  const [selectedTorneo, setSelectedTorneo] = useState(tournament?.nome || "");
  const [phaseType, setPhaseType] = useState("gold_silver"); // "gold_silver", "double", or "single"
  const [subPhaseType, setSubPhaseType] = useState("direct"); // "direct" o "playoff"
  const [bracketSize, setBracketSize] = useState(8); // 4, 8, 16
  const [bracketAssignments, setBracketAssignments] = useState({});
  const [bracketMetadata, setBracketMetadata] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);
  const [tabellonePubblicato, setTabellonePubblicato] = useState(false);
  const [numGironi, setNumGironi] = useState(4);
  const [teamCounts, setTeamCounts] = useState({ A: 4, B: 4, C: 4, D: 4, E: 4, F: 4, G: 4, H: 4 });
  const [gConfigData, setGConfigData] = useState(null); // dati gironi iniziali per classifica avulsa

  const [numGoldGironiOpt, setNumGoldGironiOpt] = useState(0); // 0 = Auto
  const [teamsPerGoldGirone, setTeamsPerGoldGirone] = useState(4);
  const [numSilverGironiOpt, setNumSilverGironiOpt] = useState(0); // 0 = Auto
  const [teamsPerSilverGirone, setTeamsPerSilverGirone] = useState(4);
  const [groupCompositionMethod, setGroupCompositionMethod] = useState("girone"); // "girone" or "classifica"
  const [teamsToGold, setTeamsToGold] = useState(8);
  const [teamsToSilver, setTeamsToSilver] = useState(8);
  const selectedGiallo = torneiAttivi.find((t) => t.nome === selectedTorneo && isGiallo(t));
  const [saveError, setSaveError] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [entryMode, setEntryMode] = useState("setup");
  const effectiveEntryMode = workspaceMode === undefined ? entryMode : workspaceMode === "prepare" ? "setup" : "results";
  const [scoreDrafts, setScoreDrafts] = useState(0);
  const [resultBusy, setResultBusy] = useState(false);
  const savedFingerprint = useRef("");
  const pendingTimer = useRef(null);
  const loadingConfig = useRef(false);
  const currentConfig = useMemo(() => ({ phaseType, subPhaseType,
    bracketSize: phaseType === "gold_silver" && subPhaseType === "direct" ? Math.max(teamsToGold, teamsToSilver) : bracketSize,
    bracketAssignments, bracketMetadata, numGoldGironi: numGoldGironiOpt,
    teamsPerGoldGirone, numSilverGironi: numSilverGironiOpt, teamsPerSilverGirone,
    groupCompositionMethod, teamsToGold, teamsToSilver, tabellonePubblicato }),
  [phaseType, subPhaseType, bracketSize, bracketAssignments, bracketMetadata, numGoldGironiOpt,
    teamsPerGoldGirone, numSilverGironiOpt, teamsPerSilverGirone, groupCompositionMethod, teamsToGold, teamsToSilver, tabellonePubblicato]);
  const scoringGroups = useMemo(() => finalMatchGroups(currentConfig), [currentConfig]);
  const finalMatches = scoringGroups.reduce((total, group) => total + group.matches.length, 0);
  const finalCompleted = scoringGroups.reduce((total, group) => total + group.matches.filter(completedMatch).length, 0);
  const finalsConfigured = finalMatches > 0;
  const persist = async (force = false) => {
    if (scoreDrafts) throw new Error("Salva o scarta le modifiche alle partite prima di cambiare sezione.");
    if (!isLoaded) throw new Error("Attendi il caricamento della fase finale.");
    if (!force && savedFingerprint.current === "null" && !Object.keys(bracketAssignments).length && !tabellonePubblicato) return;
    if (savedFingerprint.current === JSON.stringify(currentConfig)) return;
    await saveWorkflowConfig("bracket", selectedTorneo.toLowerCase().trim().replace(/\s+/g, "_"), currentConfig);
    savedFingerprint.current = JSON.stringify(currentConfig); setSaveError("");
    onSummary?.({ finalsPublished: tabellonePubblicato });
  };
  useImperativeHandle(saveRef, () => ({ flush: persist }));
  const switchMode = async (mode) => {
    if (resultBusy || mode === entryMode) return;
    if (scoreDrafts) { setSaveError("Salva o scarta le bozze delle partite prima di cambiare vista."); return; }
    try { await persist(); setEntryMode(mode); setSaveError(""); } catch (error) { setSaveError(error.message); }
  };
  const changeSetting = (key, value) => {
    const setters = { phaseType: setPhaseType, subPhaseType: setSubPhaseType, bracketSize: setBracketSize, teamsToGold: setTeamsToGold, teamsToSilver: setTeamsToSilver,
      numGoldGironi: setNumGoldGironiOpt, numSilverGironi: setNumSilverGironiOpt, teamsPerGoldGirone: setTeamsPerGoldGirone, teamsPerSilverGirone: setTeamsPerSilverGirone, groupCompositionMethod: setGroupCompositionMethod };
    setters[key]?.(value);
  };
  const changeAssignment = (key, value) => {
    if (value.trim() === (bracketAssignments[key] || "")) return true;
    try {
      const outcome = applyFinalAssignment(currentConfig, key, value, gConfigData || { numGironi, teamCounts });
      if (outcome.cleared.length && !window.confirm(`La correzione annulla ${outcome.cleared.length} risultati dipendenti, mantenendo campo e orario. Continuare?`)) return false;
      setBracketAssignments(outcome.config.bracketAssignments); setBracketMetadata(outcome.config.bracketMetadata); return true;
    } catch (error) { setSaveError(error.message); return false; }
  };
  const saveResultConfig = async (next) => {
    clearTimeout(pendingTimer.current); setResultBusy(true); onSummary?.({ busy: true });
    try {
      await saveWorkflowConfig("bracket", selectedTorneo.toLowerCase().trim().replace(/\s+/g, "_"), next);
      savedFingerprint.current = JSON.stringify(next);
      setBracketAssignments(next.bracketAssignments); setBracketMetadata(next.bracketMetadata); setSaveError("");
      return true;
    } catch (error) { setSaveError(error.message); throw error; }
    finally { setResultBusy(false); onSummary?.({ busy: false }); }
  };
  const recordScore = async (game, score, details) => {
    const outcome = applyFinalScore(currentConfig, game.id, score, details, gConfigData || { numGironi, teamCounts });
    if (outcome.cleared.length && !window.confirm(`Questa modifica annulla ${outcome.cleared.length} risultati dei turni dipendenti. Campo e orario saranno mantenuti. Continuare?`)) return false;
    return saveResultConfig(outcome.config);
  };
  const recordDetails = (game, details) => saveResultConfig(applyFinalDetails(currentConfig, game.id, details));
  const changeVisibility = async () => {
    if (publishing || !isLoaded || resultBusy || scoreDrafts) return;
    clearTimeout(pendingTimer.current);
    const next = { ...currentConfig, tabellonePubblicato: !tabellonePubblicato };
    setPublishing(true); setSaveError(""); onSummary?.({ busy: true });
    try {
      await saveWorkflowConfig("bracket", selectedTorneo.toLowerCase().trim().replace(/\s+/g, "_"), next);
      savedFingerprint.current = JSON.stringify(next);
      setTabellonePubblicato(next.tabellonePubblicato);
      onSummary?.({ finalsPublished: next.tabellonePubblicato });
    } catch (error) { setSaveError(error.message); }
    finally { setPublishing(false); onSummary?.({ busy: false }); }
  };

  let goldSlots = 0;
  let silverSlots = 0;
  for (let i = 0; i < numGironi; i++) {
    const gid = String.fromCharCode(65 + i);
    const count = teamCounts[gid] || 0;
    goldSlots += Math.min(2, count);
    silverSlots += Math.min(2, Math.max(0, count - 2));
  }
  const autoNumGoldGironi = goldSlots > 4 ? 2 : 1;
  const autoNumSilverGironi = silverSlots > 4 ? 2 : 1;

  const numGoldGironi = numGoldGironiOpt > 0 ? numGoldGironiOpt : autoNumGoldGironi;
  const numSilverGironi = numSilverGironiOpt > 0 ? numSilverGironiOpt : autoNumSilverGironi;

  useEffect(() => {
    if (embedded) return;
    getTornei().then(parsed => {
      const attivi = parsed.filter(t => !isGiallo(t) && ["Iscrizioni Aperte", "In Programmazione", "In Corso", "Concluso"].includes(t.stato));
      if (parsed.some((t) => t.nome === urlTour && isGiallo(t))) {
        window.location.replace(`/staff/giallo?tour=${encodeURIComponent(urlTour)}`);
        return;
      }
      setTorneiAttivi(attivi);
      if (urlTour && attivi.some(t => t.nome === urlTour)) setSelectedTorneo(urlTour);
      else if (attivi.length > 0) setSelectedTorneo(attivi[0].nome);
    });
  }, [urlTour, embedded]);

  useEffect(() => {
    if (!selectedTorneo || !active) return;
    let cancelled = false;
    loadingConfig.current = true;
    setIsLoaded(false);
    
    const slug = selectedTorneo.toLowerCase().trim().replace(/\s+/g, '_');
    
    Promise.all([readWorkflowConfig("gironi", slug), readWorkflowConfig("bracket", slug), getIscrizioni()]).then(([gConfig, config, iscrizioniList]) => {
      if (cancelled) return;
      if (gConfig) {
        setNumGironi(gConfig.numGironi || 4);
        setTeamCounts(gConfig.teamCounts || { A: 4, B: 4, C: 4, D: 4, E: 4, F: 4, G: 4, H: 4 });
        setGConfigData(gConfig);
      } else {
        setNumGironi(4);
        setTeamCounts({ A: 4, B: 4, C: 4, D: 4, E: 4, F: 4, G: 4, H: 4 });
        setGConfigData(null);
      }
      savedFingerprint.current = JSON.stringify(config);
      onSummary?.({ finalsPublished: Boolean(config?.tabellonePubblicato) });
      if (config) {
        setPhaseType(config.phaseType || "gold_silver");
        setSubPhaseType(config.subPhaseType || "direct");
        setBracketSize(config.bracketSize || 8);

        const syncedAssignments = syncAssignmentsWithIscrizioni(config.bracketAssignments || {}, iscrizioniList || []);
        setBracketAssignments(syncedAssignments);

        setBracketMetadata(config.bracketMetadata || {});
        setNumGoldGironiOpt(config.numGoldGironi || 0);
        setTeamsPerGoldGirone(config.teamsPerGoldGirone || 4);
        setNumSilverGironiOpt(config.numSilverGironi || 0);
        setTeamsPerSilverGirone(config.teamsPerSilverGirone || 4);
        setGroupCompositionMethod(config.groupCompositionMethod || "girone");
        setTeamsToGold(config.teamsToGold || 8);
        setTeamsToSilver(config.teamsToSilver || 8);
        setTabellonePubblicato(config.tabellonePubblicato || false);
      } else {
        setPhaseType("gold_silver"); setSubPhaseType("direct"); setBracketSize(8); setBracketAssignments({}); setBracketMetadata({});
        setNumGoldGironiOpt(0); setTeamsPerGoldGirone(4); setNumSilverGironiOpt(0); setTeamsPerSilverGirone(4);
        setGroupCompositionMethod("girone");
        setTeamsToGold(8);
        setTeamsToSilver(8);
        setTabellonePubblicato(false);
      }
      loadingConfig.current = false;
      setIsLoaded(true);
    }).catch((error) => { if (!cancelled) setSaveError(error.message); });
    return () => { cancelled = true; };
  }, [selectedTorneo, active, onSummary]);

  useEffect(() => {
    // Activation refreshes the bracket: do not publish the previous snapshot first.
    if (!active || !isLoaded || !selectedTorneo || loadingConfig.current) return;
    onSummary({ finalsPublished: tabellonePubblicato, finalsConfigured, finalMatches, finalCompleted, scoreDrafts });
  }, [active, isLoaded, selectedTorneo, tabellonePubblicato, finalsConfigured, finalMatches, finalCompleted, scoreDrafts, onSummary]);

  // Auto-save whenever configurations change (after they have been fully loaded)
  useEffect(() => {
    if (!selectedTorneo || !isLoaded || selectedGiallo || !active || publishing || resultBusy) return;
    if (savedFingerprint.current === JSON.stringify(currentConfig)) return;
    if (savedFingerprint.current === "null" && !Object.keys(bracketAssignments).length) return;
    const slug = selectedTorneo.toLowerCase().trim().replace(/\s+/g, '_');
    const config = { 
      phaseType, 
      subPhaseType, 
      bracketSize: currentConfig.bracketSize,
      bracketAssignments, 
      bracketMetadata,
      numGoldGironi: numGoldGironiOpt,
      teamsPerGoldGirone,
      numSilverGironi: numSilverGironiOpt,
      teamsPerSilverGirone,
      groupCompositionMethod,
      teamsToGold,
      teamsToSilver,
      tabellonePubblicato
    };
    
    // Cache is updated by saveWorkflowConfig only after a confirmed server save.
    const handler = setTimeout(() => {
      saveWorkflowConfig("bracket", slug, config).then(() => {
        savedFingerprint.current = JSON.stringify(config); setSaveError("");
        onSummary?.({ finalsPublished: config.tabellonePubblicato });
      }).catch((error) => setSaveError(error.message));
    }, 1000);

    pendingTimer.current = handler;
    return () => clearTimeout(handler);
  }, [phaseType, subPhaseType, bracketSize, bracketAssignments, bracketMetadata, selectedTorneo, isLoaded, numGoldGironiOpt, teamsPerGoldGirone, numSilverGironiOpt, teamsPerSilverGirone, groupCompositionMethod, teamsToGold, teamsToSilver, tabellonePubblicato, selectedGiallo, active, currentConfig, onSummary, publishing, resultBusy]);


  const getTeamsCountForGroup = (groupKey) => {
    if (subPhaseType === "custom_18" && groupKey.startsWith("pool-gold-")) return 4;
    if (groupKey.startsWith("gold-")) {
      return subPhaseType === "custom_18" ? 3 : (teamsPerGoldGirone || 4);
    }
    return subPhaseType === "custom_18" ? 3 : (teamsPerSilverGirone || 4);
  };

  const getIntermediateGroupTeamsList = (groupKey) => {
    const limit = getTeamsCountForGroup(groupKey);
    const list = [];
    for (let i = 0; i < limit; i++) {
      list.push(bracketAssignments[`${groupKey}-${i}`]);
    }
    return list;
  };

  const getMatchTeams = (matchId) => {
    let left = bracketAssignments[`${matchId}-L`];
    let right = bracketAssignments[`${matchId}-R`];

    if (!left || !right) {
      const poolMatch = matchId.match(/^(.+)-m([0-4])$/);
      if (poolMatch) {
        const groupKey = poolMatch[1];
        const mNum = parseInt(poolMatch[2]);
        if (mNum === 0) {
          left = left || bracketAssignments[`${groupKey}-0`];
          right = right || bracketAssignments[`${groupKey}-1`];
        } else if (mNum === 1) {
          left = left || bracketAssignments[`${groupKey}-2`];
          right = right || bracketAssignments[`${groupKey}-3`];
        } else if (mNum === 2) {
          left = left || resolveWinner(`${groupKey}-m0`);
          right = right || resolveWinner(`${groupKey}-m1`);
        } else if (mNum === 3) {
          left = left || resolveLoser(`${groupKey}-m0`);
          right = right || resolveLoser(`${groupKey}-m1`);
        } else if (mNum === 4) {
          left = left || resolveLoser(`${groupKey}-m2`);
          right = right || resolveWinner(`${groupKey}-m3`);
        }
      }
    }
    return { left, right };
  };

  const resolveWinner = (matchId) => {
    const { left, right } = getMatchTeams(matchId);

    if (left === "—" && right && right !== "—") return right;
    if (right === "—" && left && left !== "—") return left;

    const meta = bracketMetadata[matchId] || {};
    if (!left || !right || meta.scoreL === undefined || meta.scoreL === "" || meta.scoreR === undefined || meta.scoreR === "") return null;
    const scoreL = parseInt(meta.scoreL || 0);
    const scoreR = parseInt(meta.scoreR || 0);
    if (!Number.isFinite(scoreL) || !Number.isFinite(scoreR) || scoreL === scoreR) return null;
    if ([meta.s1L, meta.s1R, meta.s2L, meta.s2R, meta.s3L, meta.s3R].some(v => v !== undefined && v !== "") && Math.max(scoreL, scoreR) < 2) return null;
    return scoreL > scoreR ? left : right;
  };

  const resolveLoser = (matchId) => {
    const { left, right } = getMatchTeams(matchId);

    if (left === "—" && right && right !== "—") return "—";
    if (right === "—" && left && left !== "—") return "—";

    const meta = bracketMetadata[matchId] || {};
    if (!left || !right || meta.scoreL === undefined || meta.scoreL === "" || meta.scoreR === undefined || meta.scoreR === "") return null;
    const scoreL = parseInt(meta.scoreL || 0);
    const scoreR = parseInt(meta.scoreR || 0);
    if (!Number.isFinite(scoreL) || !Number.isFinite(scoreR) || scoreL === scoreR) return null;
    if ([meta.s1L, meta.s1R, meta.s2L, meta.s2R, meta.s3L, meta.s3R].some(v => v !== undefined && v !== "") && Math.max(scoreL, scoreR) < 2) return null;
    return scoreL > scoreR ? right : left;
  };

  const getRoundRobinPairs = (numTeams) => {
    if (!numTeams || numTeams < 2) return [];
    const pairs = [];
    let count = 1;
    for (let i = 0; i < numTeams; i++) {
      for (let j = i + 1; j < numTeams; j++) {
        pairs.push({ l: i, r: j, label: `Gara ${count++}` });
      }
    }
    return pairs;
  };

  const getPoolPairs = (groupKey) => {
    const t0 = bracketAssignments[`${groupKey}-0`];
    const t1 = bracketAssignments[`${groupKey}-1`];
    const t2 = bracketAssignments[`${groupKey}-2`];
    const t3 = bracketAssignments[`${groupKey}-3`];

    const isGold = groupKey.startsWith("gold");

    const winM0 = resolveWinner(`${groupKey}-m0`);
    const winM1 = resolveWinner(`${groupKey}-m1`);
    const losM0 = resolveLoser(`${groupKey}-m0`);
    const losM1 = resolveLoser(`${groupKey}-m1`);

    const winM2 = resolveWinner(`${groupKey}-m2`);
    const losM2 = resolveLoser(`${groupKey}-m2`);
    const winM3 = resolveWinner(`${groupKey}-m3`);
    const losM3 = resolveLoser(`${groupKey}-m3`);

    if (subPhaseType === "custom_18") {
      const isPool1 = groupKey.endsWith("-1");
      return [
        { label: `Gara 1 (${isPool1 ? '1°A vs 2°B' : '1°B vs 2°A'})`, l: t0, r: t1, matchId: `${groupKey}-m0` },
        { label: `Gara 2 (${isPool1 ? '1°C vs 2°D' : '1°D vs 2°C'})`, l: t2, r: t3, matchId: `${groupKey}-m1` },
        { label: "Gara 3 (Vincenti ➔ 1°/2° Pool)", l: winM0 || "Vincente Gara 1", r: winM1 || "Vincente Gara 2", matchId: `${groupKey}-m2` },
        { label: "Gara 4 (Perdenti ➔ 3°/4° Pool)", l: losM0 || "Perdente Gara 1", r: losM1 || "Perdente Gara 2", matchId: `${groupKey}-m3` },
      ];
    }

    return [
      { label: `Gara 1 (${isGold ? '1°A vs 2°B' : '3°A vs 4°B'})`, l: t0, r: t1, matchId: `${groupKey}-m0` },
      { label: `Gara 2 (${isGold ? '1°C vs 2°D' : '3°C vs 4°D'})`, l: t2, r: t3, matchId: `${groupKey}-m1` },
      { label: "Gara 3 (Vincenti ➔ 1°/2° Pool)", l: winM0 || "Vincente Gara 1", r: winM1 || "Vincente Gara 2", matchId: `${groupKey}-m2` },
      { label: "Gara 4 (Perdenti ➔ 3°/4° Pool)", l: losM0 || "Perdente Gara 1", r: losM1 || "Perdente Gara 2", matchId: `${groupKey}-m3` },
    ];
  };

  const getIntermediateGroupStats = (groupKey) => {
    if (subPhaseType === "custom_18" && groupKey.startsWith("pool-gold-")) {
      const winM2 = resolveWinner(`${groupKey}-m2`);
      const losM2 = resolveLoser(`${groupKey}-m2`);
      const winM3 = resolveWinner(`${groupKey}-m3`);
      const losM3 = resolveLoser(`${groupKey}-m3`);

      return [
        { nome: winM2 || `1° ${groupKey}`, note: "Diretta in Semifinale 🏆", pos: 1 },
        { nome: losM2 || `2° ${groupKey}`, note: "Ai Quarti di Finale ⚔️", pos: 2 },
        { nome: winM3 || `3° ${groupKey}`, note: "Ai Quarti di Finale ⚔️", pos: 3 },
        { nome: losM3 || `4° ${groupKey}`, note: "Eliminata ❌", pos: 4 },
      ];
    }

    if (subPhaseType === "pool_stepladder") {
      const winM2 = resolveWinner(`${groupKey}-m2`);
      const losM2 = resolveLoser(`${groupKey}-m2`);
      const winM3 = resolveWinner(`${groupKey}-m3`);
      const losM3 = resolveLoser(`${groupKey}-m3`);

      const res = [
        { nome: winM2 || `1° ${groupKey}`, note: "Qualificata in Semifinale 🏆", pos: 1 },
        { nome: losM2 || `2° ${groupKey}`, note: "Qualificata ai Quarti ⚽", pos: 2 },
        { nome: winM3 || `3° ${groupKey}`, note: "Qualificata ai Quarti 🥊", pos: 3 },
        { nome: losM3 || `4° ${groupKey}`, note: "Eliminata ❌", pos: 4 },
      ];

      return res;
    }

    const stats = {};
    const numTeams = getTeamsCountForGroup(groupKey);
    const teams = getIntermediateGroupTeamsList(groupKey).filter(t => t && t !== "—" && t !== "Slot Libero");

    teams.forEach(t => {
      stats[t] = { nome: t, giocate: 0, vinte: 0, perse: 0, pf: 0, ps: 0, punti: 0 };
    });

    const pairMaps = getRoundRobinPairs(numTeams);

    pairMaps.forEach((pair, idx) => {
      const teamL = bracketAssignments[`${groupKey}-${pair.l}`];
      const teamR = bracketAssignments[`${groupKey}-${pair.r}`];
      if (!teamL || !teamR || !stats[teamL] || !stats[teamR]) return;

      const mKey = `${groupKey}-m${idx}`;
      const meta = bracketMetadata[mKey] || {};
      const s1L = parseInt(meta.scoreL || 0);
      const s1R = parseInt(meta.scoreR || 0);
      if (s1L === 0 && s1R === 0) return;

      stats[teamL].giocate++;
      stats[teamR].giocate++;
      stats[teamL].pf += s1L;
      stats[teamR].pf += s1R;
      stats[teamL].ps += s1R;
      stats[teamR].ps += s1L;

      if (s1L > s1R) {
        stats[teamL].vinte++;
        stats[teamL].punti++;
        stats[teamR].perse++;
      } else {
        stats[teamR].vinte++;
        stats[teamR].punti++;
        stats[teamL].perse++;
      }
    });

    return Object.values(stats).sort((a, b) => {
      if (b.punti !== a.punti) return b.punti - a.punti;
      const qzA = a.ps === 0 ? a.pf : a.pf / a.ps;
      const qzB = b.ps === 0 ? b.pf : b.pf / b.ps;
      return qzB - qzA;
    });
  };



  // Calcola la Classifica Avulsa Gold per custom_18 (12 team: 1° e 2° dei gironi iniziali A-F)
  const getClassificaAvulsaGoldCustom18 = () => {
    const gConfig = gConfigData;
    if (!gConfig) return [];
    const nGironi = gConfig.numGironi || 0;

    const getRanking = (gid) => {
      const teams = gConfig.gironeAssignments?.[gid] || {};
      const meta = gConfig.matchMetadata || {};
      const isThreeSets = gConfig.gironeSets?.[gid] === "3 set";
      const stats = {};
      const count = gConfig.teamCounts?.[gid] || 0;
      for (let i = 0; i < count; i++) {
        const n = teams[i]; if (n && n !== "—" && n !== "Slot Libero") stats[n] = { nome: n, punti: 0, pf: 0, ps: 0 };
      }
      const schedule = getSchedule(count, gid, teams, gConfig.gironeTypes || {}, gConfig.gironeSets || {}, meta);
      schedule.forEach((match, i) => {
        const m = meta[`${gid}-${i}`];
        if (!m) return;
        const l = match.left; const r = match.right;
        if (!stats[l] || !stats[r]) return;
        const s1L = parseInt(m.s1L||0), s1R = parseInt(m.s1R||0);
        const s2L = parseInt(m.s2L||0), s2R = parseInt(m.s2R||0);
        const s3L = parseInt(m.s3L||0), s3R = parseInt(m.s3R||0);
        if (s1L === 0 && s1R === 0) return;
        stats[l].pf += (s1L + s2L + s3L);
        stats[r].pf += (s1R + s2R + s3R);
        stats[l].ps += (s1R + s2R + s3R);
        stats[r].ps += (s1L + s2L + s3L);
        const isThreeS = isThreeSets;
        let winL = 0;
        if (isThreeS) {
          let sL = 0, sR = 0;
          if (s1L > s1R) sL++; else if (s1R > s1L) sR++;
          if (s2L > s2R) sL++; else if (s2R > s2L) sR++;
          if (s3L > s3R) sL++; else if (s3R > s3L) sR++;
          winL = sL > sR ? 1 : 0;
        } else { winL = s1L > s1R ? 1 : 0; }
        if (winL) stats[l].punti++; else stats[r].punti++;
      });
      return Object.values(stats).sort((a, b) => {
        if (b.punti !== a.punti) return b.punti - a.punti;
        const qA = a.ps === 0 ? a.pf : a.pf / a.ps;
        const qB = b.ps === 0 ? b.pf : b.pf / b.ps;
        return qB - qA;
      });
    };

    const firstsList = [];
    const secondsList = [];
    for (let i = 0; i < nGironi; i++) {
      const gid = String.fromCharCode(65 + i);
      const ranked = getRanking(gid);
      const gLabel = `Girone ${gid}`;
      if (ranked[0]) firstsList.push({ ...ranked[0], girone: gLabel, pos: "1°" });
      if (ranked[1]) secondsList.push({ ...ranked[1], girone: gLabel, pos: "2°" });
    }

    const qualifiedNames = new Set([...firstsList, ...secondsList].map(t => t.nome));
    return calculateUnifiedRanking(gConfig)
      .filter(t => qualifiedNames.has(t.nome))
      .map((t, idx) => ({
        ...t,
        girone: `Girone ${t.girone}`,
        pos: "Gold",
        punti: t.score || 0,
        pf: t.puntiFatti || 0,
        ps: t.puntiSubiti || 0,
        rank: idx + 1,
      }));
  };

  const handleAutoFill = async () => {
    if (scoreDrafts) { setSaveError("Salva o scarta le bozze prima di rigenerare gli abbinamenti."); return; }
    if (Object.keys(bracketAssignments).length && !window.confirm("Rigenerare gli abbinamenti della fase finale? I risultati degli incontri rigenerati saranno azzerati. Nessun altro torneo sarà modificato.")) return;
    const slug = selectedTorneo.toLowerCase().trim().replace(/\s+/g, '_');
    const gConfig = await getGironi(slug);
    if (!gConfig) { alert("Nessuna configurazione gironi!"); return; }
    const numGironi = gConfig.numGironi || 0;
    const newAssignments = { ...bracketAssignments };
    const rType = gConfig.rankingType || "avulsa";
    
    const getRanking = (gid) => {
        const teams = gConfig.gironeAssignments?.[gid] || {};
        const meta = gConfig.matchMetadata || {};
        const isThreeSets = gConfig.gironeSets?.[gid] === "3 set";
        const stats = {};
        const count = gConfig.teamCounts?.[gid] || 0;
        for(let i=0; i<count; i++) {
            const n = teams[i]; if(n && n!=="—" && n!=="Slot Libero") stats[n] = { nome: n, punti: 0, pf: 0, ps: 0 };
        }
        
        const schedule = getSchedule(count, gid, teams, gConfig.gironeTypes || {}, gConfig.gironeSets || {}, gConfig.matchMetadata || {});
        schedule.forEach((match, i) => {
            const m = meta[`${gid}-${i}`];
            if (!m) return;
            const l = match.left;
            const r = match.right;
            if(!stats[l] || !stats[r]) return;
            const s1L = parseInt(m.s1L||0), s1R = parseInt(m.s1R||0);
            const s2L = parseInt(m.s2L||0), s2R = parseInt(m.s2R||0);
            const s3L = parseInt(m.s3L||0), s3R = parseInt(m.s3R||0);
            if(s1L===0 && s1R===0) return;
            stats[l].pf += (s1L + s2L + s3L);
            stats[r].pf += (s1R + s2R + s3R);
            stats[l].ps += (s1R + s2R + s3R);
            stats[r].ps += (s1L + s2L + s3L);
            
            let matchWinL = 0;
            if (isThreeSets) {
                let setsL = 0, setsR = 0;
                if (s1L > s1R) setsL++; else if (s1R > s1L) setsR++;
                if (s2L > s2R) setsL++; else if (s2R > s2L) setsR++;
                if (s3L > s3R) setsL++; else if (s3R > s3L) setsR++;
                matchWinL = setsL > setsR ? 1 : 0;
            } else {
                matchWinL = s1L > s1R ? 1 : 0;
            }
            if(matchWinL) stats[l].punti++; else stats[r].punti++;
        });

        return Object.values(stats).sort((a,b) => {
            if (b.punti !== a.punti) return b.punti - a.punti;
            const qzTeamA = a.ps === 0 ? a.pf : a.pf / a.ps;
            const qzTeamB = b.ps === 0 ? b.pf : b.pf / b.ps;
            return qzTeamB - qzTeamA;
        }).map(s=>s.nome);
    };

    const rankings = {};
    for(let i=0; i<numGironi; i++) { const gid = String.fromCharCode(65+i); rankings[gid] = getRanking(gid); }
    const getRanked = (gid, pos) => {
      const teams = gConfig.gironeAssignments?.[gid] || {};
      const actualCount = Object.values(teams).filter(val => val && val !== "—" && val !== "Slot Libero").length;
      if (pos >= actualCount) return "—";
      const name = rankings[gid]?.[pos];
      if (name) return splitNames(name).map(formatPlayerName).join(" - ");
      return `TBD ${pos+1}° ${gid}`;
    };

    if (phaseType === "gold_silver" && (subPhaseType === "groups" || subPhaseType === "pool_stepladder" || subPhaseType === "custom_18")) {
      // Clean previous intermediate results to avoid stale data
      const cleanedMetadata = { ...bracketMetadata };
      Object.keys(cleanedMetadata).forEach(key => {
        if (key.startsWith("gold-") || key.startsWith("silver-")) {
          delete cleanedMetadata[key];
        }
      });
      setBracketMetadata(cleanedMetadata);

      // Clean existing assignments for all gold & silver group slots first
      Object.keys(newAssignments).forEach(key => {
        if (
          key.startsWith("gold-A-") || key.startsWith("gold-B-") || key.startsWith("gold-C-") || key.startsWith("gold-D-") ||
          key.startsWith("silver-A-") || key.startsWith("silver-B-") || key.startsWith("silver-C-") || key.startsWith("silver-D-") ||
          key.startsWith("gold-s1-") || key.startsWith("gold-s2-") || key.startsWith("gold-f1-") || key.startsWith("gold-f3-") ||
          key.startsWith("silver-s1-") || key.startsWith("silver-s2-") || key.startsWith("silver-f1-") || key.startsWith("silver-f3-")
        ) {
          delete newAssignments[key];
        }
      });

      if (subPhaseType === "custom_18") {
        setNumSilverGironiOpt(2);
        setTeamsPerSilverGirone(3);
        setNumGoldGironiOpt(4);
        setTeamsPerGoldGirone(3);

        // Silver Girone A: 3°A, 3°C, 3°E
        newAssignments["silver-A-0"] = getRanked('A', 2);
        newAssignments["silver-A-1"] = getRanked('C', 2);
        newAssignments["silver-A-2"] = getRanked('E', 2);

        // Silver Girone B: 3°B, 3°D, 3°F
        newAssignments["silver-B-0"] = getRanked('B', 2);
        newAssignments["silver-B-1"] = getRanked('D', 2);
        newAssignments["silver-B-2"] = getRanked('F', 2);

        // Classifica Avulsa Iniziale tra le 1° e tra le 2° dei gironi iniziali
        const firstsList = [];
        const secondsList = [];
        for (let i = 0; i < numGironi; i++) {
          const gid = String.fromCharCode(65 + i);
          const r1 = getRanked(gid, 0);
          const r2 = getRanked(gid, 1);
          if (r1) firstsList.push(r1);
          if (r2) secondsList.push(r2);
        }

        // Classifica avulsa globale dei 12 qualificati Gold, poi distribuzione a serpentina.
        const qualifiedNames = new Set(Object.values(rankings).flatMap(list => list.slice(0, 2)));
        const goldSeeds = calculateUnifiedRanking(gConfig)
          .filter(team => qualifiedNames.has(team.nome))
          .map(team => splitNames(team.nome).map(formatPlayerName).join(" - "));
        const groupLetters = ["A", "B", "C", "D"];
        goldSeeds.forEach((team, seedIndex) => {
          const row = Math.floor(seedIndex / 4);
          const column = seedIndex % 4;
          const groupIndex = row % 2 === 0 ? column : 3 - column;
          const slot = row;
          newAssignments[`gold-${groupLetters[groupIndex]}-${slot}`] = team;
        });
      } else {
        // Calculate dynamically the target groups count
        let currentGoldSlots = 0;
        let currentSilverSlots = 0;
        for (let i = 0; i < numGironi; i++) {
          const gid = String.fromCharCode(65 + i);
          const count = gConfig.teamCounts[gid] || 0;
          currentGoldSlots += Math.min(2, count);
          currentSilverSlots += Math.min(2, Math.max(0, count - 2));
        }
        const autoNumGoldGironi = currentGoldSlots >= 12 ? 4 : (currentGoldSlots > 4 ? 2 : 1);
        const autoNumSilverGironi = currentSilverSlots >= 12 ? 4 : (currentSilverSlots > 4 ? 2 : 1);

        const currentNumGoldGironi = numGoldGironiOpt > 0 ? numGoldGironiOpt : autoNumGoldGironi;
        const currentNumSilverGironi = numSilverGironiOpt > 0 ? numSilverGironiOpt : autoNumSilverGironi;
        const currentTeamsPerGoldGirone = teamsPerGoldGirone || 4;
        const currentTeamsPerSilverGirone = teamsPerSilverGirone || 4;
        const goldFilled = Array(currentNumGoldGironi).fill(0);
        const silverFilled = Array(currentNumSilverGironi).fill(0);

      if (groupCompositionMethod === "classifica") {
        const rankingsUnified = calculateUnifiedRanking(gConfig).map(s => {
          if (!s.nome) return "";
          return splitNames(s.nome).map(formatPlayerName).join(" - ");
        });

        // 1. Gold Assignments (Snake Draft)
        // Array condiviso con il completamento finale dei gironi
        const totalGoldTeamsNeeded = currentNumGoldGironi * currentTeamsPerGoldGirone;
        for (let idx = 0; idx < totalGoldTeamsNeeded; idx++) {
          const team = rankingsUnified[idx] || "—";
          const row = Math.floor(idx / currentNumGoldGironi);
          const col = idx % currentNumGoldGironi;
          const targetGroupIdx = (row % 2 === 0) ? col : (currentNumGoldGironi - 1 - col);
          const targetLetter = String.fromCharCode(65 + targetGroupIdx);
          const slotIdx = goldFilled[targetGroupIdx];
          if (slotIdx < currentTeamsPerGoldGirone) {
            newAssignments[`gold-${targetLetter}-${slotIdx}`] = team;
            goldFilled[targetGroupIdx]++;
          }
        }

        // 2. Silver Assignments (Snake Draft)
        // Array condiviso con il completamento finale dei gironi
        const totalSilverTeamsNeeded = currentNumSilverGironi * currentTeamsPerSilverGirone;
        for (let idx = 0; idx < totalSilverTeamsNeeded; idx++) {
          const rankingIdx = totalGoldTeamsNeeded + idx;
          const team = rankingsUnified[rankingIdx] || "—";
          const row = Math.floor(idx / currentNumSilverGironi);
          const col = idx % currentNumSilverGironi;
          const targetGroupIdx = (row % 2 === 0) ? col : (currentNumSilverGironi - 1 - col);
          const targetLetter = String.fromCharCode(65 + targetGroupIdx);
          const slotIdx = silverFilled[targetGroupIdx];
          if (slotIdx < currentTeamsPerSilverGirone) {
            newAssignments[`silver-${targetLetter}-${slotIdx}`] = team;
            silverFilled[targetGroupIdx]++;
          }
        }
      } else {
        // 1. Gold Assignments (True Snake Draft)
        for (let rank = 0; rank < 2; rank++) {
          for (let gIdx = 0; gIdx < numGironi; gIdx++) {
            const gid = String.fromCharCode(65 + gIdx);
            const count = gConfig.teamCounts[gid] || 0;
            if (rank < count) {
              const team = getRanked(gid, rank);
              const effectiveGIdx = gIdx % currentNumGoldGironi;
              const targetGroupIdx = (rank % 2 === 0) ? effectiveGIdx : (currentNumGoldGironi - 1 - effectiveGIdx);
              const targetLetter = String.fromCharCode(65 + targetGroupIdx);
              const slotIdx = goldFilled[targetGroupIdx];
              if (slotIdx < currentTeamsPerGoldGirone) {
                newAssignments[`gold-${targetLetter}-${slotIdx}`] = team;
                goldFilled[targetGroupIdx]++;
              }
            }
          }
        }

        // 2. Silver Assignments (True Snake Draft)
        let maxTeams = 0;
        for (let i = 0; i < numGironi; i++) {
          const gid = String.fromCharCode(65 + i);
          maxTeams = Math.max(maxTeams, gConfig.teamCounts[gid] || 0);
        }
        for (let rank = 2; rank < Math.min(4, maxTeams); rank++) {
          for (let gIdx = 0; gIdx < numGironi; gIdx++) {
            const gid = String.fromCharCode(65 + gIdx);
            const count = gConfig.teamCounts[gid] || 0;
            if (rank < count) {
              const team = getRanked(gid, rank);
              const effectiveGIdx = gIdx % currentNumSilverGironi;
              const relativeRank = rank - 2;
              const targetGroupIdx = (relativeRank % 2 === 0) ? effectiveGIdx : (currentNumSilverGironi - 1 - effectiveGIdx);
              const targetLetter = String.fromCharCode(65 + targetGroupIdx);
              const slotIdx = silverFilled[targetGroupIdx];
              if (slotIdx < currentTeamsPerSilverGirone) {
                newAssignments[`silver-${targetLetter}-${slotIdx}`] = team;
                silverFilled[targetGroupIdx]++;
              }
            }
          }
        }
      }

        // Pad remainder with "—" up to limit
        for (let targetGroupIdx = 0; targetGroupIdx < currentNumGoldGironi; targetGroupIdx++) {
          const targetLetter = String.fromCharCode(65 + targetGroupIdx);
          for (let slotIdx = goldFilled[targetGroupIdx]; slotIdx < currentTeamsPerGoldGirone; slotIdx++) {
            newAssignments[`gold-${targetLetter}-${slotIdx}`] = "—";
          }
        }
        for (let targetGroupIdx = 0; targetGroupIdx < currentNumSilverGironi; targetGroupIdx++) {
          const targetLetter = String.fromCharCode(65 + targetGroupIdx);
          for (let slotIdx = silverFilled[targetGroupIdx]; slotIdx < currentTeamsPerSilverGirone; slotIdx++) {
            newAssignments[`silver-${targetLetter}-${slotIdx}`] = "—";
          }
        }
      }
    } else {
      // Per i tabelloni diretti si parte da una configurazione pulita:
      // eventuali semifinali/finali precedenti non devono sopravvivere alla rigenerazione.
      if ((phaseType === "gold_silver" && subPhaseType === "direct") || phaseType === "single") {
        const cleanedDirectMetadata = { ...bracketMetadata };
        Object.keys(cleanedDirectMetadata).forEach(key => {
          if (key.startsWith("gold-") || key.startsWith("silver-") || key.startsWith("wb-") || key.startsWith("lb-") || key.startsWith("grand-final-")) delete cleanedDirectMetadata[key];
        });
        setBracketMetadata(cleanedDirectMetadata);
        Object.keys(newAssignments).forEach(key => {
          if (key.startsWith("gold-") || key.startsWith("silver-") || key.startsWith("wb-") || key.startsWith("lb-") || key.startsWith("grand-final-")) delete newAssignments[key];
        });
      }
      let totalSlots = 0;
      for (let i = 0; i < numGironi; i++) {
        const gid = String.fromCharCode(65 + i);
        totalSlots += (gConfig.teamCounts?.[gid] || 0);
      }

      if (groupCompositionMethod === "classifica") {
        // Clean previous assignments
        Object.keys(newAssignments).forEach(key => {
          if (key.startsWith("gold-") || key.startsWith("silver-") || key.startsWith("wb-") || key.startsWith("lb-") || key.startsWith("grand-final-")) {
            delete newAssignments[key];
          }
        });

        const unifiedRanking = calculateUnifiedRanking(gConfig);
        const totalTeams = unifiedRanking.length;
        const getTeamByRank = (rankIdx) => {
          if (rankIdx >= totalTeams) return "—";
          if (unifiedRanking[rankIdx]) {
            const name = unifiedRanking[rankIdx].nome;
            return splitNames(name).map(formatPlayerName).join(" - ");
          }
          return `TBD ${rankIdx + 1}° Classificato`;
        };

        if ((phaseType === "gold_silver" && subPhaseType === "direct") || phaseType === "single") {
          const buildGoldDirect = (count) => {
            if (count === 4) {
              setBracketSize(4);
              newAssignments['gold-s1-L'] = getTeamByRank(0);
              newAssignments['gold-s1-R'] = getTeamByRank(3);
              newAssignments['gold-s2-L'] = getTeamByRank(1);
              newAssignments['gold-s2-R'] = getTeamByRank(2);
            } else if (count === 8) {
              setBracketSize(8);
              newAssignments['gold-q1-L'] = getTeamByRank(0);
              newAssignments['gold-q1-R'] = getTeamByRank(7);
              newAssignments['gold-q2-L'] = getTeamByRank(3);
              newAssignments['gold-q2-R'] = getTeamByRank(4);
              newAssignments['gold-q3-L'] = getTeamByRank(1);
              newAssignments['gold-q3-R'] = getTeamByRank(6);
              newAssignments['gold-q4-L'] = getTeamByRank(2);
              newAssignments['gold-q4-R'] = getTeamByRank(5);
            } else if (count === 12) {
              setBracketSize(8);
              newAssignments['gold-q1-L'] = getTeamByRank(0);
              newAssignments['gold-q2-L'] = getTeamByRank(1);
              newAssignments['gold-q3-L'] = getTeamByRank(2);
              newAssignments['gold-q4-L'] = getTeamByRank(3);

              newAssignments['gold-o1-L'] = getTeamByRank(4);
              newAssignments['gold-o1-R'] = getTeamByRank(11);
              newAssignments['gold-o2-L'] = getTeamByRank(5);
              newAssignments['gold-o2-R'] = getTeamByRank(10);
              newAssignments['gold-o3-L'] = getTeamByRank(6);
              newAssignments['gold-o3-R'] = getTeamByRank(9);
              newAssignments['gold-o4-L'] = getTeamByRank(7);
              newAssignments['gold-o4-R'] = getTeamByRank(8);
            } else if (count === 16) {
              setBracketSize(16);
              newAssignments['gold-o1-L'] = getTeamByRank(0);
              newAssignments['gold-o1-R'] = getTeamByRank(15);
              newAssignments['gold-o2-L'] = getTeamByRank(7);
              newAssignments['gold-o2-R'] = getTeamByRank(8);
              newAssignments['gold-o3-L'] = getTeamByRank(3);
              newAssignments['gold-o3-R'] = getTeamByRank(12);
              newAssignments['gold-o4-L'] = getTeamByRank(4);
              newAssignments['gold-o4-R'] = getTeamByRank(11);
              newAssignments['gold-o5-L'] = getTeamByRank(1);
              newAssignments['gold-o5-R'] = getTeamByRank(14);
              newAssignments['gold-o6-L'] = getTeamByRank(6);
              newAssignments['gold-o6-R'] = getTeamByRank(9);
              newAssignments['gold-o7-L'] = getTeamByRank(2);
              newAssignments['gold-o7-R'] = getTeamByRank(13);
              newAssignments['gold-o8-L'] = getTeamByRank(5);
              newAssignments['gold-o8-R'] = getTeamByRank(10);
            }
          };

          const buildSilverDirect = (count, goldOffset) => {
            if (count === 4) {
              newAssignments['silver-s1-L'] = getTeamByRank(goldOffset + 0);
              newAssignments['silver-s1-R'] = getTeamByRank(goldOffset + 3);
              newAssignments['silver-s2-L'] = getTeamByRank(goldOffset + 1);
              newAssignments['silver-s2-R'] = getTeamByRank(goldOffset + 2);
            } else if (count === 8) {
              newAssignments['silver-q1-L'] = getTeamByRank(goldOffset + 0);
              newAssignments['silver-q1-R'] = getTeamByRank(goldOffset + 7);
              newAssignments['silver-q2-L'] = getTeamByRank(goldOffset + 3);
              newAssignments['silver-q2-R'] = getTeamByRank(goldOffset + 4);
              newAssignments['silver-q3-L'] = getTeamByRank(goldOffset + 1);
              newAssignments['silver-q3-R'] = getTeamByRank(goldOffset + 6);
              newAssignments['silver-q4-L'] = getTeamByRank(goldOffset + 2);
              newAssignments['silver-q4-R'] = getTeamByRank(goldOffset + 5);
            } else if (count === 12) {
              newAssignments['silver-q1-L'] = getTeamByRank(goldOffset + 0);
              newAssignments['silver-q2-L'] = getTeamByRank(goldOffset + 1);
              newAssignments['silver-q3-L'] = getTeamByRank(goldOffset + 2);
              newAssignments['silver-q4-L'] = getTeamByRank(goldOffset + 3);

              newAssignments['silver-o1-L'] = getTeamByRank(goldOffset + 4);
              newAssignments['silver-o1-R'] = getTeamByRank(goldOffset + 11);
              newAssignments['silver-o2-L'] = getTeamByRank(goldOffset + 5);
              newAssignments['silver-o2-R'] = getTeamByRank(goldOffset + 10);
              newAssignments['silver-o3-L'] = getTeamByRank(goldOffset + 6);
              newAssignments['silver-o3-R'] = getTeamByRank(goldOffset + 9);
              newAssignments['silver-o4-L'] = getTeamByRank(goldOffset + 7);
              newAssignments['silver-o4-R'] = getTeamByRank(goldOffset + 8);
            } else if (count === 16) {
              newAssignments['silver-o1-L'] = getTeamByRank(goldOffset + 0);
              newAssignments['silver-o1-R'] = getTeamByRank(goldOffset + 15);
              newAssignments['silver-o2-L'] = getTeamByRank(goldOffset + 7);
              newAssignments['silver-o2-R'] = getTeamByRank(goldOffset + 8);
              newAssignments['silver-o3-L'] = getTeamByRank(goldOffset + 3);
              newAssignments['silver-o3-R'] = getTeamByRank(goldOffset + 12);
              newAssignments['silver-o4-L'] = getTeamByRank(goldOffset + 4);
              newAssignments['silver-o4-R'] = getTeamByRank(goldOffset + 11);
              newAssignments['silver-o5-L'] = getTeamByRank(goldOffset + 1);
              newAssignments['silver-o5-R'] = getTeamByRank(goldOffset + 14);
              newAssignments['silver-o6-L'] = getTeamByRank(goldOffset + 6);
              newAssignments['silver-o6-R'] = getTeamByRank(goldOffset + 9);
              newAssignments['silver-o7-L'] = getTeamByRank(goldOffset + 2);
              newAssignments['silver-o7-R'] = getTeamByRank(goldOffset + 13);
              newAssignments['silver-o8-L'] = getTeamByRank(goldOffset + 5);
              newAssignments['silver-o8-R'] = getTeamByRank(goldOffset + 10);
            }
          };

          if (phaseType === "single") {
            buildGoldDirect(bracketSize);
          } else {
            buildGoldDirect(teamsToGold);
            buildSilverDirect(teamsToSilver, teamsToGold);
          }
        } else if (phaseType === "double") {
          if (numGironi === 2) {
            setBracketSize(4);
            newAssignments['wb-s1-L'] = getTeamByRank(0);
            newAssignments['wb-s1-R'] = getTeamByRank(3);
            newAssignments['wb-s2-L'] = getTeamByRank(1);
            newAssignments['wb-s2-R'] = getTeamByRank(2);
          } else if (numGironi === 4) {
            setBracketSize(8);
            newAssignments['wb-q1-L'] = getTeamByRank(0);
            newAssignments['wb-q1-R'] = getTeamByRank(7);
            newAssignments['wb-q2-L'] = getTeamByRank(3);
            newAssignments['wb-q2-R'] = getTeamByRank(4);
            newAssignments['wb-q3-L'] = getTeamByRank(1);
            newAssignments['wb-q3-R'] = getTeamByRank(6);
            newAssignments['wb-q4-L'] = getTeamByRank(2);
            newAssignments['wb-q4-R'] = getTeamByRank(5);
          }
        }
      } else {
        // Classic "gironi" bracket fill (placements inside groups)
        if (numGironi === 1) {
            const p = (phaseType === "gold_silver" || phaseType === "single") ? "gold" : "wb";
            let size = bracketSize;
            if (phaseType === "gold_silver") {
                size = 4;
                setBracketSize(4);
            } else if (phaseType === "double") {
                size = 4;
                setBracketSize(4);
            }

            if (size === 4) {
                newAssignments[`${p}-s1-L`] = getRanked('A', 0);
                newAssignments[`${p}-s1-R`] = getRanked('A', 3);
                newAssignments[`${p}-s2-L`] = getRanked('A', 1);
                newAssignments[`${p}-s2-R`] = getRanked('A', 2);
                if (phaseType === "gold_silver") {
                    newAssignments['silver-s1-L'] = getRanked('A', 4);
                    newAssignments['silver-s1-R'] = getRanked('A', 7);
                    newAssignments['silver-s2-L'] = getRanked('A', 5);
                    newAssignments['silver-s2-R'] = getRanked('A', 6);
                }
            } else if (size === 8) {
                newAssignments[`${p}-q1-L`] = getRanked('A', 0);
                newAssignments[`${p}-q1-R`] = getRanked('A', 7);
                newAssignments[`${p}-q2-L`] = getRanked('A', 3);
                newAssignments[`${p}-q2-R`] = getRanked('A', 4);
                newAssignments[`${p}-q3-L`] = getRanked('A', 1);
                newAssignments[`${p}-q3-R`] = getRanked('A', 6);
                newAssignments[`${p}-q4-L`] = getRanked('A', 2);
                newAssignments[`${p}-q4-R`] = getRanked('A', 5);
            } else if (size === 12 || size === 16) {
                if (size === 12) {
                    newAssignments[`${p}-q1-L`] = getRanked('A', 0);
                    newAssignments[`${p}-q2-L`] = getRanked('A', 1);
                    newAssignments[`${p}-q3-L`] = getRanked('A', 2);
                    newAssignments[`${p}-q4-L`] = getRanked('A', 3);

                    newAssignments[`${p}-o1-L`] = getRanked('A', 4);
                    newAssignments[`${p}-o1-R`] = getRanked('A', 11);
                    newAssignments[`${p}-o2-L`] = getRanked('A', 5);
                    newAssignments[`${p}-o2-R`] = getRanked('A', 10);
                    newAssignments[`${p}-o3-L`] = getRanked('A', 6);
                    newAssignments[`${p}-o3-R`] = getRanked('A', 9);
                    newAssignments[`${p}-o4-L`] = getRanked('A', 7);
                    newAssignments[`${p}-o4-R`] = getRanked('A', 8);
                } else {
                    newAssignments[`${p}-o1-L`] = getRanked('A', 0);
                    newAssignments[`${p}-o1-R`] = getRanked('A', 15);
                    newAssignments[`${p}-o2-L`] = getRanked('A', 7);
                    newAssignments[`${p}-o2-R`] = getRanked('A', 8);
                    newAssignments[`${p}-o3-L`] = getRanked('A', 3);
                    newAssignments[`${p}-o3-R`] = getRanked('A', 12);
                    newAssignments[`${p}-o4-L`] = getRanked('A', 4);
                    newAssignments[`${p}-o4-R`] = getRanked('A', 11);
                    newAssignments[`${p}-o5-L`] = getRanked('A', 1);
                    newAssignments[`${p}-o5-R`] = getRanked('A', 14);
                    newAssignments[`${p}-o6-L`] = getRanked('A', 6);
                    newAssignments[`${p}-o6-R`] = getRanked('A', 9);
                    newAssignments[`${p}-o7-L`] = getRanked('A', 2);
                    newAssignments[`${p}-o7-R`] = getRanked('A', 13);
                    newAssignments[`${p}-o8-L`] = getRanked('A', 5);
                    newAssignments[`${p}-o8-R`] = getRanked('A', 10);
                }
            }
        } else if (numGironi === 2) {
            const p = (phaseType === "gold_silver" || phaseType === "single") ? "gold" : "wb";
            if (phaseType === "single" && totalSlots >= 8) {
                setBracketSize(8);
                newAssignments[`${p}-q1-L`] = getRanked("A", 0); newAssignments[`${p}-q1-R`] = getRanked("B", 3);
                newAssignments[`${p}-q2-L`] = getRanked("A", 1); newAssignments[`${p}-q2-R`] = getRanked("B", 2);
                newAssignments[`${p}-q3-L`] = getRanked("B", 0); newAssignments[`${p}-q3-R`] = getRanked("A", 3);
                newAssignments[`${p}-q4-L`] = getRanked("B", 1); newAssignments[`${p}-q4-R`] = getRanked("A", 2);
            } else {
                setBracketSize(4);
                newAssignments[`${p}-s1-L`] = getRanked("A", 0); newAssignments[`${p}-s1-R`] = getRanked("B", 1);
                newAssignments[`${p}-s2-L`] = getRanked("B", 0); newAssignments[`${p}-s2-R`] = getRanked("A", 1);
                if (phaseType === "gold_silver") {
                    newAssignments["silver-s1-L"] = getRanked("A", 2); newAssignments["silver-s1-R"] = getRanked("B", 3);
                    newAssignments["silver-s2-L"] = getRanked("B", 2); newAssignments["silver-s2-R"] = getRanked("A", 3);
                }
            }
        } else if (numGironi === 4) {
            if (phaseType === "single") {
                if (totalSlots <= 4) {
                    setBracketSize(4);
                    const usesTwoTeamsPerSide = (gConfig.teamCounts?.A || 0) >= 2 && (gConfig.teamCounts?.B || 0) >= 2;
                    if (usesTwoTeamsPerSide) {
                        newAssignments["gold-s1-L"] = getRanked("A", 0); newAssignments["gold-s1-R"] = getRanked("B", 1);
                        newAssignments["gold-s2-L"] = getRanked("B", 0); newAssignments["gold-s2-R"] = getRanked("A", 1);
                    } else {
                        newAssignments["gold-s1-L"] = getRanked("A", 0); newAssignments["gold-s1-R"] = getRanked("B", 0);
                        newAssignments["gold-s2-L"] = getRanked("C", 0); newAssignments["gold-s2-R"] = getRanked("D", 0);
                    }
                } else if (totalSlots <= 8) {
                    setBracketSize(8);
                    newAssignments["gold-q1-L"] = getRanked("A", 0); newAssignments["gold-q1-R"] = getRanked("B", 1);
                    newAssignments["gold-q2-L"] = getRanked("A", 1); newAssignments["gold-q2-R"] = getRanked("B", 0);
                    newAssignments["gold-q3-L"] = getRanked("C", 0); newAssignments["gold-q3-R"] = getRanked("D", 1);
                    newAssignments["gold-q4-L"] = getRanked("C", 1); newAssignments["gold-q4-R"] = getRanked("D", 0);
                } else {
                    setBracketSize(16);
                    // Ottavi incrociati: 1A-4B, 2A-3B, 1B-4A, 2B-3A, poi C-D.
                    newAssignments["gold-o1-L"] = getRanked("A", 0); newAssignments["gold-o1-R"] = getRanked("B", 3);
                    newAssignments["gold-o2-L"] = getRanked("A", 1); newAssignments["gold-o2-R"] = getRanked("B", 2);
                    newAssignments["gold-o3-L"] = getRanked("B", 0); newAssignments["gold-o3-R"] = getRanked("A", 3);
                    newAssignments["gold-o4-L"] = getRanked("B", 1); newAssignments["gold-o4-R"] = getRanked("A", 2);
                    newAssignments["gold-o5-L"] = getRanked("C", 0); newAssignments["gold-o5-R"] = getRanked("D", 3);
                    newAssignments["gold-o6-L"] = getRanked("C", 1); newAssignments["gold-o6-R"] = getRanked("D", 2);
                    newAssignments["gold-o7-L"] = getRanked("D", 0); newAssignments["gold-o7-R"] = getRanked("C", 3);
                    newAssignments["gold-o8-L"] = getRanked("D", 1); newAssignments["gold-o8-R"] = getRanked("C", 2);
                }
            } else {
                setBracketSize(8);
                const p = (phaseType === "gold_silver" || phaseType === "single") ? "gold" : "wb";
                newAssignments[`${p}-q1-L`] = getRanked("A", 0); newAssignments[`${p}-q1-R`] = getRanked("B", 1);
                newAssignments[`${p}-q2-L`] = getRanked("C", 0); newAssignments[`${p}-q2-R`] = getRanked("D", 1);
                newAssignments[`${p}-q3-L`] = getRanked("B", 0); newAssignments[`${p}-q3-R`] = getRanked("A", 1);
                newAssignments[`${p}-q4-L`] = getRanked("D", 0); newAssignments[`${p}-q4-R`] = getRanked("C", 1);
                if (phaseType === "gold_silver") {
                    newAssignments["silver-q1-L"] = getRanked("A", 2); newAssignments["silver-q1-R"] = getRanked("B", 3);
                    newAssignments["silver-q2-L"] = getRanked("C", 2); newAssignments["silver-q2-R"] = getRanked("D", 3);
                    newAssignments["silver-q3-L"] = getRanked("B", 2); newAssignments["silver-q3-R"] = getRanked("A", 3);
                    newAssignments["silver-q4-L"] = getRanked("D", 2); newAssignments["silver-q4-R"] = getRanked("C", 3);
                }
            }
        } else {
            alert(`Il metodo standard 'Classifica dei Gironi' supporta 1, 2 o 4 gironi. Avendo ${numGironi} gironi, seleziona il metodo 'Classifica Avulsa (Complessiva)' in fondo.`);
            return;
        }
      }
    }

    setBracketAssignments(newAssignments);
    alert(`Tabellone generato! 🏆`);
  };

  const handleSave = async () => {
    try { await persist(true); alert("Tabellone salvato."); }
    catch (error) { setSaveError(error.message); }
  };

  const handleDeleteBracket = async () => {
    if (!window.confirm("Sei sicuro di voler eliminare completamente il tabellone di questo torneo? Tutti i dati inseriti andranno persi.")) return;
    const slug = selectedTorneo.toLowerCase().trim().replace(/\s+/g, '_');
    clearTimeout(pendingTimer.current);
    try { await saveWorkflowConfig("bracket", slug, null); }
    catch (error) { setSaveError(error.message); return; }
    savedFingerprint.current = "null";
    onSummary?.({ finalsPublished: false });
    setTabellonePubblicato(false);
    setBracketAssignments({});
    setBracketMetadata({});
    setPhaseType("gold_silver");
    setSubPhaseType("direct");
    setBracketSize(8);
    setNumGoldGironiOpt(0);
    setTeamsPerGoldGirone(4);
    setNumSilverGironiOpt(0);
    setTeamsPerSilverGirone(4);
    localStorage.removeItem(`bvi_bracket_v1_${slug}`);
    alert("Tabellone eliminato con successo! 🗑️");
  };

  const renderMatch = (matchId, label, color = "blue") => {
    const meta = bracketMetadata[matchId] || {};
    return <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
      <p className={`mb-3 text-xs font-bold uppercase tracking-wider ${color === "gold" ? "text-yellow-700" : "text-slate-500"}`}>{label}</p>
      {["L", "R"].map((side) => <label key={side} className="mb-2 block text-xs text-slate-500">Squadra {side === "L" ? "1" : "2"}
        <input key={bracketAssignments[`${matchId}-${side}`] || ""} aria-label={`${label} squadra ${side === "L" ? "1" : "2"}`} defaultValue={bracketAssignments[`${matchId}-${side}`] || ""} placeholder="In attesa di qualificazione" onBlur={(e) => { if (!changeAssignment(`${matchId}-${side}`, e.target.value)) e.target.value = bracketAssignments[`${matchId}-${side}`] || ""; }} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm font-bold text-[#0a1628]" />
      </label>)}
      <p className="mt-3 text-xs text-slate-500">{[meta.court && `Campo ${meta.court}`, meta.time && `Ore ${meta.time}`].filter(Boolean).join(" · ") || "Programmazione in Partite e risultati"}</p>
      {(meta.scoreL !== undefined && meta.scoreL !== "") && <p className="mt-2 text-sm font-bold">Risultato salvato: {meta.scoreL}–{meta.scoreR}</p>}
    </div>;
  };
  const renderGroupMatch = (groupKey, index, label, left, right) => <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="mb-2 text-xs font-bold text-slate-500">{label}</p><p className="text-sm font-semibold">{left || "In attesa"} · {right || "In attesa"}</p></div>;

  const renderIntermediateGroup = (groupKey, title, color) => {
    const isPoolMode = subPhaseType === "pool_stepladder" || (subPhaseType === "custom_18" && groupKey.startsWith("pool-gold-"));
    const stats = getIntermediateGroupStats(groupKey);
    const numTeams = getTeamsCountForGroup(groupKey);
    const teams = getIntermediateGroupTeamsList(groupKey);

    const titleColor = color === "gold" ? "text-yellow-600" : "text-gray-500";
    
    const poolPairs = isPoolMode ? getPoolPairs(groupKey) : [];
    const rrPairs = !isPoolMode ? getRoundRobinPairs(numTeams) : [];

    return (
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-gray-100 mb-12">
        <h3 className={`text-xl font-black uppercase mb-6 ${titleColor}`}>{title}</h3>

        {/* Composizione Girone (Modifica manuale) */}
        <div className="mb-6 bg-gray-50 p-4 rounded-2xl border border-gray-100">
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Composizione Girone (Modifica manuale)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: numTeams }, (_, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-gray-200 font-sans">
                <span className="text-[10px] font-black text-gray-400">#{idx + 1}</span>
                <input
                  type="text"
                  key={bracketAssignments[`${groupKey}-${idx}`] || ""}
                  defaultValue={bracketAssignments[`${groupKey}-${idx}`] || ""}
                  onBlur={(e) => { if (!changeAssignment(`${groupKey}-${idx}`, e.target.value)) e.target.value = bracketAssignments[`${groupKey}-${idx}`] || ""; }}
                  className="flex-1 bg-transparent border-none text-xs font-bold focus:outline-none text-[#0a1628] w-full"
                  placeholder="Slot Libero"
                />
              </div>
            ))}
          </div>
        </div>
        
        {/* Standings Table */}
        <div className="overflow-x-auto mb-8 border border-gray-100 rounded-2xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">
              <tr>
                <th className="px-4 py-3">Pos</th>
                <th className="px-4 py-3">Squadra</th>
                {isPoolMode ? (
                  <th className="px-4 py-3">Esito Pool</th>
                ) : (
                  <>
                    <th className="px-4 py-3 text-center">V</th>
                    <th className="px-4 py-3 text-center">PF</th>
                    <th className="px-4 py-3 text-center">PS</th>
                    <th className="px-4 py-3 text-center">Quoz.</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-bold">
              {isPoolMode ? (
                stats.map((item) => (
                  <tr key={item.pos} className="hover:bg-blue-50/20">
                    <td className="px-4 py-3">
                      <span className="w-5 h-5 rounded flex items-center justify-center bg-gray-100 text-gray-500 text-[10px] font-black">
                        {item.pos}°
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-extrabold">
                      {item.nome && item.nome !== "—" && item.nome !== "Slot Libero" ? splitNames(item.nome).map(formatPlayerName).join(" - ") : (item.nome || "")}
                    </td>
                    <td className="px-4 py-3 text-blue-600 font-bold">
                      {item.note}
                    </td>
                  </tr>
                ))
              ) : (
                stats.map((team, idx) => {
                  const quotient = team.ps === 0 ? team.pf : (team.pf / team.ps).toFixed(3);
                  return (
                    <tr key={team.nome} className="hover:bg-blue-50/20">
                      <td className="px-4 py-3">
                        <span className="w-5 h-5 rounded flex items-center justify-center bg-gray-100 text-gray-500 text-[10px] font-black">
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-900">
                        {team.nome && team.nome !== "—" && team.nome !== "Slot Libero" ? splitNames(team.nome).map(formatPlayerName).join(" - ") : (team.nome || "")}
                      </td>
                      <td className="px-4 py-3 text-center text-green-600">{team.vinte}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{team.pf}</td>
                      <td className="px-4 py-3 text-center text-gray-400">{team.ps}</td>
                      <td className="px-4 py-3 text-center text-[#0a1628]">{quotient}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Matches Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {isPoolMode ? (
            poolPairs.map((pair, idx) => {
              const teamL = pair.l;
              const teamR = pair.r;
              return (
                <div key={idx}>
                  {renderGroupMatch(groupKey, idx, pair.label, teamL, teamR)}
                </div>
              );
            })
          ) : (
            rrPairs.map((pair, idx) => {
              const teamL = teams[pair.l];
              const teamR = teams[pair.r];
              if (!teamL || teamL === "—" || teamL === "Slot Libero" || !teamR || teamR === "—" || teamR === "Slot Libero") return null;
              return (
                <div key={idx}>
                  {renderGroupMatch(groupKey, idx, pair.label, teamL, teamR)}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderFinalsForGroups = (p, title, color) => {
    const isStepladder = subPhaseType === "pool_stepladder";
    // For 2-group stepladder there are no ottavi: 2° vs 3° go directly to cross-bracket quarti
    const numGroupsForPhase = p === "gold" ? (numGoldGironiOpt || 2) : (numSilverGironiOpt || 2);
    const hasOttavi = isStepladder && numGroupsForPhase >= 4;

    return (
      <div className="mb-16">
        <h3 className={`text-xl font-black uppercase mb-6 ${color==='gold'?'text-yellow-600':'text-gray-500'}`}>{title}</h3>

        {hasOttavi && (
          <>
            {/* Turno 1: Ottavi di Finale (Incontro tra i 3° Classificati) */}
            <div className="mb-8 max-w-4xl">
              <h4 className="text-[10px] font-black text-indigo-500 mb-2 uppercase tracking-widest">
                Ottavi di Finale (3° Pool 1 vs 3° Pool 2)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 block mb-1">Incontro Ottavo (3° Pool 1 vs 3° Pool 2)</span>
                  {renderMatch(`${p}-o1`, 'OTTAVO 1', color)}
                </div>
              </div>
            </div>

            {/* Turno 2: Quarti di Finale (2° Classificati vs Vincente Ottavo) */}
            <div className="mb-8 max-w-4xl">
              <h4 className="text-[10px] font-black text-blue-500 mb-2 uppercase tracking-widest">
                Quarti di Finale (2° Classificati vs Vincente Ottavo)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 block mb-1">Quarto 1 (2° Pool 1 vs Vincente Ottavo)</span>
                  {renderMatch(`${p}-q1`, 'QUARTO 1', color)}
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-400 block mb-1">Quarto 2 (2° Pool 2 vs Vincente Ottavo)</span>
                  {renderMatch(`${p}-q2`, 'QUARTO 2', color)}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Quarti a Croce (solo per 2 gironi stepladder) */}
        {isStepladder && !hasOttavi && (
          <div className="mb-8 max-w-4xl">
            <h4 className="text-[10px] font-black text-blue-500 mb-2 uppercase tracking-widest">
              Quarti di Finale (2° vs 3° a Croce — 1° va diretto in Semifinale)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div>
                <span className="text-[10px] font-bold text-gray-400 block mb-1">Quarto 1 (2° Girone A vs 3° Girone B)</span>
                {renderMatch(`${p}-q1`, 'QUARTO 1', color)}
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 block mb-1">Quarto 2 (2° Girone B vs 3° Girone A)</span>
                {renderMatch(`${p}-q2`, 'QUARTO 2', color)}
              </div>
            </div>
          </div>
        )}

        {/* Quarti di Finale (solo custom_18 gold: 2° e 3° da Pool opposte - a croce) */}
        {subPhaseType === "custom_18" && p === "gold" && (
          <div className="mb-8 max-w-4xl">
            <h4 className="text-[10px] font-black text-blue-500 mb-2 uppercase tracking-widest">
              Quarti di Finale (2° e 3° si sfidano a croce tra Pool — 1° va diretto in Semifinale)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div>
                <span className="text-[10px] font-bold text-gray-400 block mb-1">Quarto 1 (2° Pool Gold 1 vs 3° Pool Gold 2)</span>
                {renderMatch(`${p}-q1`, 'QUARTO 1', color)}
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 block mb-1">Quarto 2 (2° Pool Gold 2 vs 3° Pool Gold 1)</span>
                {renderMatch(`${p}-q2`, 'QUARTO 2', color)}
              </div>
            </div>
          </div>
        )}

        {/* Turno 3: Semifinali */}
        <div className="mb-8 max-w-4xl">
          <h4 className="text-[10px] font-black text-purple-500 mb-2 uppercase tracking-widest">
            {isStepladder
              ? "Semifinali (1° Classificati vs Vincenti Quarti)"
              : subPhaseType === "custom_18" && p === "gold"
              ? "Semifinali GOLD (1° Pool diretto + Vincente Quarto)"
              : subPhaseType === "custom_18" && p === "silver"
              ? "Semifinali SILVER (1° vs 2° Incrociati)"
              : "Semifinali"}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            <div>
              <span className="text-[10px] font-bold text-gray-400 block mb-1">
                {isStepladder
                  ? "Semifinale 1 (1° Pool 1 vs Vincente Quarto 2)"
                  : subPhaseType === "custom_18" && p === "gold"
                  ? "Semifinale 1 (1° Pool Gold 1 vs Vincente Quarto 2)"
                  : subPhaseType === "custom_18" && p === "silver"
                  ? "Semifinale 1 (1° Silver A vs 2° Silver B)"
                  : "Semifinale 1"}
              </span>
              {renderMatch(`${p}-s1`, 'SF1', color)}
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 block mb-1">
                {isStepladder
                  ? "Semifinale 2 (1° Pool 2 vs Vincente Quarto 1)"
                  : subPhaseType === "custom_18" && p === "gold"
                  ? "Semifinale 2 (1° Pool Gold 2 vs Vincente Quarto 1)"
                  : subPhaseType === "custom_18" && p === "silver"
                  ? "Semifinale 2 (1° Silver B vs 2° Silver A)"
                  : "Semifinale 2"}
              </span>
              {renderMatch(`${p}-s2`, 'SF2', color)}
            </div>
          </div>
        </div>

        {/* Turno 4: Finali */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-4xl">
          <div><h4 className="text-[10px] font-black text-red-400 mb-2 uppercase tracking-widest">Finale 3°/4° Posto</h4>{renderMatch(`${p}-f3`,'BRONZO',color)}</div>
          <div><h4 className="text-[10px] font-black text-yellow-500 mb-2 uppercase tracking-widest">Finale 1°/2° Posto</h4>{renderMatch(`${p}-f1`,'ORO',color)}</div>
        </div>
      </div>
    );
  };

  const getSectionBracketSize = (p) => {
    if (phaseType === "gold_silver" && subPhaseType === "direct") {
      return p === "gold" ? teamsToGold : teamsToSilver;
    }
    return bracketSize;
  };

  const renderSection = (p, title, color) => {
    const size = getSectionBracketSize(p);
    const hasOttavi = size === 12 || size === 16;
    const hasQuarti = size === 8 || size === 12 || size === 16;

    return (
      <div className="mb-16">
        <h3 className={`text-2xl font-black uppercase mb-8 ${color==='gold'?'text-yellow-600':color==='silver'?'text-gray-500':'text-blue-600'}`}>{title}</h3>
        
        {hasOttavi && (
          <div className="mb-10">
            <h4 className="text-[11px] font-black text-gray-400 mb-4 uppercase tracking-widest">Ottavi di finale</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 overflow-x-auto no-scrollbar">
              {Array.from({ length: size === 12 ? 4 : 8 }, (_, i) => (
                <div key={i}>
                  {renderMatch(`${p}-o${i + 1}`, `Ottavi ${i + 1}`, color)}
                </div>
              ))}
            </div>
          </div>
        )}

        {hasQuarti && (
          <div className="mb-10">
            <h4 className="text-[11px] font-black text-gray-400 mb-4 uppercase tracking-widest">Quarti di finale</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 overflow-x-auto no-scrollbar">
              {renderMatch(`${p}-q1`,'Quarti 1',color)} {renderMatch(`${p}-q2`,'Quarti 2',color)} {renderMatch(`${p}-q3`,'Quarti 3',color)} {renderMatch(`${p}-q4`,'Quarti 4',color)}
            </div>
          </div>
        )}

        <div className="mb-10">
          <h4 className="text-[11px] font-black text-gray-400 mb-4 uppercase tracking-widest">Semifinali</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-4xl">
            {renderMatch(`${p}-s1`,'S1',color)} {renderMatch(`${p}-s2`,'S2',color)}
          </div>
        </div>

        <div>
          <h4 className="text-[11px] font-black text-gray-400 mb-4 uppercase tracking-widest">Finali</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-4xl">
            <div><h4 className="text-[10px] font-black text-red-400 mb-2 uppercase tracking-widest">Finale 3°/4°</h4>{renderMatch(`${p}-f3`,'BRONZO',color)}</div>
            <div><h4 className="text-[10px] font-black text-yellow-500 mb-2 uppercase tracking-widest">Finale 1°/2°</h4>{renderMatch(`${p}-f1`,'ORO',color)}</div>
          </div>
        </div>
      </div>
    );
  };

  if (selectedGiallo) return <main className="min-h-screen bg-[#f8faff] pb-20"><StaffHeader />
    <GialloTournament tournament={selectedGiallo} editable tournaments={torneiAttivi} onSelect={setSelectedTorneo} />
  </main>;

  const Container = embedded ? "div" : "main";
  return (
    <Container className={embedded ? "text-[#0a1628]" : "min-h-screen pb-20 bg-[#f8faff]"}>
      {!embedded && <StaffHeader />}

      <div className="max-w-7xl mx-auto mt-6 md:mt-10 px-4" inert={publishing || undefined} aria-busy={publishing}>
        {!embedded && <TournamentSetupHeader step="finals" tournaments={torneiAttivi} selected={selectedTorneo} onSelect={setSelectedTorneo} />}
        {saveError && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-800">{saveError}</p>}
        <section hidden={workspaceMode === "day"} aria-label="Visibilità pubblica della fase finale" className="mb-5 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-bold">Visibilità pubblica della fase finale</h2>
          <p className="mt-2 text-sm text-slate-600">{tournament?.stato === "Concluso" ? "Torneo concluso: tabellone e risultati restano consultabili qui. " : ""}Puoi mostrarli o nasconderli al pubblico senza cambiare lo stato del torneo, i gironi o i punteggi.</p>
          <p role="status" className="my-3 text-sm font-semibold">{publishing ? "Salvataggio visibilità…" : tabellonePubblicato ? "Fase finale visibile al pubblico" : "Fase finale nascosta al pubblico"}</p>
          <button type="button" onClick={changeVisibility} disabled={!selectedTorneo || !isLoaded || publishing || resultBusy || Boolean(scoreDrafts)} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold disabled:opacity-40">{tabellonePubblicato ? "Nascondi fase finale al pubblico" : "Pubblica fase finale"}</button>
        </section>
        <nav hidden={workspaceMode !== undefined} aria-label="Modalità gestione fase finale" className="mb-5 flex flex-wrap gap-2">
          {[{ id: "setup", label: "Configurazione tabellone" }, { id: "results", label: "Partite e risultati" }].map((mode) => <button key={mode.id} type="button" aria-pressed={entryMode === mode.id} disabled={resultBusy} onClick={() => switchMode(mode.id)} className={`rounded-xl border px-5 py-3 text-sm font-bold ${entryMode === mode.id ? "border-[#0a1628] bg-[#0a1628] text-white" : "border-slate-200 bg-white"}`}>{mode.label}</button>)}
        </nav>
        <section hidden={effectiveEntryMode !== "results"} aria-label="Partite e risultati della fase finale">
          {isLoaded ? <MatchScoreEntry groups={scoringGroups} contextLabel="Risultati della fase finale" selectorLabel="Scegli il turno" emptyMessage="Il tabellone non è ancora generato. Apri Configurazione tabellone per preparare gli abbinamenti." disabled={resultBusy || publishing} onDirtyChange={setScoreDrafts} onSave={recordScore} onSaveDetails={recordDetails} onClear={(game) => recordScore(game, null)} /> : <p role="status">Caricamento partite…</p>}
        </section>
        <div hidden={effectiveEntryMode !== "setup"}>
          <FinalsSetupPanel config={currentConfig} onChange={changeSetting} disabled={!isLoaded || resultBusy || publishing} onGenerate={handleAutoFill} onSave={handleSave} onDelete={handleDeleteBracket} onResults={() => switchMode("results")} hasBracket={Object.keys(bracketAssignments).length > 0} />
          <details className="mt-5 rounded-2xl border border-slate-200 bg-white p-5" open><summary className="cursor-pointer font-bold">Anteprima e correzione abbinamenti</summary><p className="my-3 text-sm text-slate-500">I risultati si inseriscono nella vista Partite e risultati. Le correzioni ai partecipanti si applicano quando esci dal campo e chiedono conferma se annullano risultati dipendenti.</p>

        {!isLoaded ? (
            <div className="min-h-[400px] flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-[#0a1628] border-t-transparent rounded-full animate-spin"></div>
            </div>
        ) : torneiAttivi.length === 0 ? (
            <div className="bg-white p-12 md:p-24 rounded-[3.5rem] shadow-2xl border border-gray-100 text-center relative overflow-hidden mt-10">
                <div className="relative z-10">
                    <div className="text-9xl mb-10 inline-block">🏆</div>
                    <h3 className="text-3xl md:text-5xl font-black text-[#0a1628] uppercase tracking-tighter mb-6">Nessun torneo selezionato</h3>
                    <p className="text-gray-400 mb-12 max-w-lg mx-auto text-sm md:text-lg font-bold uppercase tracking-widest leading-relaxed">
                        Seleziona un torneo nella gestione. Puoi consultare anche i tabelloni dei tornei conclusi.
                    </p>
                </div>
            </div>
        ) : phaseType === "double" ? (
            <div className="space-y-16">
                {finalMatchGroups(currentConfig).map((round) => <section key={round.id}><h3 className="mb-4 text-xl font-bold">{round.label}</h3><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{round.matches.map((game) => <div key={game.id}>{renderMatch(game.id, game.label)}</div>)}</div></section>)}
            </div>
        ) : phaseType === "single" ? (
            <div className="space-y-16">
                {renderSection("gold", "🏆 Tabellone Eliminazione Diretta", "blue")}
            </div>
        ) : (subPhaseType === "groups" || subPhaseType === "pool_stepladder" || subPhaseType === "custom_18") ? (
            <div className="space-y-16">
                <section>
                  <h2 className="text-2xl md:text-4xl font-black text-yellow-600 uppercase tracking-tighter mb-8">🏆 Gironi Intermedi GOLD</h2>

                  {/* Classifica Avulsa Iniziale Gold (solo custom_18) */}
                  {subPhaseType === "custom_18" && (() => {
                    const classifica = getClassificaAvulsaGoldCustom18();
                    if (classifica.length === 0) return null;
                    return (
                      <div className="mb-10 bg-white rounded-[2rem] border border-yellow-100 shadow-lg overflow-hidden">
                        <div className="bg-gradient-to-r from-yellow-500 to-amber-400 px-6 py-4 flex items-center gap-3">
                          <span className="text-2xl">📊</span>
                          <div>
                            <h3 className="text-white font-black text-sm uppercase tracking-widest">Classifica Avulsa Iniziale Gold</h3>
                            <p className="text-yellow-100 text-[10px] font-bold uppercase tracking-widest">Base per la composizione dei 4 Gironi Gold</p>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-yellow-50">
                              <tr>
                                <th className="px-4 py-2 text-left font-black text-yellow-700 uppercase tracking-widest">#</th>
                                <th className="px-4 py-2 text-left font-black text-yellow-700 uppercase tracking-widest">Squadra</th>
                                <th className="px-4 py-2 text-center font-black text-yellow-700 uppercase tracking-widest">Provenienza</th>
                                <th className="px-4 py-2 text-center font-black text-yellow-700 uppercase tracking-widest">Pt</th>
                                <th className="px-4 py-2 text-center font-black text-yellow-700 uppercase tracking-widest">PF</th>
                                <th className="px-4 py-2 text-center font-black text-yellow-700 uppercase tracking-widest">PS</th>
                                <th className="px-4 py-2 text-center font-black text-yellow-700 uppercase tracking-widest">Quoz.</th>
                                <th className="px-4 py-2 text-center font-black text-yellow-700 uppercase tracking-widest">Assegnata a</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {classifica.map((team, idx) => {
                                const quotient = team.ps === 0 ? team.pf : (team.pf / team.ps).toFixed(3);
                                // Determina il girone Gold assegnato basandosi sull'ordine
                                const goldGironeMap = [
                                  "Gold A", "Gold B", "Gold C", "Gold D",
                                  "Gold D", "Gold C", "Gold B", "Gold A",
                                  "Gold A", "Gold B", "Gold C", "Gold D"
                                ];
                                const goldGirone = goldGironeMap[idx] || "—";
                                const isFirst6 = idx < 6;
                                return (
                                  <tr key={team.nome} className={`hover:bg-yellow-50/30 ${idx === 5 ? 'border-b-2 border-dashed border-yellow-200' : ''}`}>
                                    <td className="px-4 py-2">
                                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                                        isFirst6 ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-500'
                                      }`}>{team.rank}</span>
                                    </td>
                                    <td className="px-4 py-2 font-bold text-gray-900 max-w-[160px] truncate">
                                      {splitNames(team.nome).map(formatPlayerName).join(" - ")}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                        isFirst6 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'
                                      }`}>{team.pos} {team.girone}</span>
                                    </td>
                                    <td className="px-4 py-2 text-center font-bold text-blue-600">{team.punti}</td>
                                    <td className="px-4 py-2 text-center text-gray-600">{team.pf}</td>
                                    <td className="px-4 py-2 text-center text-gray-400">{team.ps}</td>
                                    <td className="px-4 py-2 text-center text-gray-700 font-mono">{quotient}</td>
                                    <td className="px-4 py-2 text-center">
                                      <span className="px-2 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-700 uppercase">{goldGirone}</span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}
                  {Array.from({ length: numGoldGironi }, (_, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const groupKey = `gold-${letter}`;
                    return (
                      <div key={groupKey}>
                        {renderIntermediateGroup(groupKey, `Girone Gold ${letter}`, "gold")}
                      </div>
                    );
                  })}
                  
                  {subPhaseType === "custom_18" && (
                    <div className="mt-12 space-y-12">
                      <h2 className="text-2xl md:text-3xl font-black text-amber-600 uppercase tracking-tighter border-t border-amber-100 pt-8">🔥 Gironi POOL GOLD (Prime e Seconde dei Gironi Intermedi)</h2>
                      {renderIntermediateGroup("pool-gold-1", "Girone POOL Gold 1", "gold")}
                      {renderIntermediateGroup("pool-gold-2", "Girone POOL Gold 2", "gold")}
                    </div>
                  )}

                  {renderFinalsForGroups("gold", "Fasi Finali GOLD 🏆", "gold")}
                </section>

                <div className="border-t-4 border-dashed border-gray-200 my-16"></div>

                <section>
                  <h2 className="text-2xl md:text-4xl font-black text-gray-500 uppercase tracking-tighter mb-8">🥈 Gironi Intermedi SILVER</h2>
                  {Array.from({ length: numSilverGironi }, (_, i) => {
                    const letter = String.fromCharCode(65 + i);
                    const groupKey = `silver-${letter}`;
                    return (
                      <div key={groupKey}>
                        {renderIntermediateGroup(groupKey, `Girone Silver ${letter}`, "silver")}
                      </div>
                    );
                  })}
                  {renderFinalsForGroups("silver", "Fasi Finali SILVER 🥈", "silver")}
                </section>
            </div>
        ) : (
            <div className="space-y-16">
                {renderSection("gold", "🏆 Tabellone GOLD (Eliminazione Diretta)", "gold")}
                <div className="border-t-4 border-dashed border-gray-100 my-10"></div>
                {renderSection("silver", "🥈 Tabellone SILVER (Eliminazione Diretta)", "silver")}
            </div>
        )}
          </details>
        </div>
      </div>
    </Container>
  );
}
export default function TeamFinals(props) {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Caricamento...</div>}>
      <TabelloneContent {...props} />
    </Suspense>
  );
}
