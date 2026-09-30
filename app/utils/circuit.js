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

export function normalizeCircuitName(value) {
  return String(value || "").trim().toLocaleLowerCase("it-IT");
}

export function getPlacementPoints(tournament, placement) {
  const place = Number(placement);
  if (!Number.isInteger(place) || place < 1) return 0;
  const table = tournament?.circuitPointTable || DEFAULT_CIRCUIT_POINT_TABLE;
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

  const eventByName = new Map(
    tournaments
      .filter((tournament) =>
        normalizeCircuitName(tournament.circuitName) === normalizedName &&
        tournament.circuitRole === "tappa" &&
        tournament.stato === "Concluso"
      )
      .map((tournament) => [normalizeCircuitName(tournament.nome), tournament])
  );
  const rows = [];
  const aliases = new Map();

  for (const registration of registrations) {
    if (registration?.stato !== "Approvata") continue;
    const tournament = eventByName.get(normalizeCircuitName(registration?.torneo));
    if (!tournament) continue;

    const placement = Number(registration.piazzamentoCircuito);
    if (!Number.isInteger(placement) || placement < 1) continue;
    const points = getPlacementPoints(tournament, placement);
    const tournamentKey = String(tournament.id ?? tournament.nome);

    for (const player of getRegistrationPlayers(registration)) {
      const keys = [player.userId && `id:${player.userId}`, player.email && `email:${player.email}`].filter(Boolean);
      let row = keys.map((key) => aliases.get(key)).find(Boolean);

      if (!row) {
        row = { name: player.name, userIds: new Set(), emails: new Set(), points: 0, tournaments: new Set(), countedTournaments: new Set() };
        rows.push(row);
      }

      for (const key of keys) {
        const otherRow = aliases.get(key);
        if (otherRow && otherRow !== row) {
          row.points += otherRow.points;
          for (const value of otherRow.userIds) row.userIds.add(value);
          for (const value of otherRow.emails) row.emails.add(value);
          for (const value of otherRow.tournaments) row.tournaments.add(value);
          for (const value of otherRow.countedTournaments) row.countedTournaments.add(value);
          const otherIndex = rows.indexOf(otherRow);
          if (otherIndex >= 0) rows.splice(otherIndex, 1);
          for (const [alias, aliasRow] of aliases) if (aliasRow === otherRow) aliases.set(alias, row);
        }
        aliases.set(key, row);
      }

      if (!row.name && player.name) row.name = player.name;
      if (player.userId) row.userIds.add(player.userId);
      if (player.email) row.emails.add(player.email);
      row.tournaments.add(tournamentKey);
      if (!row.countedTournaments.has(tournamentKey)) {
        row.points += points;
        row.countedTournaments.add(tournamentKey);
      }
    }
  }

  const sortedRows = rows
    .map((row) => ({
      nome: row.name || [...row.emails][0] || "Atleta",
      userIds: [...row.userIds],
      emails: [...row.emails],
      punti: row.points,
      tappe: row.tournaments.size,
    }))
    .sort((a, b) => b.punti - a.punti || a.nome.localeCompare(b.nome, "it-IT"));
  let currentPosition = 0;
  return sortedRows.map((row, index) => {
    if (index === 0 || row.punti !== sortedRows[index - 1].punti) currentPosition = index + 1;
    return { ...row, posizione: currentPosition };
  });
}

export function findCircuitAthlete(leaderboard, userId, email) {
  const normalizedEmail = String(email || "").trim().toLocaleLowerCase("it-IT");
  return leaderboard.find((row) =>
    (userId && row.userIds.includes(userId)) ||
    (normalizedEmail && row.emails.includes(normalizedEmail))
  ) || null;
}
