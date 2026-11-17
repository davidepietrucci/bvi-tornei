// Existing qualification rules, isolated so a whole score update can be saved atomically.
export function propagateFinalAssignments(config, initialGroups = {}) {
  const { bracketAssignments = {}, bracketMetadata = {}, phaseType, subPhaseType,
    numGoldGironi: numGoldGironiOpt = 0, numSilverGironi: numSilverGironiOpt = 0,
    teamsPerGoldGirone = 4, teamsPerSilverGirone = 4 } = config;
  const { numGironi = 4, teamCounts = {} } = initialGroups;
  const getRoundRobinPairs = (count) => {
    const pairs = [];
    for (let l = 0; l < count; l++) for (let r = l + 1; r < count; r++) pairs.push({ l, r });
    return pairs;
  };
    const newAssignments = { ...bracketAssignments };


    // Keep the propagation helpers inside the effect so they always use its current inputs.
    const getTeamsCountForGroup = (groupKey) => {
      if (subPhaseType === "custom_18") return groupKey.startsWith("pool-gold-") ? 4 : 3;
      return groupKey.startsWith("gold-") ? (teamsPerGoldGirone || 4) : (teamsPerSilverGirone || 4);
    };
    const getIntermediateGroupTeamsList = (groupKey) =>
      Array.from({ length: getTeamsCountForGroup(groupKey) }, (_, i) => bracketAssignments[`${groupKey}-${i}`]);

    const getMatchTeams = (matchId) => {
      let left = bracketAssignments[`${matchId}-L`];
      let right = bracketAssignments[`${matchId}-R`];
      const match = matchId.match(/^(.+)-m([0-4])$/);
      if (match && (!left || !right)) {
        const [, groupKey, number] = match;
        const index = Number(number);
        if (index < 2) {
          left ||= bracketAssignments[`${groupKey}-${index * 2}`];
          right ||= bracketAssignments[`${groupKey}-${index * 2 + 1}`];
        } else if (index === 2 || index === 3) {
          const resolve = index === 2 ? resolveWinner : resolveLoser;
          left ||= resolve(`${groupKey}-m0`);
          right ||= resolve(`${groupKey}-m1`);
        } else {
          left ||= resolveLoser(`${groupKey}-m2`);
          right ||= resolveWinner(`${groupKey}-m3`);
        }
      }
      return { left, right };
    };
    const resolveOutcome = (matchId, loser = false) => {
      const { left, right } = getMatchTeams(matchId);
      if (left === "—" && right && right !== "—") return loser ? "—" : right;
      if (right === "—" && left && left !== "—") return loser ? "—" : left;
      const meta = bracketMetadata[matchId] || {};
      if (!left || !right || meta.scoreL === undefined || meta.scoreL === "" || meta.scoreR === undefined || meta.scoreR === "") return null;
      const scoreL = parseInt(meta.scoreL, 10);
      const scoreR = parseInt(meta.scoreR, 10);
      if (!Number.isFinite(scoreL) || !Number.isFinite(scoreR) || scoreL === scoreR) return null;
      const multi = /^(gold|silver)-/.test(matchId) && (/-f[13]$/.test(matchId) || (subPhaseType !== "custom_18" && /-[qs][1-4]$/.test(matchId)));
      const hasSets = [meta.s1L, meta.s1R, meta.s2L, meta.s2R, meta.s3L, meta.s3R].some(v => v !== undefined && v !== "");
      if (multi && (hasSets || Math.max(scoreL, scoreR) <= 2) && (Math.max(scoreL, scoreR) !== 2 || Math.min(scoreL, scoreR) > 1)) return null;
      return (scoreL > scoreR) !== loser ? left : right;
    };
    const resolveWinner = (matchId) => resolveOutcome(matchId);
    const resolveLoser = (matchId) => resolveOutcome(matchId, true);

    const getIntermediateRanking = (groupKey) => {
      if (subPhaseType === "pool_stepladder") {
        const winM2 = resolveWinner(`${groupKey}-m2`);
        const losM2 = resolveLoser(`${groupKey}-m2`);
        const winM3 = resolveWinner(`${groupKey}-m3`);
        const losM3 = resolveLoser(`${groupKey}-m3`);

        return [
          winM2 || `1° ${groupKey}`,
          losM2 || `2° ${groupKey}`,
          winM3 || `3° ${groupKey}`,
          losM3 || `4° ${groupKey}`
        ];
      }

      const stats = {};
      const numTeams = getTeamsCountForGroup(groupKey);
      const teams = getIntermediateGroupTeamsList(groupKey);

      teams.forEach(t => {
        if (t && t !== "—" && t !== "Slot Libero") {
          stats[t] = { nome: t, punti: 0, pf: 0, ps: 0 };
        }
      });

      const pairMaps = getRoundRobinPairs(numTeams);

      if (subPhaseType === "groups" || subPhaseType === "custom_18") {
        const complete = pairMaps.every((pair, idx) => {
          const teamL = teams[pair.l];
          const teamR = teams[pair.r];
          if (!teamL || !teamR || teamL === "—" || teamR === "—" || teamL === "Slot Libero" || teamR === "Slot Libero") return false;
          const meta = bracketMetadata[`${groupKey}-m${idx}`] || {};
          return meta.scoreL !== undefined && meta.scoreL !== "" && meta.scoreR !== undefined && meta.scoreR !== "";
        });
        if (!complete) return [];
      }

      pairMaps.forEach((pair, idx) => {
        const teamL = teams[pair.l];
        const teamR = teams[pair.r];
        if (!teamL || !teamR || !stats[teamL] || !stats[teamR]) return;

        const mKey = `${groupKey}-m${idx}`;
        const meta = bracketMetadata[mKey] || {};
        const s1L = parseInt(meta.scoreL || 0);
        const s1R = parseInt(meta.scoreR || 0);
        if (s1L === 0 && s1R === 0) return;

        stats[teamL].pf += s1L;
        stats[teamR].pf += s1R;
        stats[teamL].ps += s1R;
        stats[teamR].ps += s1L;

        if (s1L > s1R) {
          stats[teamL].punti++;
        } else {
          stats[teamR].punti++;
        }
      });

      return Object.values(stats).sort((a, b) => {
        if (b.punti !== a.punti) return b.punti - a.punti;
        const qzA = a.ps === 0 ? a.pf : a.pf / a.ps;
        const qzB = b.ps === 0 ? b.pf : b.pf / b.ps;
        return qzB - qzA;
      }).map(s => s.nome);
    };

    const update = (targetKey, value) => {
      if (value && newAssignments[targetKey] !== value) {
        newAssignments[targetKey] = value;
      } else if (!value && newAssignments[targetKey]) {
        newAssignments[targetKey] = "";
      }
    };

    const updateFromMatch = (targetKey, matchId, loser = false) => {
      const sourceExists = bracketAssignments[`${matchId}-L`] !== undefined || bracketAssignments[`${matchId}-R`] !== undefined;
      if (!sourceExists) return;
      const value = loser ? resolveLoser(matchId) : resolveWinner(matchId);
      if (value) update(targetKey, value);
      else if (newAssignments[targetKey] !== undefined && newAssignments[targetKey] !== "") {
        newAssignments[targetKey] = "";
      }
    };

    // Propagation within Pool Groups
    if (subPhaseType === "pool_stepladder") {
      ["gold-A", "gold-B", "gold-C", "gold-D", "silver-A", "silver-B", "silver-C", "silver-D"].forEach(groupKey => {
        const winM0 = resolveWinner(`${groupKey}-m0`);
        const winM1 = resolveWinner(`${groupKey}-m1`);
        const losM0 = resolveLoser(`${groupKey}-m0`);
        const losM1 = resolveLoser(`${groupKey}-m1`);

        update(`${groupKey}-m2-L`, winM0);
        update(`${groupKey}-m2-R`, winM1);

        update(`${groupKey}-m3-L`, losM0);
        update(`${groupKey}-m3-R`, losM1);

        const losM2 = resolveLoser(`${groupKey}-m2`);
        const winM3 = resolveWinner(`${groupKey}-m3`);

        update(`${groupKey}-m4-L`, losM2);
        update(`${groupKey}-m4-R`, winM3);
      });
    }

    if ((phaseType === "gold_silver" && subPhaseType === "direct") || phaseType === "single") {
      const parts = phaseType === "single" ? ["gold"] : ["gold", "silver"];
      parts.forEach(p => {
          const hasOttavi = bracketAssignments[`${p}-o1-L`] !== undefined;
          const is16Teams = bracketAssignments[`${p}-o5-L`] !== undefined;
          if (hasOttavi) {
              if (is16Teams) {
                  updateFromMatch(`${p}-q1-L`, `${p}-o1`);
                  updateFromMatch(`${p}-q1-R`, `${p}-o2`);
                  updateFromMatch(`${p}-q2-L`, `${p}-o3`);
                  updateFromMatch(`${p}-q2-R`, `${p}-o4`);
                  updateFromMatch(`${p}-q3-L`, `${p}-o5`);
                  updateFromMatch(`${p}-q3-R`, `${p}-o6`);
                  updateFromMatch(`${p}-q4-L`, `${p}-o7`);
                  updateFromMatch(`${p}-q4-R`, `${p}-o8`);
              } else {
                  updateFromMatch(`${p}-q1-R`, `${p}-o4`);
                  updateFromMatch(`${p}-q2-R`, `${p}-o3`);
                  updateFromMatch(`${p}-q3-R`, `${p}-o2`);
                  updateFromMatch(`${p}-q4-R`, `${p}-o1`);
              }
          }
          updateFromMatch(`${p}-s1-L`, `${p}-q1`);
          updateFromMatch(`${p}-s1-R`, `${p}-q2`);
          updateFromMatch(`${p}-s2-L`, `${p}-q3`);
          updateFromMatch(`${p}-s2-R`, `${p}-q4`);
          updateFromMatch(`${p}-f1-L`, `${p}-s1`);
          updateFromMatch(`${p}-f1-R`, `${p}-s2`);
          updateFromMatch(`${p}-f3-L`, `${p}-s1`, true);
          updateFromMatch(`${p}-f3-R`, `${p}-s2`, true);
      });
    }

    if (phaseType === "gold_silver" && (subPhaseType === "groups" || subPhaseType === "pool_stepladder" || subPhaseType === "custom_18")) {
      let currentGoldSlots = 0;
      let currentSilverSlots = 0;
      for (let i = 0; i < numGironi; i++) {
        const gid = String.fromCharCode(65 + i);
        const count = teamCounts[gid] || 0;
        currentGoldSlots += Math.min(2, count);
        currentSilverSlots += Math.max(0, count - 2);
      }
      const currentNumGoldGironi = subPhaseType === "custom_18" ? 4 : (numGoldGironiOpt > 0 ? numGoldGironiOpt : (currentGoldSlots > 4 ? 2 : 1));
      const currentNumSilverGironi = subPhaseType === "custom_18" ? 2 : (numSilverGironiOpt > 0 ? numSilverGironiOpt : (currentSilverSlots > 4 ? 2 : 1));

      const gA_rank = getIntermediateRanking("gold-A");
      const gB_rank = currentNumGoldGironi >= 2 ? getIntermediateRanking("gold-B") : [];
      const gC_rank = currentNumGoldGironi >= 3 ? getIntermediateRanking("gold-C") : [];
      const gD_rank = currentNumGoldGironi >= 4 ? getIntermediateRanking("gold-D") : [];

      const sA_rank = getIntermediateRanking("silver-A");
      const sB_rank = currentNumSilverGironi >= 2 ? getIntermediateRanking("silver-B") : [];
      const sC_rank = currentNumSilverGironi >= 3 ? getIntermediateRanking("silver-C") : [];
      const sD_rank = currentNumSilverGironi >= 4 ? getIntermediateRanking("silver-D") : [];

      const getRankedInt = (rankArr, pos, fallback) => subPhaseType === "groups" ? (rankArr?.[pos] || null) : (rankArr?.[pos] || fallback);

      const isStepladder = subPhaseType === "pool_stepladder";

      if (isStepladder) {
        if (currentNumGoldGironi === 4) {
          update("gold-o1-L", getRankedInt(gA_rank, 2, "3° Gold A"));
          update("gold-o1-R", getRankedInt(gB_rank, 2, "3° Gold B"));
          update("gold-o2-L", getRankedInt(gC_rank, 2, "3° Gold C"));
          update("gold-o2-R", getRankedInt(gD_rank, 2, "3° Gold D"));

          update("gold-q1-L", getRankedInt(gA_rank, 1, "2° Gold A"));
          update("gold-q1-R", resolveWinner("gold-o1") || "Vincente Ottavo 1");
          update("gold-q2-L", getRankedInt(gB_rank, 1, "2° Gold B"));
          update("gold-q2-R", resolveWinner("gold-o2") || "Vincente Ottavo 2");
          update("gold-q3-L", getRankedInt(gC_rank, 1, "2° Gold C"));
          update("gold-q3-R", resolveWinner("gold-o2") || "Vincente Ottavo 2");
          update("gold-q4-L", getRankedInt(gD_rank, 1, "2° Gold D"));
          update("gold-q4-R", resolveWinner("gold-o1") || "Vincente Ottavo 1");

          update("gold-s1-L", getRankedInt(gA_rank, 0, "1° Gold A"));
          update("gold-s1-R", resolveWinner("gold-q2") || "Vincente Quarto 2");
          update("gold-s2-L", getRankedInt(gB_rank, 0, "1° Gold B"));
          update("gold-s2-R", resolveWinner("gold-q1") || "Vincente Quarto 1");
        } else if (currentNumGoldGironi === 2) {
          // Nessun ottavo: quarti a croce (2°A vs 3°B, 2°B vs 3°A)
          // 1° di ogni girone va diretto in semifinale incrociato con il vincente del quarto opposto
          update("gold-q1-L", getRankedInt(gA_rank, 1, "2° Gold A"));
          update("gold-q1-R", getRankedInt(gB_rank, 2, "3° Gold B"));
          update("gold-q2-L", getRankedInt(gB_rank, 1, "2° Gold B"));
          update("gold-q2-R", getRankedInt(gA_rank, 2, "3° Gold A"));

          update("gold-s1-L", getRankedInt(gA_rank, 0, "1° Gold A"));
          update("gold-s1-R", resolveWinner("gold-q2") || "Vincente Quarto 2");
          update("gold-s2-L", getRankedInt(gB_rank, 0, "1° Gold B"));
          update("gold-s2-R", resolveWinner("gold-q1") || "Vincente Quarto 1");
        } else if (currentNumGoldGironi === 1) {
          update("gold-s1-L", getRankedInt(gA_rank, 0, "1° Gold"));
          update("gold-s1-R", getRankedInt(gA_rank, 3, "4° Gold"));
          update("gold-s2-L", getRankedInt(gA_rank, 1, "2° Gold"));
          update("gold-s2-R", getRankedInt(gA_rank, 2, "3° Gold"));
        }
      } else if (subPhaseType === "custom_18") {
        // Custom 18 squadre Gold:
        // 1. Popola i 2 gironi POOL Gold con i primi (1°) e secondi (2°) dei gironi Gold A, B, C, D
        update("pool-gold-1-0", getRankedInt(gA_rank, 0, "1° Gold A"));
        update("pool-gold-1-1", getRankedInt(gB_rank, 1, "2° Gold B"));
        update("pool-gold-1-2", getRankedInt(gC_rank, 0, "1° Gold C"));
        update("pool-gold-1-3", getRankedInt(gD_rank, 1, "2° Gold D"));

        update("pool-gold-2-0", getRankedInt(gB_rank, 0, "1° Gold B"));
        update("pool-gold-2-1", getRankedInt(gA_rank, 1, "2° Gold A"));
        update("pool-gold-2-2", getRankedInt(gD_rank, 0, "1° Gold D"));
        update("pool-gold-2-3", getRankedInt(gC_rank, 1, "2° Gold C"));

        // 2. Quarti di Finale Gold (2° e 3° da Pool OPPOSTE si sfidano a croce)
        update("gold-q1-L", resolveLoser("pool-gold-1-m2") || "2° Pool Gold 1");
        update("gold-q1-R", resolveWinner("pool-gold-2-m3") || "3° Pool Gold 2");
        update("gold-q2-L", resolveLoser("pool-gold-2-m2") || "2° Pool Gold 2");
        update("gold-q2-R", resolveWinner("pool-gold-1-m3") || "3° Pool Gold 1");
        // 3. Semifinali Gold (1° Pool vs Vincente Quarto da Pool opposta)
        update("gold-s1-L", resolveWinner("pool-gold-1-m2") || "1° Pool Gold 1");
        update("gold-s1-R", resolveWinner("gold-q2") || "Vincente Quarto 2");
        update("gold-s2-L", resolveWinner("pool-gold-2-m2") || "1° Pool Gold 2");
        update("gold-s2-R", resolveWinner("gold-q1") || "Vincente Quarto 1");
      } else {
        // Standard Intermediate Groups (1° e 2° vanno in Semifinale)
        if (currentNumGoldGironi === 4) {
          update("gold-s1-L", getRankedInt(gA_rank, 0, "1° Gold A"));
          update("gold-s1-R", getRankedInt(gB_rank, 0, "1° Gold B"));
          update("gold-s2-L", getRankedInt(gC_rank, 0, "1° Gold C"));
          update("gold-s2-R", getRankedInt(gD_rank, 0, "1° Gold D"));
        } else if (currentNumGoldGironi === 2) {
          update("gold-s1-L", getRankedInt(gA_rank, 0, "1° Gold A"));
          update("gold-s1-R", getRankedInt(gB_rank, 1, "2° Gold B"));
          update("gold-s2-L", getRankedInt(gB_rank, 0, "1° Gold B"));
          update("gold-s2-R", getRankedInt(gA_rank, 1, "2° Gold A"));
        } else if (currentNumGoldGironi === 1) {
          update("gold-s1-L", getRankedInt(gA_rank, 0, "1° Gold"));
          update("gold-s1-R", getRankedInt(gA_rank, 3, "4° Gold"));
          update("gold-s2-L", getRankedInt(gA_rank, 1, "2° Gold"));
          update("gold-s2-R", getRankedInt(gA_rank, 2, "3° Gold"));
        }
      }

      updateFromMatch("gold-f1-L", "gold-s1");
      updateFromMatch("gold-f1-R", "gold-s2");
      updateFromMatch("gold-f3-L", "gold-s1", true);
      updateFromMatch("gold-f3-R", "gold-s2", true);

      if (isStepladder) {
        if (currentNumSilverGironi === 4) {
          update("silver-o1-L", getRankedInt(sA_rank, 2, "3° Silver A"));
          update("silver-o1-R", getRankedInt(sB_rank, 2, "3° Silver B"));
          update("silver-o2-L", getRankedInt(sC_rank, 2, "3° Silver C"));
          update("silver-o2-R", getRankedInt(sD_rank, 2, "3° Silver D"));

          update("silver-q1-L", getRankedInt(sA_rank, 1, "2° Silver A"));
          update("silver-q1-R", resolveWinner("silver-o1") || "Vincente Ottavo 1");
          update("silver-q2-L", getRankedInt(sB_rank, 1, "2° Silver B"));
          update("silver-q2-R", resolveWinner("silver-o2") || "Vincente Ottavo 2");
          update("silver-q3-L", getRankedInt(sC_rank, 1, "2° Silver C"));
          update("silver-q3-R", resolveWinner("silver-o2") || "Vincente Ottavo 2");
          update("silver-q4-L", getRankedInt(sD_rank, 1, "2° Silver D"));
          update("silver-q4-R", resolveWinner("silver-o1") || "Vincente Ottavo 1");

          update("silver-s1-L", getRankedInt(sA_rank, 0, "1° Silver A"));
          update("silver-s1-R", resolveWinner("silver-q2") || "Vincente Quarto 2");
          update("silver-s2-L", getRankedInt(sB_rank, 0, "1° Silver B"));
          update("silver-s2-R", resolveWinner("silver-q1") || "Vincente Quarto 1");
        } else if (currentNumSilverGironi === 2) {
          // Nessun ottavo: quarti a croce (2°A vs 3°B, 2°B vs 3°A)
          // 1° di ogni girone va diretto in semifinale incrociato con il vincente del quarto opposto
          update("silver-q1-L", getRankedInt(sA_rank, 1, "2° Silver A"));
          update("silver-q1-R", getRankedInt(sB_rank, 2, "3° Silver B"));
          update("silver-q2-L", getRankedInt(sB_rank, 1, "2° Silver B"));
          update("silver-q2-R", getRankedInt(sA_rank, 2, "3° Silver A"));

          update("silver-s1-L", getRankedInt(sA_rank, 0, "1° Silver A"));
          update("silver-s1-R", resolveWinner("silver-q2") || "Vincente Quarto 2");
          update("silver-s2-L", getRankedInt(sB_rank, 0, "1° Silver B"));
          update("silver-s2-R", resolveWinner("silver-q1") || "Vincente Quarto 1");
        } else if (currentNumSilverGironi === 1) {
          update("silver-s1-L", getRankedInt(sA_rank, 0, "1° Silver"));
          update("silver-s1-R", getRankedInt(sA_rank, 3, "4° Silver"));
          update("silver-s2-L", getRankedInt(sA_rank, 1, "2° Silver"));
          update("silver-s2-R", getRankedInt(sA_rank, 2, "3° Silver"));
        }
      } else if (subPhaseType === "custom_18") {
        // Custom 18 squadre Silver: 2 Gironi all'italiana da 3 squadre.
        // Semifinali incrociate: 1°A vs 2°B, 1°B vs 2°A
        // Vincenti → Finale 1°/2°, Perdenti → Finale 3°/4°
        update("silver-s1-L", getRankedInt(sA_rank, 0, "1° Silver A"));
        update("silver-s1-R", getRankedInt(sB_rank, 1, "2° Silver B"));
        update("silver-s2-L", getRankedInt(sB_rank, 0, "1° Silver B"));
        update("silver-s2-R", getRankedInt(sA_rank, 1, "2° Silver A"));
      } else {
        // Standard Intermediate Groups (1° e 2° vanno in Semifinale)
        if (currentNumSilverGironi === 4) {
          update("silver-s1-L", getRankedInt(sA_rank, 0, "1° Silver A"));
          update("silver-s1-R", getRankedInt(sB_rank, 0, "1° Silver B"));
          update("silver-s2-L", getRankedInt(sC_rank, 0, "1° Silver C"));
          update("silver-s2-R", getRankedInt(sD_rank, 0, "1° Silver D"));
        } else if (currentNumSilverGironi === 2) {
          update("silver-s1-L", getRankedInt(sA_rank, 0, "1° Silver A"));
          update("silver-s1-R", getRankedInt(sB_rank, 1, "2° Silver B"));
          update("silver-s2-L", getRankedInt(sB_rank, 0, "1° Silver B"));
          update("silver-s2-R", getRankedInt(sA_rank, 1, "2° Silver A"));
        } else if (currentNumSilverGironi === 1) {
          update("silver-s1-L", getRankedInt(sA_rank, 0, "1° Silver"));
          update("silver-s1-R", getRankedInt(sA_rank, 3, "4° Silver"));
          update("silver-s2-L", getRankedInt(sA_rank, 1, "2° Silver"));
          update("silver-s2-R", getRankedInt(sA_rank, 2, "3° Silver"));
        }
      }

      updateFromMatch("silver-f1-L", "silver-s1");
      updateFromMatch("silver-f1-R", "silver-s2");
      updateFromMatch("silver-f3-L", "silver-s1", true);
      updateFromMatch("silver-f3-R", "silver-s2", true);
    }

    if (phaseType === "double") {
      const finalId = (p) => bracketAssignments[`${p}-f1-L`] !== undefined || bracketAssignments[`${p}-f1-R`] !== undefined || bracketMetadata[`${p}-f1`] ? `${p}-f1` : `${p}-f`;
      const wbFinal = finalId("wb"), lbFinal = finalId("lb");
      updateFromMatch(`wb-s1-L`, `wb-q1`); updateFromMatch(`wb-s1-R`, `wb-q2`);
      updateFromMatch(`wb-s2-L`, `wb-q3`); updateFromMatch(`wb-s2-R`, `wb-q4`);
      updateFromMatch(`${wbFinal}-L`, `wb-s1`); updateFromMatch(`${wbFinal}-R`, `wb-s2`);
      updateFromMatch(`${lbFinal}-L`, `lb-s1`); updateFromMatch(`${lbFinal}-R`, `lb-s2`);
      updateFromMatch(`grand-final-L`, wbFinal);
      updateFromMatch(`grand-final-R`, lbFinal);
    }


  return newAssignments;
}
