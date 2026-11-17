export const DEFAULT_CIRCUIT_POINT_TABLE = {
  1: 100,
  2: 80,
  3: 65,
  4: 55,
  5: 45,
  6: 35,
  7: 30,
  8: 25,
  9: 20,
  10: 15,
  11: 12,
  12: 10,
  13: 8,
  14: 6,
  15: 4,
  16: 2,
};

export const GIALLO_CIRCUIT_POINT_TABLE = Object.fromEntries(
  [100, 90, 80, 72, 64, 58, 52, 47, 42, 38, 34, 30, 27, 24, 21, 18, 16, 14, 12, 10, 8, 6, 4, 2].map((points, i) => [i + 1, points])
);
export const isGialloCircuitEvent = (tournament) => /giallo/i.test(tournament?.categoria || "");
export function getCircuitPointTable(tournament) {
  const defaults = isGialloCircuitEvent(tournament) ? GIALLO_CIRCUIT_POINT_TABLE : DEFAULT_CIRCUIT_POINT_TABLE;
  const source = tournament?.circuitPointTable || defaults;
  const normalized = Object.fromEntries(Array.from({ length: 24 }, (_, i) => [i + 1, Math.max(0, Number(source[i + 1]) || 0)]));
  return isGialloCircuitEvent(tournament) ? normalized : { ...source, ...normalized };
}
export function getCircuitRules(tournaments, circuitName) {
  const events = tournaments.filter((t) => normalizeCircuitName(t.circuitName) === normalizeCircuitName(circuitName) && ["tappa", "finale"].includes(t.circuitRole));
  const giallo = events.some(isGialloCircuitEvent);
  return { giallo, bestResults: giallo ? 2 : null, minimumStages: giallo ? 2 : 1, expectedStages: giallo ? 3 : null, finalists: giallo ? 16 : null };
}

export function normalizeCircuitName(value) {
  return String(value || "").trim().toLocaleLowerCase("it-IT");
}

export function getPlacementPoints(tournament, placement) {
  const place = Number(placement);
  if (!Number.isInteger(place) || place < 1) return 0;
  const table = getCircuitPointTable(tournament);
  const points = Number(table[place]);
  return Number.isFinite(points) && points > 0 ? points : 0;
}

export function getRegistrationPlayers(registration) {
  const fallbackNames = String(registration?.giocatori || "").split(/\s*(?:&| e )\s*/i);
  const entries = [
    {
      userId: registration?.atletaUserId1 || registration?.userId1 || registration?.userId,
      email: registration?.atletaEmail1 || registration?.email1 || registration?.email,
      name: registration?.atleta1Nome || fallbackNames[0] || "",
    },
    {
      userId: registration?.atletaUserId2 || registration?.userId2,
      email: registration?.atletaEmail2 || registration?.email2,
      name: registration?.atleta2Nome || fallbackNames[1] || "",
    },
  ];

  return entries
    .map((player) => ({
      userId: String(player.userId || "").trim(),
      email: String(player.email || "").trim().toLocaleLowerCase("it-IT"),
      name: String(player.name || "").trim(),
    }))
    .filter((player) => player.userId || player.email);
}

export function registrationIncludesAthlete(registration, userId, email) {
  const normalizedEmail = String(email || "").trim().toLocaleLowerCase("it-IT");
  return getRegistrationPlayers(registration).some((player) =>
    (userId && player.userId === String(userId)) ||
    (normalizedEmail && player.email === normalizedEmail)
  );
}

export function getCircuitLeaderboard(tournaments, registrations, circuitName) {
  const normalizedName = normalizeCircuitName(circuitName);
  if (!normalizedName) return [];
  const rules = getCircuitRules(tournaments, circuitName);
  const eventByName = new Map(tournaments.filter((t) =>
    normalizeCircuitName(t.circuitName) === normalizedName && t.circuitRole === "tappa" && t.stato === "Concluso" &&
    (!rules.giallo || isGialloCircuitEvent(t))
  ).map((t) => [normalizeCircuitName(t.nome), t]));
  const rows = [], aliases = new Map();
  for (const registration of registrations) {
    if (registration?.stato !== "Approvata") continue;
    const tournament = eventByName.get(normalizeCircuitName(registration.torneo));
    const placement = Number(registration.piazzamentoCircuito);
    if (!tournament || !Number.isInteger(placement) || placement < 1 || (rules.giallo && placement > 24)) continue;
    const stage = { id: String(tournament.id ?? tournament.nome), torneo: tournament.nome, piazzamento: placement, punti: getPlacementPoints(tournament, placement) };
    for (const player of getRegistrationPlayers(registration)) {
      const keys = [player.userId && `id:${player.userId}`, player.email && `email:${player.email}`].filter(Boolean);
      let row = keys.map((key) => aliases.get(key)).find(Boolean);
      if (!row) { row = { name: player.name, userIds: new Set(), emails: new Set(), stages: new Map() }; rows.push(row); }
      for (const key of keys) {
        const other = aliases.get(key);
        if (other && other !== row) {
          for (const id of other.userIds) row.userIds.add(id);
          for (const email of other.emails) row.emails.add(email);
          for (const [id, value] of other.stages) if (!row.stages.has(id)) row.stages.set(id, value);
          const index = rows.indexOf(other); if (index >= 0) rows.splice(index, 1);
          for (const [alias, value] of aliases) if (value === other) aliases.set(alias, row);
        }
        aliases.set(key, row);
      }
      if (!row.name && player.name) row.name = player.name;
      if (player.userId) row.userIds.add(player.userId);
      if (player.email) row.emails.add(player.email);
      if (!row.stages.has(stage.id)) row.stages.set(stage.id, stage);
    }
  }
  const compare = (a, b) => b.punti - a.punti || (rules.giallo ? b.tappe - a.tappe || b.migliorRisultato - a.migliorRisultato : 0);
  const sorted = rows.map((row) => {
    const stages = [...row.stages.values()].sort((a, b) => b.punti - a.punti || a.id.localeCompare(b.id));
    const counted = rules.bestResults ? stages.slice(0, rules.bestResults) : stages;
    return {
      nome: row.name || [...row.emails][0] || "Atleta", userIds: [...row.userIds].sort(), emails: [...row.emails].sort(),
      punti: counted.reduce((sum, stage) => sum + stage.punti, 0), tappe: stages.length,
      migliorRisultato: counted[0]?.punti || 0, idoneo: stages.length >= rules.minimumStages,
      risultati: stages.map((stage, i) => ({ ...stage, conteggiata: !rules.bestResults || i < rules.bestResults })),
    };
  }).sort((a, b) => compare(a, b) || a.nome.localeCompare(b.nome, "it-IT"));
  let position = 0, eligibleIndex = 0, eligiblePosition = 0, previousEligible = null;
  return sorted.map((row, i) => {
    if (i === 0 || compare(row, sorted[i - 1]) !== 0) position = i + 1;
    let qualificationPosition = null;
    if (row.idoneo) {
      eligibleIndex++;
      if (!previousEligible || compare(row, previousEligible) !== 0) eligiblePosition = eligibleIndex;
      qualificationPosition = eligiblePosition;
      previousEligible = row;
    }
    return { ...row, posizione: position, posizioneQualificazione: qualificationPosition };
  });
}

export function circuitAthleteKey(athlete) {
  return athlete.userIds?.[0] ? `id:${athlete.userIds[0]}` : `email:${athlete.emails?.[0] || ""}`;
}

export function getCircuitFinalists(tournaments, registrations, finalTournament) {
  const name = finalTournament.circuitName, rules = getCircuitRules(tournaments, name);
  const limit = rules.finalists || Number(finalTournament.circuitQualifiers) || 0;
  const leaderboard = getCircuitLeaderboard(tournaments, registrations, name);
  const stages = tournaments.filter((t) => t.circuitRole === "tappa" && normalizeCircuitName(t.circuitName) === normalizeCircuitName(name));
  const missingPlacements = stages.filter((t) => t.stato === "Concluso").flatMap((t) => {
    const approved = registrations.filter((r) => r.stato === "Approvata" && normalizeCircuitName(r.torneo) === normalizeCircuitName(t.nome));
    return !approved.length || approved.some((r) => !Number.isInteger(Number(r.piazzamentoCircuito)) || Number(r.piazzamentoCircuito) < 1 || Number(r.piazzamentoCircuito) > 24) ? [t.nome] : [];
  });
  const finals = tournaments.filter((t) => t.circuitRole === "finale" && normalizeCircuitName(t.circuitName) === normalizeCircuitName(name));
  const ready = !rules.giallo || (stages.length === 3 && new Set(stages.map((t) => normalizeCircuitName(t.nome))).size === 3 && new Set(stages.map((t) => String(t.id ?? t.nome))).size === 3 && finals.length <= 1 && stages.every((t) => isGialloCircuitEvent(t) && t.stato === "Concluso") && missingPlacements.length === 0);
  const eligible = leaderboard.filter((row) => row.idoneo);
  const tied = eligible.filter((row) => row.posizioneQualificazione <= limit && eligible.filter((a) => a.posizioneQualificazione === row.posizioneQualificazione).length + row.posizioneQualificazione - 1 > limit);
  const places = tied.length ? limit - tied[0].posizioneQualificazione + 1 : 0;
  const fingerprint = JSON.stringify({ stages: stages.map((t) => String(t.id ?? t.nome)).sort(), standings: eligible.map((a) => [circuitAthleteKey(a), a.punti, a.tappe, a.migliorRisultato]).sort((a, b) => a[0].localeCompare(b[0])) });
  const decision = finalTournament.circuitPlayoffDecision;
  const winners = Array.isArray(decision?.athleteKeys) ? decision.athleteKeys : [];
  const validDecision = ready && tied.length > 0 && decision?.fingerprint === fingerprint && new Set(winners).size === places && winners.length === places && winners.every((key) => tied.some((row) => circuitAthleteKey(row) === key));
  const athletes = leaderboard.map((row) => {
    let status = "excluded", reason = "Fuori dai posti disponibili per la finale.";
    if (!row.idoneo) { status = "minimum_stages"; reason = `Servono almeno ${rules.minimumStages} tappe concluse con piazzamento assegnato.`; }
    else if (!ready) { status = "provisional"; reason = finals.length > 1 ? "Sono presenti più finali nello stesso tour: lo staff deve completare la configurazione." : "Qualificazione provvisoria: occorrono esattamente 3 tappe concluse e i piazzamenti completi."; }
    else if ((rules.giallo ? row.posizioneQualificazione : row.posizione) <= limit) {
      if (rules.giallo && tied.includes(row)) {
        if (!validDecision) { status = "playoff"; reason = "Pari merito al limite dei posti: serve lo spareggio e la conferma dello staff."; }
        else if (winners.includes(circuitAthleteKey(row))) { status = "qualified"; reason = "Qualificato dopo lo spareggio."; }
        else { reason = "Non qualificato dopo lo spareggio."; }
      } else { status = "qualified"; reason = "Qualificato alla finale."; }
    }
    return { ...row, qualificato: status === "qualified", statoQualificazione: status, motivoQualificazione: reason };
  });
  return { rules, limit, ready, stages, missingPlacements, athletes, eligibleCount: eligible.length,
    playoff: { athletes: tied, places, fingerprint, resolved: validDecision } };
}

export function findCircuitAthlete(leaderboard, userId, email) {
  const normalizedEmail = String(email || "").trim().toLocaleLowerCase("it-IT");
  return leaderboard.find((row) =>
    (userId && row.userIds.includes(userId)) ||
    (normalizedEmail && row.emails.includes(normalizedEmail))
  ) || null;
}
