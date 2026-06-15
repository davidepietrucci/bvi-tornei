export const getSchedule = (numTeams, gironeId, assignments = {}, gironeTypes = {}, gironeSets = {}, matchMetadata = {}) => {
  const getName = (idx) =>
    assignments[idx] && assignments[idx] !== "—" && assignments[idx] !== "Slot Libero"
      ? assignments[idx]
      : `Slot ${idx + 1}`;
  const type = gironeTypes?.[gironeId] || "Pool";
  if (!numTeams || numTeams < 2) return [];

  if (type === "Girone all'italiana") {
    const rrMatches = [];
    for (let i = 0; i < numTeams; i++) {
      for (let j = i + 1; j < numTeams; j++) {
        rrMatches.push({ left: getName(i), right: getName(j) });
      }
    }
    return rrMatches;
  }

  if (numTeams === 2) return [{ left: getName(0), right: getName(1) }];
  if (numTeams === 3)
    return [
      { left: getName(0), right: getName(2) },
      { left: getName(1), right: getName(2) },
      { left: getName(0), right: getName(1) },
    ];
  if (numTeams === 4) {
    const getResult = (idx) => {
      const meta = matchMetadata?.[`${gironeId}-${idx}`] || {};
      const s1L = parseInt(meta.s1L || 0);
      const s1R = parseInt(meta.s1R || 0);
      if (s1L === 0 && s1R === 0)
        return { winner: `Vincente G${idx + 1}`, loser: `Perdente G${idx + 1}` };

      if (gironeSets?.[gironeId] === "3 set") {
        let winL = 0, winR = 0;
        if (s1L > s1R) winL++;
        else if (s1R > s1L) winR++;
        if (parseInt(meta.s2L || 0) > parseInt(meta.s2R || 0)) winL++;
        else if (parseInt(meta.s2R || 0) > parseInt(meta.s2L || 0)) winR++;
        if (parseInt(meta.s3L || 0) > parseInt(meta.s3R || 0)) winL++;
        else if (parseInt(meta.s3R || 0) > parseInt(meta.s3L || 0)) winR++;

        if (winL > winR)
          return {
            winner: idx === 0 ? getName(0) : getName(1),
            loser: idx === 0 ? getName(3) : getName(2),
          };
        return {
          winner: idx === 0 ? getName(3) : getName(2),
          loser: idx === 0 ? getName(0) : getName(1),
        };
      }

      if (s1L > s1R)
        return {
          winner: idx === 0 ? getName(0) : getName(1),
          loser: idx === 0 ? getName(3) : getName(2),
        };
      return {
        winner: idx === 0 ? getName(3) : getName(2),
        loser: idx === 0 ? getName(0) : getName(1),
      };
    };

    const g1 = getResult(0);
    const g2 = getResult(1);

    return [
      { left: getName(0), right: getName(3) },
      { left: getName(1), right: getName(2) },
      { left: g1.winner, right: g2.winner },
      { left: g1.loser, right: g2.loser },
    ];
  }
  if (numTeams === 5)
    return [
      { left: getName(0), right: getName(4) },
      { left: getName(1), right: getName(3) },
      { left: getName(2), right: getName(4) },
      { left: getName(0), right: getName(1) },
      { left: getName(2), right: getName(3) },
    ];
  return [];
};

export const calculateSingleGroupStats = (groupId, config) => {
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
        girone: groupId,
        giocate: 0,
        vinte: 0,
        perse: 0,
        puntiFatti: 0,
        puntiSubiti: 0,
        score: 0, // wins
      };
    }
  }

  const schedule = getSchedule(teamCount, groupId, assignments, config.gironeTypes, config.gironeSets, config.matchMetadata);
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

  return Object.values(stats);
};

export const calculateUnifiedRanking = (config) => {
  if (!config || !config.numGironi) return [];
  
  let allTeams = [];
  for (let i = 0; i < config.numGironi; i++) {
    const gid = String.fromCharCode(65 + i);
    const groupStats = calculateSingleGroupStats(gid, config);
    allTeams = [...allTeams, ...groupStats];
  }

  // Ordina per:
  // 1. Vittorie (score) desc
  // 2. Quoziente punti (punti fatti / punti subiti) desc
  // 3. Punti fatti desc
  return allTeams.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const quotientA = a.puntiSubiti === 0 ? a.puntiFatti : a.puntiFatti / a.puntiSubiti;
    const quotientB = b.puntiSubiti === 0 ? b.puntiFatti : b.puntiFatti / b.puntiSubiti;
    if (quotientB !== quotientA) return quotientB - quotientA;
    return b.puntiFatti - a.puntiFatti;
  });
};
