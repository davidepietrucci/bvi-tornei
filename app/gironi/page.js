"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { getTornei, getGironi, getBracket, getIscrizioni, syncAssignmentsWithIscrizioni } from "@/app/utils/db";
import { calculateUnifiedRanking, getSchedule as getScheduleShared } from "@/app/utils/ranking";
import SponsorBanner from "@/app/components/SponsorBanner";

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

export default function GironiPubblici() {
  const [tornei, setTornei] = useState([]);
  const [selectedTorneo, setSelectedTorneo] = useState("");
  const [config, setConfig] = useState(null);
  const [bracketConfig, setBracketConfig] = useState(null);
  const [activeTab, setActiveTab] = useState("gironi"); // "gironi", "partite", "classifica", "finali"
  const [fasiFinaliCategory, setFasiFinaliCategory] = useState("gold"); // "gold" or "silver"
  const [viewMode, setViewMode] = useState("cronologico"); // "cronologico" or "girone"
  const [loading, setLoading] = useState(true);

  // 1. Carica l'elenco dei tornei e determina quello da visualizzare
  useEffect(() => {
    getTornei().then((parsed) => {
      setTornei(parsed);

      const params = new URLSearchParams(window.location.search);
      const urlTour = params.get("tour");

      if (urlTour && parsed.some((t) => t.nome === urlTour)) {
        setSelectedTorneo(urlTour);
      } else {
        // Cerca tornei attivi per primi
        const attivi = parsed.filter(
          (t) => t.stato === "Iscrizioni Aperte" || t.stato === "In Programmazione"
        );
        if (attivi.length > 0) {
          setSelectedTorneo(attivi[0].nome);
        } else if (parsed.length > 0) {
          setSelectedTorneo(parsed[0].nome);
        }
      }
      setLoading(false);
    });
  }, []);

  // 2. Caricamento live dei gironi e dei bracket del torneo selezionato
  useEffect(() => {
    if (!selectedTorneo) return;
    const slug = selectedTorneo.toLowerCase().trim().replace(/\s+/g, "_");

    const fetchLive = () => {
      Promise.all([getGironi(slug), getBracket(slug), getIscrizioni()]).then(([gData, bData, iscData]) => {
        if (gData) {
          const syncedGAssignments = syncAssignmentsWithIscrizioni(gData.gironeAssignments || {}, iscData || []);
          setConfig({ ...gData, gironeAssignments: syncedGAssignments });
        } else {
          setConfig(null);
        }

        if (bData) {
          const syncedBAssignments = syncAssignmentsWithIscrizioni(bData.bracketAssignments || {}, iscData || []);
          setBracketConfig({ ...bData, bracketAssignments: syncedBAssignments });
        } else {
          setBracketConfig(null);
        }
      });
    };

    fetchLive();
    const interval = setInterval(fetchLive, 10000);
    return () => clearInterval(interval);
  }, [selectedTorneo]);

  const selectedTorneoObj = tornei.find((t) => t.nome === selectedTorneo);
  const isConcluso = selectedTorneoObj?.stato === "Concluso";
  const isPublished = config && config.pubblicato;
  const isBracketPublished = bracketConfig && bracketConfig.tabellonePubblicato;
  const rankingType = config?.rankingType || "avulsa";

  // 3. Calcola la lista dei gironi iniziali
  const getInitialGroupsList = (currentConfig = config) => {
    const list = [];
    if (currentConfig && currentConfig.numGironi) {
      for (let i = 0; i < currentConfig.numGironi; i++) {
        const label = String.fromCharCode(65 + i);
        list.push({ id: label, label: `Girone ${label}`, type: "iniziale" });
      }
    }
    return list;
  };

  const parseTimeToMinutes = (timeStr) => {
    if (!timeStr) return Infinity; // Put untimed matches at the end
    const parts = timeStr.trim().split(":");
    if (parts.length < 2) return Infinity;
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (isNaN(hours) || isNaN(minutes)) return Infinity;
    return hours * 60 + minutes;
  };

  const sortMatchesChronologically = (matches) => {
    return [...matches].sort((a, b) => {
      const timeA = parseTimeToMinutes(a.meta?.time);
      const timeB = parseTimeToMinutes(b.meta?.time);
      if (timeA !== timeB) return timeA - timeB;
      const courtA = parseInt(a.meta?.court) || 0;
      const courtB = parseInt(b.meta?.court) || 0;
      return courtA - courtB;
    });
  };

  const getAllInitialMatches = () => {
    const initialGroups = getInitialGroupsList();
    let all = [];
    initialGroups.forEach((group) => {
      const schedule = getScheduleFixed(
        config?.teamCounts?.[group.id] || 0,
        group.id,
        config?.gironeAssignments?.[group.id] || {}
      );
      schedule.forEach((m, idx) => {
        all.push({
          left: m.left,
          right: m.right,
          meta: config?.matchMetadata?.[`${group.id}-${idx}`] || {},
          gironeId: group.id,
          idx: idx
        });
      });
    });
    return all;
  };

  // 4. Calcola la lista dei gironi intermedi (Gold/Silver) se presenti
  const getIntermediateGroupsList = () => {
    const list = [];
    if (
      bracketConfig &&
      bracketConfig.phaseType === "gold_silver" &&
      (bracketConfig.subPhaseType === "groups" || bracketConfig.subPhaseType === "pool_stepladder" || bracketConfig.subPhaseType === "custom_18")
    ) {
      let goldSlots = 0;
      let silverSlots = 0;
      if (config && config.numGironi) {
        for (let i = 0; i < config.numGironi; i++) {
          const gid = String.fromCharCode(65 + i);
          const count = config.teamCounts?.[gid] || 0;
          goldSlots += Math.min(2, count);
          silverSlots += Math.min(2, Math.max(0, count - 2));
        }
      }
      const autoNumGoldGironi = goldSlots > 4 ? 2 : 1;
      const autoNumSilverGironi = silverSlots > 4 ? 2 : 1;

      const numGoldGironi = bracketConfig.numGoldGironi !== undefined && bracketConfig.numGoldGironi !== 0 ? bracketConfig.numGoldGironi : autoNumGoldGironi;
      const numSilverGironi = bracketConfig.numSilverGironi !== undefined && bracketConfig.numSilverGironi !== 0 ? bracketConfig.numSilverGironi : autoNumSilverGironi;

      if (bracketConfig.subPhaseType === "custom_18") {
        list.push({ id: `gold-A`, label: `Gold A 🏆`, type: "intermedio", category: "gold" });
        list.push({ id: `gold-B`, label: `Gold B 🏆`, type: "intermedio", category: "gold" });
        list.push({ id: `gold-C`, label: `Gold C 🏆`, type: "intermedio", category: "gold" });
        list.push({ id: `gold-D`, label: `Gold D 🏆`, type: "intermedio", category: "gold" });
        list.push({ id: `pool-gold-1`, label: `POOL Gold 1 🔥`, type: "intermedio", category: "gold" });
        list.push({ id: `pool-gold-2`, label: `POOL Gold 2 🔥`, type: "intermedio", category: "gold" });

        list.push({ id: `silver-A`, label: `Silver A 🥈`, type: "intermedio", category: "silver" });
        list.push({ id: `silver-B`, label: `Silver B 🥈`, type: "intermedio", category: "silver" });
      } else {
        for (let i = 0; i < numGoldGironi; i++) {
          const letter = String.fromCharCode(65 + i);
          list.push({ id: `gold-${letter}`, label: `Gold ${letter} 🏆`, type: "intermedio", category: "gold" });
        }
        for (let i = 0; i < numSilverGironi; i++) {
          const letter = String.fromCharCode(65 + i);
          list.push({ id: `silver-${letter}`, label: `Silver ${letter} 🥈`, type: "intermedio", category: "silver" });
        }
      }
    }
    return list;
  };

  // Logica per il calendario incontri
  const getSchedule = (numTeams, gironeId, assignments = {}) => {
    return getScheduleShared(numTeams, gironeId, assignments, config?.gironeTypes, config?.gironeSets, config?.matchMetadata);
  };

  // Fix fontName typo
  const getScheduleFixed = (numTeams, gironeId, assignments = {}) => {
    return getScheduleShared(numTeams, gironeId, assignments, config?.gironeTypes, config?.gironeSets, config?.matchMetadata);
  };

  const getGroupTeams = (groupId, type) => {
    if (type === "intermedio") {
      if (!bracketConfig || !bracketConfig.bracketAssignments) return [];
      const assignments = bracketConfig.bracketAssignments;
      const isGold = groupId.startsWith("gold");
      const numTeams = isGold 
        ? (bracketConfig.teamsPerGoldGirone || 4) 
        : (bracketConfig.teamsPerSilverGirone || 4);
      const teams = [];
      for (let i = 0; i < numTeams; i++) {
        teams.push(assignments[`${groupId}-${i}`]);
      }
      return teams.filter((t) => t && t !== "—" && t !== "Slot Libero");
    } else {
      if (!config || !config.gironeAssignments || !config.gironeAssignments[groupId]) return [];
      const assignments = config.gironeAssignments[groupId];
      const teamCount = config.teamCounts[groupId] || 0;
      const list = [];
      for (let i = 0; i < teamCount; i++) {
        const name = assignments[i];
        if (name && name !== "—" && name !== "Slot Libero") {
          list.push(name);
        }
      }
      return list;
    }
  };

  const calculateRanking = (groupId) => {
    if (!config || !config.gironeAssignments || !config.gironeAssignments[groupId]) return [];

    const assignments = config.gironeAssignments[groupId];
    const teamCount = config.teamCounts[groupId] || 0;
    const metadata = config.matchMetadata || {};
    const isThreeSets = config.gironeSets?.[groupId] === "3 set";

    const stats = {};
    for (let i = 0; i < teamCount; i++) {
      const name = assignments[i];
      if (name && name !== "—" && name !== "Slot Libero") {
        stats[name] = {
          nome: name,
          giocate: 0,
          vinte: 0,
          perse: 0,
          puntiFatti: 0,
          puntiSubiti: 0,
          score: 0,
        };
      }
    }

    const schedule = getScheduleFixed(teamCount, groupId, assignments);
    schedule.forEach((match, i) => {
      const meta = metadata[`${groupId}-${i}`];
      if (!meta) return;

      const teamL = match.left;
      const teamR = match.right;

      if (!stats[teamL] || !stats[teamR]) return;

      const s1L = parseInt(meta.s1L || 0),
        s1R = parseInt(meta.s1R || 0);
      const s2L = parseInt(meta.s2L || 0),
        s2R = parseInt(meta.s2R || 0);
      const s3L = parseInt(meta.s3L || 0),
        s3R = parseInt(meta.s3R || 0);
      if (s1L === 0 && s1R === 0) return;

      stats[teamL].giocate++;
      stats[teamR].giocate++;
      stats[teamL].puntiFatti += s1L + s2L + s3L;
      stats[teamL].puntiSubiti += s1R + s2R + s3R;
      stats[teamR].puntiFatti += s1R + s2R + s3R;
      stats[teamR].puntiSubiti += s1L + s2L + s3L;

      let matchWinL = 0;
      if (isThreeSets) {
        let setsL = 0,
          setsR = 0;
        if (s1L > s1R) setsL++;
        else if (s1R > s1L) setsR++;
        if (s2L > s2R) setsL++;
        else if (s2R > s2L) setsR++;
        if (s3L > s3R) setsL++;
        else if (s3R > s3L) setsR++;
        matchWinL = setsL > setsR ? 1 : 0;
      } else {
        matchWinL = s1L > s1R ? 1 : 0;
      }
      if (matchWinL) {
        stats[teamL].vinte++;
        stats[teamL].score++;
        stats[teamR].perse++;
      } else {
        stats[teamR].vinte++;
        stats[teamR].score++;
        stats[teamL].perse++;
      }
    });

    return Object.values(stats).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const qzTeamA = a.puntiSubiti === 0 ? a.puntiFatti : a.puntiFatti / a.puntiSubiti;
      const qzTeamB = b.puntiSubiti === 0 ? b.puntiFatti : b.puntiFatti / b.puntiSubiti;
      return qzTeamB - qzTeamA;
    });
  };

  const getIntermediateGroupMatches = (groupKey) => {
    if (!bracketConfig || !bracketConfig.bracketAssignments) return [];
    const assignments = bracketConfig.bracketAssignments;
    const metadata = bracketConfig.bracketMetadata || {};

    const getMatchTeams = (matchId) => {
      let left = assignments[`${matchId}-L`];
      let right = assignments[`${matchId}-R`];

      if (!left || !right) {
        const poolMatch = matchId.match(/^([a-z]+-[A-Z0-9]+)-m([0-4])$/);
        if (poolMatch) {
          const gKey = poolMatch[1];
          const mNum = parseInt(poolMatch[2]);
          if (mNum === 0) {
            left = left || assignments[`${gKey}-0`];
            right = right || assignments[`${gKey}-1`];
          } else if (mNum === 1) {
            left = left || assignments[`${gKey}-2`];
            right = right || assignments[`${gKey}-3`];
          } else if (mNum === 2) {
            left = left || resolveWinner(`${gKey}-m0`);
            right = right || resolveWinner(`${gKey}-m1`);
          } else if (mNum === 3) {
            left = left || resolveLoser(`${gKey}-m0`);
            right = right || resolveLoser(`${gKey}-m1`);
          } else if (mNum === 4) {
            left = left || resolveLoser(`${gKey}-m2`);
            right = right || resolveWinner(`${gKey}-m3`);
          }
        }
      }
      return { left, right };
    };

    const resolveWinner = (matchId) => {
      const { left, right } = getMatchTeams(matchId);
      if (!left && !right) return null;
      if (left === "—" && right && right !== "—") return right;
      if (right === "—" && left && left !== "—") return left;
      const meta = metadata[matchId] || {};
      const scoreL = parseInt(meta.scoreL || 0);
      const scoreR = parseInt(meta.scoreR || 0);
      if (scoreL === 0 && scoreR === 0) return null;
      return scoreL > scoreR ? left : right;
    };

    const resolveLoser = (matchId) => {
      const { left, right } = getMatchTeams(matchId);
      if (!left && !right) return null;
      if (left === "—" && right && right !== "—") return "—";
      if (right === "—" && left && left !== "—") return "—";
      const meta = metadata[matchId] || {};
      const scoreL = parseInt(meta.scoreL || 0);
      const scoreR = parseInt(meta.scoreR || 0);
      if (scoreL === 0 && scoreR === 0) return null;
      return scoreL > scoreR ? right : left;
    };

    if (bracketConfig.subPhaseType === "pool_stepladder" || groupKey.startsWith("pool-gold-")) {
      const t0 = assignments[`${groupKey}-0`];
      const t1 = assignments[`${groupKey}-1`];
      const t2 = assignments[`${groupKey}-2`];
      const t3 = assignments[`${groupKey}-3`];

      const isGold = groupKey.startsWith("gold");

      const winM0 = resolveWinner(`${groupKey}-m0`);
      const winM1 = resolveWinner(`${groupKey}-m1`);
      const losM0 = resolveLoser(`${groupKey}-m0`);
      const losM1 = resolveLoser(`${groupKey}-m1`);

      const winM2 = resolveWinner(`${groupKey}-m2`);
      const losM2 = resolveLoser(`${groupKey}-m2`);
      const winM3 = resolveWinner(`${groupKey}-m3`);
      const losM3 = resolveLoser(`${groupKey}-m3`);

      let poolPairs = [];
      if (groupKey.startsWith("pool-gold-")) {
        const isPool1 = groupKey.endsWith("-1");
        poolPairs = [
          { label: `Gara 1 (${isPool1 ? '1°A vs 2°B' : '1°B vs 2°A'})`, l: t0, r: t1, matchId: `${groupKey}-m0` },
          { label: `Gara 2 (${isPool1 ? '1°C vs 2°D' : '1°D vs 2°C'})`, l: t2, r: t3, matchId: `${groupKey}-m1` },
          { label: "Gara 3 (Vincenti ➔ 1°/2° Pool)", l: winM0 || "Vincente Gara 1", r: winM1 || "Vincente Gara 2", matchId: `${groupKey}-m2` },
          { label: "Gara 4 (Perdenti ➔ 3°/4° Pool)", l: losM0 || "Perdente Gara 1", r: losM1 || "Perdente Gara 2", matchId: `${groupKey}-m3` },
        ];
      } else {
        poolPairs = [
          { label: `Gara 1 (${isGold ? '1°A vs 2°B' : '3°A vs 4°B'})`, l: t0, r: t1, matchId: `${groupKey}-m0` },
          { label: `Gara 2 (${isGold ? '1°C vs 2°D' : '3°C vs 4°D'})`, l: t2, r: t3, matchId: `${groupKey}-m1` },
          { label: "Gara 3 (Vincenti ➔ 1°/2° Pool)", l: winM0 || "Vincente Gara 1", r: winM1 || "Vincente Gara 2", matchId: `${groupKey}-m2` },
          { label: "Gara 4 (Perdenti ➔ 3°/4° Pool)", l: losM0 || "Perdente Gara 1", r: losM1 || "Perdente Gara 2", matchId: `${groupKey}-m3` },
        ];
      }

      return poolPairs.map((p) => ({
        label: p.label,
        left: p.l,
        right: p.r,
        meta: metadata[p.matchId] || {},
      }));
    }

    const isGold = groupKey.startsWith("gold");
    const numTeams = isGold 
      ? (bracketConfig.teamsPerGoldGirone || 4) 
      : (bracketConfig.teamsPerSilverGirone || 4);

    const teams = [];
    for (let i = 0; i < numTeams; i++) {
      teams.push(assignments[`${groupKey}-${i}`]);
    }

    const getRoundRobinPairs = (n) => {
      const pairs = [];
      let count = 1;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          pairs.push({ l: i, r: j, label: `Gara ${count++}` });
        }
      }
      return pairs;
    };

    const matchPairs = getRoundRobinPairs(numTeams);

    return matchPairs
      .map((pair, idx) => {
        const teamL = teams[pair.l];
        const teamR = teams[pair.r];
        const mKey = `${groupKey}-m${idx}`;
        return {
          label: pair.label,
          left: teamL,
          right: teamR,
          meta: metadata[mKey] || {},
        };
      })
      .filter(
        (m) =>
          m.left &&
          m.left !== "—" &&
          m.left !== "Slot Libero" &&
          m.right &&
          m.right !== "—" &&
          m.right !== "Slot Libero"
      );
  };

  // Restituisce la lista di partite playoff lineare
  const getPlayoffMatchesList = () => {
    if (!bracketConfig || !bracketConfig.bracketAssignments) return [];
    const assignments = bracketConfig.bracketAssignments;
    const metadata = bracketConfig.bracketMetadata || {};
    const list = [];

    const getMatchData = (id, label) => {
      const left = assignments[`${id}-L`] || "TBD";
      const right = assignments[`${id}-R`] || "TBD";
      const meta = metadata[id] || {};
      return { id, label, left, right, meta };
    };

    const isMatchCompleted = (matchId) => {
      const left = assignments[`${matchId}-L`];
      const right = assignments[`${matchId}-R`];
      if (!left && !right) return false;
      if (left === "—" || right === "—") return true;
      if (!left || !right || left.startsWith("TBD") || right.startsWith("TBD")) return false;
      if (left === "Slot Libero" || right === "Slot Libero") return false;
      const meta = metadata[matchId] || {};
      return meta.scoreL !== undefined && meta.scoreL !== "" && meta.scoreR !== undefined && meta.scoreR !== "";
    };

    const isRoundCompleted = (matchIds) => {
      return matchIds.every(id => isMatchCompleted(id));
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

    const areIntermediateGroupsCompleted = (prefix, numGroups, teamsPerGroup) => {
      const isPoolMode = bracketConfig.subPhaseType === "pool_stepladder";
      for (let g = 0; g < numGroups; g++) {
        const letter = String.fromCharCode(65 + g);
        const groupKey = `${prefix}-${letter}`;
        if (isPoolMode) {
          const m2Done = isMatchCompleted(`${groupKey}-m2`);
          const m4Done = isMatchCompleted(`${groupKey}-m4`);
          if (!m2Done || !m4Done) return false;
        } else {
          const numTeams = teamsPerGroup || 4;
          const pairs = getRoundRobinPairs(numTeams);
          for (let m = 0; m < pairs.length; m++) {
            const pair = pairs[m];
            const teamL = assignments[`${groupKey}-${pair.l}`];
            const teamR = assignments[`${groupKey}-${pair.r}`];
            if (!teamL || teamL === "—" || teamL === "Slot Libero" || !teamR || teamR === "—" || teamR === "Slot Libero") {
              continue;
            }
            const matchId = `${groupKey}-m${m}`;
            const meta = metadata[matchId] || {};
            const hasScore = meta.scoreL !== undefined && meta.scoreL !== "" && meta.scoreR !== undefined && meta.scoreR !== "";
            if (!hasScore) return false;
          }
        }
      }
      return true;
    };

    if (bracketConfig.phaseType === "gold_silver" || bracketConfig.phaseType === "single") {
      const isGroups = bracketConfig.phaseType === "gold_silver" && (
        bracketConfig.subPhaseType === "groups" || 
        bracketConfig.subPhaseType === "pool_stepladder" || 
        bracketConfig.subPhaseType === "custom_18"
      );
      if (isGroups) {
        // --- GROUPS FLOW ---
        let goldSlots = 0;
        let silverSlots = 0;
        if (config && config.numGironi) {
          for (let i = 0; i < config.numGironi; i++) {
            const gid = String.fromCharCode(65 + i);
            const count = config.teamCounts?.[gid] || 0;
            goldSlots += Math.min(2, count);
            silverSlots += Math.min(2, Math.max(0, count - 2));
          }
        }
        const autoNumGoldGironi = goldSlots > 4 ? 2 : 1;
        const autoNumSilverGironi = silverSlots > 4 ? 2 : 1;

        const numGoldGironi = bracketConfig.subPhaseType === "custom_18" ? 4 : (bracketConfig.numGoldGironi !== undefined && bracketConfig.numGoldGironi !== 0 ? bracketConfig.numGoldGironi : autoNumGoldGironi);
        const numSilverGironi = bracketConfig.subPhaseType === "custom_18" ? 2 : (bracketConfig.numSilverGironi !== undefined && bracketConfig.numSilverGironi !== 0 ? bracketConfig.numSilverGironi : autoNumSilverGironi);
        const teamsPerGoldGirone = bracketConfig.subPhaseType === "custom_18" ? 3 : (bracketConfig.teamsPerGoldGirone || 4);
        const teamsPerSilverGirone = bracketConfig.subPhaseType === "custom_18" ? 3 : (bracketConfig.teamsPerSilverGirone || 4);

        const isRealTeamName = (nameStr) => {
          if (!nameStr) return false;
          const s = String(nameStr).trim().toLowerCase();
          if (
            s === "" ||
            s === "—" ||
            s === "tbd" ||
            s === "slot libero" ||
            s.startsWith("tbd") ||
            s.startsWith("vincente") ||
            s.startsWith("perdente") ||
            /^[0-9]+[°a-z]/.test(s) ||
            s.includes("gold-") ||
            s.includes("silver-") ||
            s.includes("quarto") ||
            s.includes("ottavo") ||
            s.includes("semifinale")
          ) {
            return false;
          }
          return true;
        };

        const hasRealNames = (matches) => {
          return matches.some(m => isRealTeamName(m.left) || isRealTeamName(m.right));
        };

        const isStepladder = bracketConfig.subPhaseType === "pool_stepladder";

        const goldGroupsDone = areIntermediateGroupsCompleted("gold", numGoldGironi, teamsPerGoldGirone);
        const goldQuartiDone = isRoundCompleted(isStepladder ? ["gold-q1", "gold-q2"] : ["gold-q1", "gold-q2", "gold-q3", "gold-q4"]);
        const goldSemifinalsDone = isRoundCompleted(["gold-s1", "gold-s2"]);

        const silverGroupsDone = areIntermediateGroupsCompleted("silver", numSilverGironi, teamsPerSilverGirone);
        const silverQuartiDone = isRoundCompleted(isStepladder ? ["silver-q1", "silver-q2"] : ["silver-q1", "silver-q2", "silver-q3", "silver-q4"]);
        const silverSemifinalsDone = isRoundCompleted(["silver-s1", "silver-s2"]);

        // Gold rounds
        if (isStepladder) {
          const oMatches = [getMatchData("gold-o1", "Incontro Ottavo (3° Pool 1 vs 3° Pool 2)")];
          if (numGoldGironi >= 4 && (goldGroupsDone || hasRealNames(oMatches))) {
            list.push({ title: "Ottavi Gold (3° Classificati) 🏆", matches: oMatches });
          }
          const qMatches = [
            getMatchData("gold-q1", numGoldGironi >= 4 ? "Quarto 1" : "Quarto 1 (2° Girone A vs 3° Girone B)"),
            getMatchData("gold-q2", numGoldGironi >= 4 ? "Quarto 2" : "Quarto 2 (2° Girone B vs 3° Girone A)")
          ];
          if (goldGroupsDone || hasRealNames(qMatches)) {
            list.push({ 
              title: numGoldGironi >= 4 ? "Quarti Gold (2° Classificati) 🏆" : "Quarti Gold (2° vs 3° a Croce) 🏆", 
              matches: qMatches 
            });
          }
        }

        const sGoldMatches = [getMatchData("gold-s1", "Semifinale 1"), getMatchData("gold-s2", "Semifinale 2")];
        if (goldGroupsDone || goldQuartiDone || hasRealNames(sGoldMatches)) {
          list.push({ title: "Semifinali Gold 🏆", matches: sGoldMatches });
        }

        const fGoldMatches = [getMatchData("gold-f3", "Finale 3°/4° Posto"), getMatchData("gold-f1", "Finale 1°/2° Posto")];
        if (goldSemifinalsDone || hasRealNames(fGoldMatches)) {
          list.push({ title: "Finali Gold 🏆", matches: fGoldMatches });
        }

        // Silver rounds
        if (isStepladder) {
          const sOMatches = [getMatchData("silver-o1", "Incontro Ottavo (3° Pool 1 vs 3° Pool 2)")];
          if (numSilverGironi >= 4 && (silverGroupsDone || hasRealNames(sOMatches))) {
            list.push({ title: "Ottavi Silver (3° Classificati) 🥈", matches: sOMatches });
          }
          const sQMatches = [
            getMatchData("silver-q1", numSilverGironi >= 4 ? "Quarto 1" : "Quarto 1 (2° Girone A vs 3° Girone B)"),
            getMatchData("silver-q2", numSilverGironi >= 4 ? "Quarto 2" : "Quarto 2 (2° Girone B vs 3° Girone A)")
          ];
          if (silverGroupsDone || hasRealNames(sQMatches)) {
            list.push({ 
              title: numSilverGironi >= 4 ? "Quarti Silver (2° Classificati) 🥈" : "Quarti Silver (2° vs 3° a Croce) 🥈", 
              matches: sQMatches 
            });
          }
          const sSMatches = [getMatchData("silver-s1", "Semifinale 1"), getMatchData("silver-s2", "Semifinale 2")];
          if (silverGroupsDone || silverQuartiDone || hasRealNames(sSMatches)) {
            list.push({ title: "Semifinali Silver 🥈", matches: sSMatches });
          }
        } else if (bracketConfig.subPhaseType !== "custom_18") {
          const sSMatches = [getMatchData("silver-s1", "Semifinale 1"), getMatchData("silver-s2", "Semifinale 2")];
          if (silverGroupsDone || silverQuartiDone || hasRealNames(sSMatches)) {
            list.push({ title: "Semifinali Silver 🥈", matches: sSMatches });
          }
        }

        const fSilverMatches = [getMatchData("silver-f3", "Finalina 3°/4° Posto Silver"), getMatchData("silver-f1", "Finale 1°/2° Posto Silver")];
        if (silverSemifinalsDone || hasRealNames(fSilverMatches)) {
          list.push({ title: "Finali Silver 🥈", matches: fSilverMatches });
        }
      } else {
        // --- DIRECT FLOW ---
        const tToGold = bracketConfig.phaseType === "single" ? (bracketConfig.bracketSize || 8) : (bracketConfig.teamsToGold || 8);
        const tToSilver = bracketConfig.teamsToSilver || 8;

        const isRealTeamName = (nameStr) => {
          if (!nameStr) return false;
          const s = String(nameStr).trim().toLowerCase();
          if (
            s === "" ||
            s === "—" ||
            s === "tbd" ||
            s === "slot libero" ||
            s.startsWith("tbd") ||
            s.startsWith("vincente") ||
            s.startsWith("perdente") ||
            /^[0-9]+[°a-z]/.test(s) ||
            s.includes("gold-") ||
            s.includes("silver-") ||
            s.includes("quarto") ||
            s.includes("ottavo") ||
            s.includes("semifinale")
          ) {
            return false;
          }
          return true;
        };

        const hasRealNames = (matches) => {
          return matches.some(m => isRealTeamName(m.left) || isRealTeamName(m.right));
        };

        const goldOttaviMatches = tToGold === 16 
          ? ["gold-o1", "gold-o2", "gold-o3", "gold-o4", "gold-o5", "gold-o6", "gold-o7", "gold-o8"]
          : tToGold === 12 
          ? ["gold-o1", "gold-o2", "gold-o3", "gold-o4"]
          : [];
        const goldQuartiMatches = ["gold-q1", "gold-q2", "gold-q3", "gold-q4"];
        const goldSemifinaliMatches = ["gold-s1", "gold-s2"];

        const goldOttaviDone = goldOttaviMatches.length === 0 || isRoundCompleted(goldOttaviMatches);
        const goldQuartiDone = isRoundCompleted(goldQuartiMatches);
        const goldSemifinaliDone = isRoundCompleted(goldSemifinaliMatches);

        const silverOttaviMatches = tToSilver === 16 
          ? ["silver-o1", "silver-o2", "silver-o3", "silver-o4", "silver-o5", "silver-o6", "silver-o7", "silver-o8"]
          : tToSilver === 12 
          ? ["silver-o1", "silver-o2", "silver-o3", "silver-o4"]
          : [];
        const silverQuartiMatches = ["silver-q1", "silver-q2", "silver-q3", "silver-q4"];
        const silverSemifinaliMatches = ["silver-s1", "silver-s2"];

        const silverOttaviDone = silverOttaviMatches.length === 0 || isRoundCompleted(silverOttaviMatches);
        const silverQuartiDone = isRoundCompleted(silverQuartiMatches);
        const silverSemifinaliDone = isRoundCompleted(silverSemifinaliMatches);

        // Gold additions
        if (tToGold === 12 || tToGold === 16) {
          const oMatches = tToGold === 16 
            ? [
                getMatchData("gold-o1", "Ottavo 1"), getMatchData("gold-o2", "Ottavo 2"),
                getMatchData("gold-o3", "Ottavo 3"), getMatchData("gold-o4", "Ottavo 4"),
                getMatchData("gold-o5", "Ottavo 5"), getMatchData("gold-o6", "Ottavo 6"),
                getMatchData("gold-o7", "Ottavo 7"), getMatchData("gold-o8", "Ottavo 8")
              ]
            : [
                getMatchData("gold-o1", "Ottavo 1"), getMatchData("gold-o2", "Ottavo 2"),
                getMatchData("gold-o3", "Ottavo 3"), getMatchData("gold-o4", "Ottavo 4")
              ];
          if (hasRealNames(oMatches)) {
            list.push({ title: bracketConfig.phaseType === "single" ? "Ottavi di Finale 🏆" : "Ottavi Gold 🏆", matches: oMatches });
          }
        }

        if (tToGold >= 8) {
          const qMatches = [
            getMatchData("gold-q1", "Quarto 1"), getMatchData("gold-q2", "Quarto 2"),
            getMatchData("gold-q3", "Quarto 3"), getMatchData("gold-q4", "Quarto 4")
          ];
          if (goldOttaviDone || hasRealNames(qMatches)) {
            list.push({ title: bracketConfig.phaseType === "single" ? "Quarti di Finale 🏆" : "Quarti Gold 🏆", matches: qMatches });
          }
        }

        if (tToGold >= 4) {
          const sMatches = [getMatchData("gold-s1", "Semifinale 1"), getMatchData("gold-s2", "Semifinale 2")];
          if ((tToGold === 4) || (goldOttaviDone && goldQuartiDone) || hasRealNames(sMatches)) {
            list.push({ title: bracketConfig.phaseType === "single" ? "Semifinali 🏆" : "Semifinali Gold 🏆", matches: sMatches });
          }
        }

        const fMatches = [getMatchData("gold-f3", "Finale 3°/4° Posto"), getMatchData("gold-f1", "Finale 1°/2° Posto")];
        if (goldSemifinaliDone || hasRealNames(fMatches)) {
          list.push({ title: bracketConfig.phaseType === "single" ? "Finali 🏆" : "Finali Gold 🏆", matches: fMatches });
        }

        // Silver additions
        if (bracketConfig.phaseType !== "single") {
          if (tToSilver === 12 || tToSilver === 16) {
            const sOMatches = tToSilver === 16 
              ? [
                  getMatchData("silver-o1", "Ottavo 1"), getMatchData("silver-o2", "Ottavo 2"),
                  getMatchData("silver-o3", "Ottavo 3"), getMatchData("silver-o4", "Ottavo 4"),
                  getMatchData("silver-o5", "Ottavo 5"), getMatchData("silver-o6", "Ottavo 6"),
                  getMatchData("silver-o7", "Ottavo 7"), getMatchData("silver-o8", "Ottavo 8")
                ]
              : [
                  getMatchData("silver-o1", "Ottavo 1"), getMatchData("silver-o2", "Ottavo 2"),
                  getMatchData("silver-o3", "Ottavo 3"), getMatchData("silver-o4", "Ottavo 4")
                ];
            if (hasRealNames(sOMatches)) {
              list.push({ title: "Ottavi Silver 🥈", matches: sOMatches });
            }
          }

          if (tToSilver >= 8) {
            const sQMatches = [
              getMatchData("silver-q1", "Quarto 1"), getMatchData("silver-q2", "Quarto 2"),
              getMatchData("silver-q3", "Quarto 3"), getMatchData("silver-q4", "Quarto 4")
            ];
            if (silverOttaviDone || hasRealNames(sQMatches)) {
              list.push({ title: "Quarti Silver 🥈", matches: sQMatches });
            }
          }

          if (tToSilver >= 4) {
            const sSMatches = [getMatchData("silver-s1", "Semifinale 1"), getMatchData("silver-s2", "Semifinale 2")];
            if ((tToSilver === 4) || (silverOttaviDone && silverQuartiDone) || hasRealNames(sSMatches)) {
              list.push({ title: "Semifinali Silver 🥈", matches: sSMatches });
            }
          }

          const sFMatches = [getMatchData("silver-f3", "Finale 3°/4° Posto"), getMatchData("silver-f1", "Finale 1°/2° Posto")];
          if (silverSemifinaliDone || hasRealNames(sFMatches)) {
            list.push({ title: "Finali Silver 🥈", matches: sFMatches });
          }
        }
      }
    } else {
      // Doppia Eliminazione
      const wbQuarti = ["wb-q1", "wb-q2", "wb-q3", "wb-q4"];
      const wbSemifinali = ["wb-s1", "wb-s2"];
      const wbFinale = ["wb-f"];
      const lbSemifinali = ["lb-s1", "lb-s2"];
      const lbFinale = ["lb-f"];

      const wbQuartiDone = bracketConfig.bracketSize !== 8 || isRoundCompleted(wbQuarti);
      const wbSemifinaliDone = isRoundCompleted(wbSemifinali);
      const wbFinaleDone = isRoundCompleted(wbFinale);
      const lbSemifinaliDone = isRoundCompleted(lbSemifinali);
      const lbFinaleDone = isRoundCompleted(lbFinale);

      if (bracketConfig.bracketSize === 8) {
        list.push({
          title: "Quarti Vincenti (Winners QF) 🏆",
          matches: [
            getMatchData("wb-q1", "Winners Quarto 1"),
            getMatchData("wb-q2", "Winners Quarto 2"),
            getMatchData("wb-q3", "Winners Quarto 3"),
            getMatchData("wb-q4", "Winners Quarto 4"),
          ],
        });
      }
      if (wbQuartiDone) {
        list.push({
          title: "Semifinali Vincenti (Winners SF) 🏆",
          matches: [getMatchData("wb-s1", "Winners Semifinale 1"), getMatchData("wb-s2", "Winners Semifinale 2")],
        });
      }
      if (wbQuartiDone && wbSemifinaliDone) {
        list.push({
          title: "Finale Vincenti (Winners Final) 🏆",
          matches: [getMatchData("wb-f", "Finale Vincenti")],
        });
        list.push({
          title: "Semifinali Perdenti (Losers SF) 🔄",
          matches: [getMatchData("lb-s1", "Losers Semifinale 1"), getMatchData("lb-s2", "Losers Semifinale 2")],
        });
      }
      if (wbQuartiDone && wbSemifinaliDone && lbSemifinaliDone) {
        list.push({
          title: "Finale Perdenti (Losers Final) 🔄",
          matches: [getMatchData("lb-f", "Finale Perdenti")],
        });
      }
      if (wbQuartiDone && wbSemifinaliDone && lbSemifinaliDone && wbFinaleDone && lbFinaleDone) {
        list.push({ title: "Grand Final 👑", matches: [getMatchData("grand-final", "Finalissima")] });
      }
    }

    return list.filter((group) => group.matches.some((m) => m.left !== "TBD" || m.right !== "TBD"));
  };





  // Rendering del singolo blocco partita SofaScore
  const renderMatchRow = (teamL, teamR, meta, idx, matchKeyPrefix, gironeId = null, matchLabel = null) => {
    const isPlayoffMatch = !gironeId;
    const scoreL = isPlayoffMatch 
      ? parseInt(meta?.scoreL || 0) 
      : parseInt(meta?.s1L || meta?.scoreL || 0);
    const scoreR = isPlayoffMatch 
      ? parseInt(meta?.scoreR || 0) 
      : parseInt(meta?.s1R || meta?.scoreR || 0);
    const hasScore = isPlayoffMatch
      ? (meta?.scoreL !== undefined && meta?.scoreL !== "")
      : ((meta?.s1L !== undefined && meta?.s1L !== "") || (meta?.scoreL !== undefined && meta?.scoreL !== ""));

    // Altri set per partite a 3 set
    const s2L = parseInt(meta?.s2L || 0);
    const s2R = parseInt(meta?.s2R || 0);
    const s3L = parseInt(meta?.s3L || 0);
    const s3R = parseInt(meta?.s3R || 0);
    const isThreeSets = gironeId ? config?.gironeSets?.[gironeId] === "3 set" : false;

    const isMultiSetPlayoff = isPlayoffMatch && (bracketConfig?.phaseType === "gold_silver" || bracketConfig?.phaseType === "single") && (
      (matchLabel && (matchLabel.startsWith("Quarto") || matchLabel.startsWith("Semifinale") || matchLabel.startsWith("Finale"))) ||
      (matchKeyPrefix && (matchKeyPrefix.includes("Semifinali") || matchKeyPrefix.includes("Finali") || matchKeyPrefix.includes("Quarti")))
    );

    let isWinnerL = false;
    let isWinnerR = false;
    if (hasScore && (scoreL > 0 || scoreR > 0)) {
      if (isThreeSets) {
        let winL = 0,
          winR = 0;
        const s1L = parseInt(meta?.s1L || 0);
        const s1R = parseInt(meta?.s1R || 0);
        if (s1L > s1R) winL++;
        else if (s1R > s1L) winR++;
        if (s2L > s2R) winL++;
        else if (s2R > s2L) winR++;
        if (s3L > s3R) winL++;
        else if (s3R > s3L) winR++;
        isWinnerL = winL > winR;
        isWinnerR = winR > winL;
      } else {
        isWinnerL = scoreL > scoreR;
        isWinnerR = scoreR > scoreL;
      }
    }

    const namesL = splitNames(teamL).map(formatPlayerName);
    const namesR = splitNames(teamR).map(formatPlayerName);

    const getFontSizeClass = (namesArray) => {
      const maxL = Math.max(...namesArray.map((n) => n.length));
      if (maxL > 20) return "text-[13px] sm:text-[15px]";
      if (maxL > 15) return "text-[14px] sm:text-[16px]";
      if (maxL > 10) return "text-[15px] sm:text-[17px]";
      return "text-[16px] sm:text-[18px]";
    };

    const fontSizeL = getFontSizeClass(namesL);
    const fontSizeR = getFontSizeClass(namesR);

    const showResultsColors = hasScore && (scoreL > 0 || scoreR > 0);

    return (
      <div
        key={idx}
        id={`${matchKeyPrefix}-${idx}`}
        className="bg-white rounded-[1.6rem] p-5 border border-gray-100 shadow-sm flex flex-col gap-3 transition-all"
      >
        <div className="flex justify-between items-center text-[10px] sm:text-[11px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-2">
          <span>{matchLabel || (gironeId ? `Girone ${gironeId.replace("gold-", "Gold ").replace("silver-", "Silver ")}` : `Gara ${idx + 1}`)}</span>
          <div className="flex gap-1.5">
            {meta?.time && (
              <span className="bg-gray-50 text-gray-500 px-3 py-1 rounded-lg text-[10px] font-bold">{meta.time}</span>
            )}
            {meta?.court && (
              <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg font-black text-[10px]">
                Campo {meta.court}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 py-1.5">
          {/* Team Left */}
          <div className="flex-1 text-right min-w-0 pr-1">
            <span
              className={`font-bold break-words leading-tight block ${fontSizeL} ${
                showResultsColors
                  ? isWinnerL
                    ? "text-green-700 font-black"
                    : "text-red-600 font-bold"
                  : "text-gray-700 font-bold"
              }`}
            >
              {namesL.map((name, pIdx) => (
                <span key={pIdx} className="block">
                  {name}
                </span>
              ))}
            </span>
          </div>

          {/* Score Badge */}
          <div className="shrink-0 flex flex-col items-center justify-center min-w-[70px]">
            {hasScore && (scoreL > 0 || scoreR > 0) && (
              <span className="text-[10px] font-black text-black uppercase tracking-wider mb-1.5">
                Finita
              </span>
            )}
            {hasScore && (scoreL > 0 || scoreR > 0) ? (
              <div className="text-[#0a1628] font-black text-base sm:text-lg flex items-center gap-1.5">
                <span>{scoreL}</span>
                <span className="opacity-40">-</span>
                <span>{scoreR}</span>
              </div>
            ) : (
              <span className="text-[10px] font-black bg-gray-50 text-gray-400 px-3.5 py-2 rounded-xl uppercase tracking-wider border border-gray-100">
                VS
              </span>
            )}
            {isThreeSets && hasScore && (scoreL > 0 || scoreR > 0) && (
              <span className="text-[10px] font-bold text-gray-400 mt-1">
                ({s2L}-{s2R}, {s3L}-{s3R})
              </span>
            )}
            {isMultiSetPlayoff && hasScore && (scoreL > 0 || scoreR > 0) && (
              <span className="text-[10px] font-bold text-gray-400 mt-1">
                ({meta?.s1L || 0}-{meta?.s1R || 0}, {meta?.s2L || 0}-{meta?.s2R || 0}{meta?.s3L || meta?.s3R ? `, ${meta.s3L || 0}-${meta.s3R || 0}` : ''})
              </span>
            )}
          </div>

          {/* Team Right */}
          <div className="flex-1 text-left min-w-0 pl-1">
            <span
              className={`font-bold break-words leading-tight block ${fontSizeR} ${
                showResultsColors
                  ? isWinnerR
                    ? "text-green-700 font-black"
                    : "text-red-600 font-bold"
                  : "text-gray-700 font-bold"
              }`}
            >
              {namesR.map((name, pIdx) => (
                <span key={pIdx} className="block">
                  {name}
                </span>
              ))}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const getTournamentBgImage = (torneoObj, torneoNome) => {
    if (torneoObj?.sfondo) return torneoObj.sfondo;
    const cat = (torneoObj?.categoria || "").toLowerCase();
    const nome = (torneoNome || "").toLowerCase();
    if (cat.includes("femminile") || nome.includes("femminile") || nome === "prova") {
      return "/images/femminile-bg.jpg";
    }
    if (cat.includes("maschile") || nome.includes("maschile")) {
      return "/images/maschile-bg.jpg";
    }
    return null;
  };
  const bgImage = getTournamentBgImage(selectedTorneoObj, selectedTorneo);

  return (
    <main className="min-h-screen bg-[#f0f4ff] pb-24 relative">
      {bgImage && (
        <div 
          className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center bg-no-repeat"
          style={{ 
            backgroundImage: `url('${bgImage}')`,
            opacity: 0.32,
            filter: "contrast(1.05) brightness(0.95)"
          }}
        />
      )}
      <div className="relative z-10">
      {/* Header Mobile Premium con Info Torneo */}
      <header
        style={{ backgroundColor: "#0a1628" }}
        className="text-white py-3 px-4 flex justify-between items-center shadow-md border-b-4 border-[#FFD700] sticky top-0 z-50 gap-3"
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <Image src="/logo.png" alt="BVI Logo" width={34} height={34} className="rounded-full shrink-0" />
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm font-black tracking-tight uppercase leading-tight text-[#FFD700] truncate">
                {selectedTorneo || "Nessun Torneo"}
              </h1>
              {isConcluso ? (
                <span className="px-2 py-0.5 rounded-full text-[8px] font-black bg-gray-700 text-gray-300 uppercase tracking-wider shrink-0">
                  Concluso 🏁
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[8px] font-black bg-green-500/20 text-green-400 border border-green-500/30 uppercase tracking-wider shrink-0 animate-pulse">
                  Torneo Attivo 🟢
                </span>
              )}
            </div>
            {(selectedTorneoObj?.categoria || selectedTorneoObj?.data) && (
              <p className="text-[9px] text-gray-300 font-bold uppercase tracking-wider leading-none mt-0.5 truncate">
                {[selectedTorneoObj?.categoria, selectedTorneoObj?.data].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <a
          href="/"
          className="text-[9px] font-black bg-[#FFD700] text-[#0a1628] px-3.5 py-1.5 rounded-xl transition-transform active:scale-95 shadow-sm uppercase tracking-wider shrink-0"
        >
          Home
        </a>
      </header>

      <div className="max-w-md mx-auto px-4 pt-2 space-y-4">
        {/* Banner Sponsor */}
        <SponsorBanner />

        {/* Controllo Pubblicazione */}
        {isPublished ? (
          <>
            {/* 1. SEZIONE GIRONI (COMPOSIZIONE SQUADRE INIZIALI) */}
            {activeTab === "gironi" && (
              <div className="space-y-5">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">
                  Composizione Gironi
                </h3>
                <div className="space-y-4">
                  {getInitialGroupsList().map((group) => {
                    const teams = getGroupTeams(group.id, group.type);
                    return (
                      <div
                        key={group.id}
                        className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm"
                      >
                        <h4 className="text-sm font-black text-[#0a1628] uppercase tracking-tight border-b border-gray-50 pb-3 mb-3 flex items-center justify-between">
                          <span>{group.label}</span>
                          <span className="text-[9px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                            {teams.length} Squadre
                          </span>
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead className="bg-gray-50/50 border-b border-gray-100 text-[8px] font-black text-gray-400 uppercase tracking-widest">
                              <tr>
                                <th className="pl-4 py-3 w-10 text-center">Pos</th>
                                <th className="px-2 py-3">Squadra</th>
                                <th className="px-2 py-3 text-center w-8">V</th>
                                <th className="px-2 py-3 text-center w-10">PF</th>
                                <th className="px-2 py-3 text-center w-10">PS</th>
                                <th className="pr-4 py-3 text-right w-12">Quoz.</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 text-xs font-bold">
                              {calculateRanking(group.id).map((team, idx) => {
                                const isQualified = idx < 2;
                                const quotient = team.puntiSubiti === 0 ? team.puntiFatti : (team.puntiFatti / team.puntiSubiti).toFixed(3);
                                return (
                                  <tr
                                    key={team.nome}
                                    className={`hover:bg-blue-50/10 transition-colors ${
                                      isQualified ? "bg-yellow-50/10" : ""
                                    }`}
                                  >
                                    <td className="pl-4 py-3.5 text-center">
                                      <span
                                        className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-[10px] font-black mx-auto ${
                                          isQualified
                                            ? "bg-yellow-400 text-white shadow-sm"
                                            : "bg-gray-100 text-gray-400"
                                        }`}
                                      >
                                        {idx + 1}
                                      </span>
                                    </td>
                                    <td className="px-2 py-3.5 text-[#0a1628] font-black tracking-tight leading-tight text-[13px] sm:text-[14px]">
                                      {splitNames(team.nome).map(formatPlayerName).map((player, pIdx) => (
                                        <span key={pIdx} className="block truncate max-w-[140px]">
                                          {player}
                                        </span>
                                      ))}
                                    </td>
                                    <td className="px-2 py-3.5 text-center text-green-600 font-bold">
                                      {team.vinte}
                                    </td>
                                    <td className="px-2 py-3.5 text-center text-gray-600">
                                      {team.puntiFatti}
                                    </td>
                                    <td className="px-2 py-3.5 text-center text-gray-400">
                                      {team.puntiSubiti}
                                    </td>
                                    <td className="pr-4 py-3.5 text-right font-black text-xs text-[#0a1628]">
                                      {quotient}
                                    </td>
                                  </tr>
                                );
                              })}
                              {calculateRanking(group.id).length === 0 && (
                                <tr>
                                  <td colSpan="6" className="py-8 text-center text-gray-400 italic">
                                    Nessuna squadra in questo girone.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                  {getInitialGroupsList().length === 0 && (
                    <div className="bg-white rounded-3xl p-6 text-center border border-gray-100">
                      <p className="text-gray-400 italic text-xs">Nessun girone configurato.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. SEZIONE PARTITE (CALENDARIO CRONOLOGICO / PER GIRONE INIZIALE) */}
            {activeTab === "partite" && (
              <div className="space-y-6">
                {/* Toggle Selettore Vista */}
                <div className="flex bg-gray-200/60 p-1 rounded-2xl max-w-xs mx-auto border border-gray-100/50 shadow-inner mb-6">
                  <button
                    onClick={() => setViewMode("cronologico")}
                    className={`flex-1 py-2 text-center rounded-xl font-black text-[10px] uppercase tracking-wider transition-all ${
                      viewMode === "cronologico"
                        ? "bg-[#0a1628] text-white shadow-md"
                        : "text-gray-400 hover:text-[#0a1628]"
                    }`}
                  >
                    Cronologico 📅
                  </button>
                  <button
                    onClick={() => setViewMode("girone")}
                    className={`flex-1 py-2 text-center rounded-xl font-black text-[10px] uppercase tracking-wider transition-all ${
                      viewMode === "girone"
                        ? "bg-[#0a1628] text-white shadow-md"
                        : "text-gray-400 hover:text-[#0a1628]"
                    }`}
                  >
                    Per Girone 📋
                  </button>
                </div>

                {viewMode === "cronologico" ? (
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 border-l-4 border-[#FFD700] pl-2 mb-2">
                      Calendario Incontri (Ordine Cronologico)
                    </h3>
                    <div className="space-y-3">
                      {sortMatchesChronologically(getAllInitialMatches()).map((m, sortedIdx) =>
                        renderMatchRow(
                          m.left,
                          m.right,
                          m.meta,
                          sortedIdx,
                          `match-${m.gironeId}`,
                          m.gironeId
                        )
                      )}
                      {getAllInitialMatches().length === 0 && (
                        <div className="bg-white rounded-3xl p-6 text-center border border-gray-100">
                          <p className="text-gray-400 italic text-xs">Nessun match programmato.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {getInitialGroupsList().map((group) => {
                      const groupMatches = getScheduleFixed(
                        config?.teamCounts?.[group.id] || 0,
                        group.id,
                        config?.gironeAssignments?.[group.id] || {}
                      ).map((m, idx) => ({
                        left: m.left,
                        right: m.right,
                        meta: config?.matchMetadata?.[`${group.id}-${idx}`] || {},
                      }));

                      return (
                        <div key={group.id} className="space-y-3">
                          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 border-l-4 border-[#FFD700] pl-2">
                            Partite {group.label}
                          </h3>
                          <div className="space-y-3">
                            {groupMatches.map((m, idx) =>
                              renderMatchRow(
                                m.left,
                                m.right,
                                m.meta,
                                idx,
                                `match-${group.id}`,
                                group.id
                              )
                            )}
                            {groupMatches.length === 0 && (
                              <div className="bg-white rounded-3xl p-6 text-center border border-gray-100">
                                <p className="text-gray-400 italic text-xs">Nessun match programmato.</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 3. SEZIONE CLASSIFICHE (TABELLE VERTICALI INIZIALI) */}
            {activeTab === "classifica" && (
              <div className="space-y-6">
                {rankingType === "avulsa" ? (
                  <>
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 border-l-4 border-yellow-400 pl-2">
                      Classifica Generale Complessiva Torneo
                    </h3>
                    <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[320px]">
                          <thead className="bg-gray-50/50 border-b border-gray-100 text-[8px] font-black text-gray-400 uppercase tracking-widest">
                            <tr>
                              <th className="pl-4 py-3 w-10 text-center">Pos</th>
                              <th className="px-2 py-3">Squadra</th>
                              <th className="px-2 py-3 text-center w-12">Girone</th>
                              <th className="px-2 py-3 text-center w-8">V</th>
                              <th className="px-2 py-3 text-center w-10">PF</th>
                              <th className="px-2 py-3 text-center w-10">PS</th>
                              <th className="pr-4 py-3 text-right w-16">Quoz.</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 text-xs font-bold">
                            {calculateUnifiedRanking(config).map((team, idx) => {
                              const quotient = team.puntiSubiti === 0 ? team.puntiFatti : (team.puntiFatti / team.puntiSubiti).toFixed(3);
                              const isGold = idx < 12; // first 12 qualify to Gold
                              const isGoldDirect = idx < 4; // top 4 get bye
                              return (
                                <tr
                                  key={team.nome}
                                  className={`hover:bg-blue-50/10 transition-colors ${
                                    isGold ? "bg-yellow-50/10" : "bg-slate-50/20"
                                  }`}
                                >
                                  <td className="pl-4 py-3.5 text-center">
                                    <span
                                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black mx-auto ${
                                        isGoldDirect
                                          ? "bg-yellow-400 text-white shadow-sm"
                                          : isGold
                                          ? "bg-yellow-100 text-yellow-700"
                                          : "bg-gray-100 text-gray-400"
                                      }`}
                                    >
                                      {idx + 1}
                                    </span>
                                  </td>
                                  <td className="px-2 py-3.5 text-[#0a1628] font-black tracking-tight leading-tight text-[13px] sm:text-[14px]">
                                    {splitNames(team.nome).map(formatPlayerName).map((player, pIdx) => (
                                      <span key={pIdx} className="block truncate max-w-[200px]">
                                        {player}
                                      </span>
                                    ))}
                                  </td>
                                  <td className="px-2 py-3.5 text-center">
                                    <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-lg bg-blue-50 text-blue-600 border border-blue-100/50">
                                      {team.girone}
                                    </span>
                                  </td>
                                  <td className="px-2 py-3.5 text-center text-green-600 font-bold">
                                    {team.vinte}
                                  </td>
                                  <td className="px-2 py-3.5 text-center text-gray-500">
                                    {team.puntiFatti}
                                  </td>
                                  <td className="px-2 py-3.5 text-center text-gray-400">
                                    {team.puntiSubiti}
                                  </td>
                                  <td className="pr-4 py-3.5 text-right text-[#0a1628] font-mono text-[10px]">
                                    {quotient}
                                  </td>
                                </tr>
                              );
                            })}
                            {(!config || calculateUnifiedRanking(config).length === 0) && (
                              <tr>
                                <td colSpan="7" className="py-20 text-center text-gray-400 italic">
                                  Nessuna squadra configurata o nessun risultato disponibile.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 border-l-4 border-blue-600 pl-2">
                      Classifiche dei Gironi
                    </h3>
                    <div className="space-y-4">
                      {getInitialGroupsList().map((group) => {
                        const teams = getGroupTeams(group.id, group.type);
                        return (
                          <div
                            key={group.id}
                            className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm"
                          >
                            <h4 className="text-sm font-black text-[#0a1628] uppercase tracking-tight border-b border-gray-50 pb-3 mb-3 flex items-center justify-between">
                              <span>{group.label}</span>
                              <span className="text-[9px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg uppercase tracking-wider">
                                {teams.length} Squadre
                              </span>
                            </h4>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left">
                                <thead className="bg-gray-50/50 border-b border-gray-100 text-[8px] font-black text-gray-400 uppercase tracking-widest">
                                  <tr>
                                    <th className="pl-4 py-3 w-10 text-center">Pos</th>
                                    <th className="px-2 py-3">Squadra</th>
                                    <th className="px-2 py-3 text-center w-8">V</th>
                                    <th className="px-2 py-3 text-center w-10">PF</th>
                                    <th className="px-2 py-3 text-center w-10">PS</th>
                                    <th className="pr-4 py-3 text-right w-12">Quoz.</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 text-xs font-bold">
                                  {calculateRanking(group.id).map((team, idx) => {
                                    const isQualified = idx < 2;
                                    const quotient = team.puntiSubiti === 0 ? team.puntiFatti : (team.puntiFatti / team.puntiSubiti).toFixed(3);
                                    return (
                                      <tr
                                        key={team.nome}
                                        className={`hover:bg-blue-50/10 transition-colors ${
                                          isQualified ? "bg-yellow-50/10" : ""
                                        }`}
                                      >
                                        <td className="pl-4 py-3.5 text-center">
                                          <span
                                            className={`w-5.5 h-5.5 rounded-full flex items-center justify-center text-[10px] font-black mx-auto ${
                                              isQualified
                                                ? "bg-yellow-400 text-white shadow-sm"
                                                : "bg-gray-100 text-gray-400"
                                            }`}
                                          >
                                            {idx + 1}
                                          </span>
                                        </td>
                                        <td className="px-2 py-3.5 text-[#0a1628] font-black tracking-tight leading-tight text-[13px] sm:text-[14px]">
                                          {splitNames(team.nome).map(formatPlayerName).map((player, pIdx) => (
                                            <span key={pIdx} className="block truncate max-w-[140px]">
                                              {player}
                                            </span>
                                          ))}
                                        </td>
                                        <td className="px-2 py-3.5 text-center text-green-600 font-bold">
                                          {team.vinte}
                                        </td>
                                        <td className="px-2 py-3.5 text-center text-gray-600">
                                          {team.puntiFatti}
                                        </td>
                                        <td className="px-2 py-3.5 text-center text-gray-400">
                                          {team.puntiSubiti}
                                        </td>
                                        <td className="pr-4 py-3.5 text-right font-black text-xs text-[#0a1628]">
                                          {quotient}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  {calculateRanking(group.id).length === 0 && (
                                    <tr>
                                      <td colSpan="6" className="py-8 text-center text-gray-400 italic">
                                        Nessuna squadra in questo girone.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 4. SEZIONE FASI FINALI */}
            {activeTab === "finali" && isBracketPublished && (
              <div className="space-y-5">
                {/* Switch Gold / Silver in alto (se Gold/Silver) */}
                {bracketConfig?.phaseType === "gold_silver" && (
                  <div className="flex bg-gray-200/60 p-1 rounded-2xl max-w-xs mx-auto border border-gray-100/50 shadow-inner">
                    <button
                      onClick={() => setFasiFinaliCategory("gold")}
                      className={`flex-1 py-2 text-center rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
                        fasiFinaliCategory === "gold"
                          ? "bg-[#0a1628] text-white shadow-md"
                          : "text-gray-400 hover:text-[#0a1628]"
                      }`}
                    >
                      Gold 🏆
                    </button>
                    <button
                      onClick={() => setFasiFinaliCategory("silver")}
                      className={`flex-1 py-2 text-center rounded-xl font-black text-xs uppercase tracking-wider transition-all ${
                        fasiFinaliCategory === "silver"
                          ? "bg-[#0a1628] text-white shadow-md"
                          : "text-gray-400 hover:text-[#0a1628]"
                      }`}
                    >
                      Silver 🥈
                    </button>
                  </div>
                )}

                {/* Partite Gironi Intermedi (se Gold/Silver a gironi) */}
                {bracketConfig?.phaseType === "gold_silver" &&
                  getIntermediateGroupsList()
                    .filter((g) => g.category === fasiFinaliCategory)
                    .map((group) => {
                      const groupMatches = getIntermediateGroupMatches(group.id);
                      return (
                        <div key={group.id} className="space-y-3">
                          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1 border-l-4 border-[#FFD700] pl-2">
                            Partite {group.label}
                          </h4>
                          <div className="space-y-3">
                            {groupMatches.map((m, idx) =>
                              renderMatchRow(
                                m.left,
                                m.right,
                                m.meta,
                                idx,
                                `match-${group.id}`,
                                group.id,
                                m.label
                              )
                            )}
                            {groupMatches.length === 0 && (
                              <div className="bg-white rounded-3xl p-6 text-center border border-gray-100">
                                <p className="text-gray-400 italic text-xs">
                                  Nessun match programmato.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                {/* Partite Playoff */}
                {getPlayoffMatchesList().filter((group) => {
                  if (bracketConfig?.phaseType === "gold_silver") {
                    return group.title.toLowerCase().includes(fasiFinaliCategory);
                  }
                  return true;
                }).length > 0 ? (
                  getPlayoffMatchesList()
                    .filter((group) => {
                      if (bracketConfig?.phaseType === "gold_silver") {
                        return group.title.toLowerCase().includes(fasiFinaliCategory);
                      }
                      return true;
                    })
                    .map((group, gIdx) => (
                      <div key={gIdx} className="space-y-3 animate-fade-in">
                        <h3 className="text-[9px] font-black text-gray-400 uppercase tracking-widest pl-1 border-b pb-2">
                          {group.title}
                        </h3>
                        <div className="space-y-3">
                          {group.matches.map((m, idx) =>
                            renderMatchRow(
                              m.left,
                              m.right,
                              m.meta,
                              idx,
                              `playoff-${group.title}`,
                              null,
                              m.label
                            )
                          )}
                        </div>
                      </div>
                    ))
                ) : (
                  /* Mostra schermata vuota solo se non ci sono match dei gironi intermedi E non ci sono match di playoff */
                  !(
                    bracketConfig?.phaseType === "gold_silver" &&
                    getIntermediateGroupsList().filter((g) => g.category === fasiFinaliCategory)
                      .length > 0
                  ) && (
                    <div className="text-center py-20 bg-white rounded-[2rem] shadow-sm border border-gray-100 px-6">
                      <span className="text-5xl mb-4 block">⚔️</span>
                      <h3 className="text-lg font-black text-[#0a1628] uppercase tracking-tight mb-2">
                        Fasi Finali in Preparazione
                      </h3>
                      <p className="text-gray-400 font-medium text-xs max-w-xs mx-auto">
                        Il tabellone ad eliminazione diretta non è ancora stato generato dallo staff
                        per questo torneo.
                      </p>
                    </div>
                  )
                )}
              </div>
            )}
          </>
        ) : (
          /* Messaggio Gironi non Pubblicati */
          <div className="text-center py-20 bg-white rounded-[2rem] shadow-sm border border-gray-100 px-6">
            <span className="text-5xl mb-4 block">⏳</span>
            <h3 className="text-lg font-black text-[#0a1628] uppercase tracking-tight mb-2">
              Calendario in Elaborazione
            </h3>
            <p className="text-gray-400 font-medium text-xs max-w-xs mx-auto">
              Lo staff sta configurando i gironi e le partite per il torneo. I dati saranno visibili in
              tempo reale su questa pagina non appena verranno pubblicati!
            </p>
          </div>
        )}
      </div>

      {/* BOTTOM NAV BAR FISSA - 4 Pulsanti */}
      {isPublished && (
        <nav className="fixed bottom-0 left-0 right-0 z-50">
          <div className="absolute inset-0 bg-[#0a1628]/95 backdrop-blur-xl border-t border-blue-950/80 shadow-[0_-4px_30px_rgba(0,0,0,0.25)]" />
          <div className="relative flex justify-around px-1 pb-safe">
            {/* Pulsante Gironi (Composizione) */}
            <button
              onClick={() => setActiveTab("gironi")}
              className={`relative flex flex-col items-center gap-1.5 py-5.5 px-3 flex-1 active:scale-95 transition-transform ${
                activeTab === "gironi" ? "text-[#FFD700]" : "text-slate-400"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill={activeTab === "gironi" ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth={activeTab === "gironi" ? 0 : 2}
                className="w-7 h-7 transition-colors"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
                />
              </svg>
              <span className="text-xs font-black uppercase tracking-widest transition-colors">
                Gironi
              </span>
              {activeTab === "gironi" && (
                <span className="absolute top-3 w-1.5 h-1.5 rounded-full bg-[#FFD700]" />
              )}
            </button>

            {/* Pulsante Partite */}
            <button
              onClick={() => setActiveTab("partite")}
              className={`relative flex flex-col items-center gap-1.5 py-5.5 px-3 flex-1 active:scale-95 transition-transform ${
                activeTab === "partite" ? "text-[#FFD700]" : "text-slate-400"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill={activeTab === "partite" ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth={activeTab === "partite" ? 0 : 2}
                className="w-7 h-7 transition-colors"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                />
              </svg>
              <span className="text-xs font-black uppercase tracking-widest transition-colors">
                Partite
              </span>
              {activeTab === "partite" && (
                <span className="absolute top-3 w-1.5 h-1.5 rounded-full bg-[#FFD700]" />
              )}
            </button>

            {/* Pulsante Classifiche */}
            <button
              onClick={() => setActiveTab("classifica")}
              className={`relative flex flex-col items-center gap-1.5 py-5.5 px-3 flex-1 active:scale-95 transition-transform ${
                activeTab === "classifica" ? "text-[#FFD700]" : "text-slate-400"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill={activeTab === "classifica" ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth={activeTab === "classifica" ? 0 : 2}
                className="w-7 h-7 transition-colors"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-6.75a1.125 1.125 0 0 0-1.125 1.125v3.375m9 0h-9M9 10.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0Z"
                />
              </svg>
              <span className="text-xs font-black uppercase tracking-widest transition-colors">
                {rankingType === "avulsa" ? "Classifica Avulsa" : "Classifiche"}
              </span>
              {activeTab === "classifica" && (
                <span className="absolute top-3 w-1.5 h-1.5 rounded-full bg-[#FFD700]" />
              )}
            </button>

            {/* Pulsante Fasi Finali - visibile solo se tabellone pubblicato */}
            {isBracketPublished && (
            <button
              onClick={() => setActiveTab("finali")}
              className={`relative flex flex-col items-center gap-1.5 py-5.5 px-3 flex-1 active:scale-95 transition-transform ${
                activeTab === "finali" ? "text-[#FFD700]" : "text-slate-400"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill={activeTab === "finali" ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth={activeTab === "finali" ? 0 : 2}
                className="w-7 h-7 transition-colors"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z"
                />
              </svg>
              <span className="text-xs font-black uppercase tracking-widest transition-colors">
                Fasi Finali
              </span>
              {activeTab === "finali" && (
                <span className="absolute top-3 w-1.5 h-1.5 rounded-full bg-[#FFD700]" />
              )}
            </button>
            )}
          </div>
          {/* iOS spacer */}
          <div className="h-safe-area-inset-bottom bg-[#0a1628]" />
        </nav>
      )}
      </div>
    </main>
  );
}
