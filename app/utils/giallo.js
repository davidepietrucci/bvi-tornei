// Pure tournament rules shared by staff, public views and tests.
export const GIALLO_FORMAT = "giallo-v1";
export const isGiallo = (tournament) => /giallo/i.test(tournament?.categoria || "");
export const gialloSlug = (name) => name.toLowerCase().trim().replace(/\s+/g, "_");
export const supportedGialloCount = (count) => [12, 15, 16, 20, 24].includes(count);

// Old tournaments had one switch: keep that meaning until either new switch is saved.
export function gialloVisibility(config) {
  return { groups: config?.groupsPublished ?? config?.published === true, finals: config?.finalsPublished ?? config?.published === true };
}

export function publicGiallo(config) {
  const visibility = gialloVisibility(config);
  if (!config || (!visibility.groups && !visibility.finals)) return null;
  return { format: config.format, published: true, groupsPublished: visibility.groups, finalsPublished: visibility.finals,
    publicView: true, publicAthleteCount: config.groups.flatMap(group => group.athletes).length,
    groups: visibility.groups ? config.groups : [], results: visibility.groups ? config.results : {},
    finals: visibility.finals && config.finals ? { results: config.finals.results } : null,
    publicFinalStages: visibility.finals ? gialloStages(config) : [],
    matchMetadata: Object.fromEntries(Object.entries(config.matchMetadata || {}).filter(([id]) => id.startsWith("group-") ? visibility.groups : visibility.finals)),
  };
}

export function approvedGialloAthletes(registrations, name) {
  const athletes = registrations.filter((r) =>
    String(r.torneo || "").trim().toLowerCase() === name.trim().toLowerCase() &&
    /^(approvata|approvato|ok|confermato|confermata)$/i.test(String(r.stato || "").trim())
  ).map((r) => ({ id: String(r.id ?? ""), name: String(r.giocatori || "").trim() }));
  if (athletes.some((a) => !a.id || !a.name) || new Set(athletes.map((a) => a.id)).size !== athletes.length) {
    throw new Error("Iscrizioni senza identificativo/nome o duplicate: correggerle prima del sorteggio.");
  }
  return athletes;
}

export function createGiallo(athletes) {
  if (!supportedGialloCount(athletes.length)) {
    throw new Error(`Ci sono ${athletes.length} atleti approvati. Servono 12, 15, 16, 20 o 24 atleti: nessuno verrà escluso automaticamente.`);
  }
  const shuffled = athletes.map((a) => ({ ...a }));
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const groupSize = shuffled.length === 15 ? 5 : 4;
  return {
    format: GIALLO_FORMAT, published: false,
    groups: Array.from({ length: shuffled.length / groupSize }, (_, i) => ({
      id: String.fromCharCode(65 + i), athletes: shuffled.slice(i * groupSize, (i + 1) * groupSize),
    })),
    results: {}, finals: null,
  };
}

// Add exactly one approved athlete to each existing group without changing its draw.
export function addFifthGialloAthletes(config, approved, selections) {
  if (!config || config.groups?.length !== 3 || config.groups.some((group) => group.athletes?.length !== 4)) {
    throw new Error("Servono tre gironi già composti da quattro atleti ciascuno.");
  }
  if (Object.keys(config.results || {}).length || config.finals || Object.keys(config.matchMetadata || {}).length) {
    throw new Error("Sono presenti risultati, tabellone o dati delle partite: l'aggiunta cambierebbe gli incontri. Verifica prima questi dati.");
  }
  if (!Array.isArray(approved) || approved.length !== 15 || new Set(approved.map((athlete) => athlete.id)).size !== 15) {
    throw new Error("Servono esattamente 15 iscrizioni approvate distinte.");
  }
  const existing = config.groups.flatMap((group) => group.athletes);
  const approvedById = new Map(approved.map((athlete) => [athlete.id, athlete]));
  if (existing.length !== 12 || new Set(existing.map((athlete) => athlete.id)).size !== 12 || existing.some((athlete) => approvedById.get(athlete.id)?.name !== athlete.name)) {
    throw new Error("I partecipanti salvati non corrispondono agli approvati. Aggiorna e verifica le iscrizioni prima di proseguire.");
  }
  const selected = config.groups.map((group) => selections?.[group.id]);
  const used = new Set(existing.map((athlete) => athlete.id));
  if (selected.some((id) => !id || !approvedById.has(id) || used.has(id)) || new Set(selected).size !== 3) {
    throw new Error("Seleziona un atleta approvato diverso e non ancora assegnato per ogni girone.");
  }
  return { ...config, groups: config.groups.map((group, i) => ({ ...group, athletes: [...group.athletes, { ...approvedById.get(selected[i]) }] })) };
}

export function groupGames(group) {
  if (group.athletes.length === 5) {
    return [
      [[0, 1], [2, 3], 4], [[0, 2], [1, 4], 3], [[0, 3], [2, 4], 1],
      [[0, 4], [1, 3], 2], [[1, 2], [3, 4], 0],
    ].map(([left, right, rest], i) => ({
      id: `group-${group.id}-${i}`, left: left.map((n) => group.athletes[n]),
      right: right.map((n) => group.athletes[n]), rest: group.athletes[rest],
    }));
  }
  return [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]]].map(([left, right], i) => ({
    id: `group-${group.id}-${i}`, left: left.map((n) => group.athletes[n]), right: right.map((n) => group.athletes[n]),
  }));
}

// One set to 21, with a two-point advantage; unfinished/invalid scores never advance anyone.
export function validGialloScore(score) {
  if (!Array.isArray(score) || score.length !== 2 || !score.every((n) => Number.isSafeInteger(n) && n >= 0)) return false;
  const high = Math.max(...score), low = Math.min(...score);
  return high === 21 ? low <= 19 : high > 21 && high - low === 2;
}

export function gialloRanking(config) {
  const rows = (config?.groups || []).flatMap((g) => g.athletes.map((a) => ({
    ...a, group: g.id, played: 0, wins: 0, pf: 0, ps: 0,
  })));
  const byId = new Map(rows.map((a) => [a.id, a]));
  for (const group of config?.groups || []) {
    for (const game of groupGames(group)) {
      const score = config.results[game.id];
      if (!validGialloScore(score)) continue;
      [game.left, game.right].forEach((pair, side) => pair.forEach((athlete) => {
        const row = byId.get(athlete.id);
        row.played++; row.wins += Number(score[side] > score[1 - side]);
        row.pf += score[side]; row.ps += score[1 - side];
      }));
    }
  }
  // Stable ties use the initial draw order, not an athlete's name or a changing random value.
  return rows.sort((a, b) => b.wins - a.wins || quotient(b) - quotient(a) ||
    (b.pf - b.ps) - (a.pf - a.ps) || b.pf - a.pf);
}

function quotient(row) { return row.ps ? row.pf / row.ps : row.pf ? Infinity : 0; }

export function groupsComplete(config) {
  return Boolean(config?.groups?.length) && config.groups.every((group) =>
    groupGames(group).every((game) => validGialloScore(config.results[game.id])));
}

export function startGialloFinals(config) {
  if (!groupsComplete(config)) throw new Error("Completa e salva tutti i risultati dei gironi prima di generare il tabellone.");
  if (config.groups.flatMap((group) => group.athletes).length === 15) throw new Error("La formula della fase finale per 15 atleti non è ancora configurata.");
  const groupIds = new Set(config.groups.flatMap(groupGames).map((game) => game.id));
  const matchMetadata = Object.fromEntries(Object.entries(config.matchMetadata || {}).map(([id, meta]) => [id, groupIds.has(id) ? meta : { ...meta, status: "scheduled" }]));
  return { ...config, matchMetadata, finals: { seeds: gialloRanking(config).map(({ id, name }) => ({ id, name })), results: {} } };
}

function seededGames(athletes, stage, previousGames = []) {
  const pairKey = (a, b) => JSON.stringify([a.id, b.id].sort());
  const previousPairs = new Set(previousGames.flatMap((g) => [pairKey(...g.left), pairKey(...g.right)]));
  // Highest seed gets the lowest available seed, skipping former final-stage partners.
  // Backtrack rather than strand the last two athletes in a forbidden partnership.
  const matchPairs = (remaining) => {
    if (!remaining.length) return [];
    const first = remaining[0];
    for (let i = remaining.length - 1; i > 0; i--) {
      if (previousPairs.has(pairKey(first, remaining[i]))) continue;
      const rest = matchPairs(remaining.filter((_, n) => n !== 0 && n !== i));
      if (rest) return [[first, remaining[i]], ...rest];
    }
    return null;
  };
  const pairs = matchPairs(athletes);
  if (!pairs) throw new Error("Impossibile comporre coppie senza ripetizioni.");
  return Array.from({ length: pairs.length / 2 }, (_, i) => ({
    id: `${stage}-${i}`, left: pairs[i], right: pairs[pairs.length - 1 - i],
  }));
}

function winners(games, results) {
  if (!games.every((g) => validGialloScore(results[g.id]))) return null;
  return games.flatMap((g) => results[g.id][0] > results[g.id][1] ? g.left : g.right);
}

export function gialloStages(config) {
  if (config?.publicView) return gialloVisibility(config).finals ? config.publicFinalStages || [] : [];
  if (!config?.finals) return [];
  const { seeds, results } = config.finals;
  const order = new Map(seeds.map((a, i) => [a.id, i]));
  const sortSeeds = (players) => [...players].sort((a, b) => order.get(a.id) - order.get(b.id));
  const target = 2 ** Math.floor(Math.log2(seeds.length));
  const playoffPlayers = 2 * (seeds.length - target);
  const stages = [];
  let active = seeds;
  if (playoffPlayers) {
    const byes = seeds.slice(0, seeds.length - playoffPlayers);
    const games = seededGames(seeds.slice(byes.length), "playoff");
    stages.push({ id: "playoff", title: "Spareggi", byes, games });
    const qualified = winners(games, results);
    if (!qualified) return stages;
    active = sortSeeds([...byes, ...qualified]);
  }
  if (active.length === 16) {
    const games = seededGames(active, "quarters", stages.flatMap((s) => s.games));
    stages.push({ id: "quarters", title: "Quarti", games });
    active = winners(games, results);
    if (!active) return stages;
    active = sortSeeds(active);
  }
  const semis = seededGames(active, "semis", stages.flatMap((s) => s.games));
  stages.push({ id: "semis", title: "Semifinali · coppie definitive", games: semis });
  const finalists = winners(semis, results);
  if (finalists) {
    // Keep the two winning semifinal pairs intact, including their original sides/order.
    stages.push({ id: "final", title: "Finale · coppie fisse", games: [{
      id: "final-0", left: finalists.slice(0, 2), right: finalists.slice(2, 4),
    }] });
  }
  return stages;
}

export function setGialloScore(config, gameId, score) {
  if (score !== null && !validGialloScore(score)) throw new Error("Risultato non valido: set a 21, con almeno due punti di vantaggio.");
  const next = structuredClone(config);
  const groupIds = next.groups.flatMap(groupGames).map((g) => g.id);
  if (groupIds.includes(gameId)) {
    if (score === null) delete next.results[gameId]; else next.results[gameId] = score;
    next.matchMetadata = { ...next.matchMetadata, [gameId]: { ...next.matchMetadata?.[gameId], status: score === null ? "scheduled" : "finished" } };
    // Ranking changes invalidate every final pairing and result, even if the old winner was unchanged.
    next.finals = null;
    if (next.finalsPublished !== undefined || next.groupsPublished !== undefined) {
      next.finalsPublished = false;
      next.published = gialloVisibility(next).groups;
    }
    next.matchMetadata = Object.fromEntries(Object.entries(next.matchMetadata).filter(([id]) => groupIds.includes(id)));
    return next;
  }
  const stages = gialloStages(next);
  const index = stages.findIndex((stage) => stage.games.some((g) => g.id === gameId));
  if (index < 0) throw new Error("Partita non ancora disponibile.");
  if (score === null) delete next.finals.results[gameId]; else next.finals.results[gameId] = score;
  next.matchMetadata = { ...next.matchMetadata, [gameId]: { ...next.matchMetadata?.[gameId], status: score === null ? "scheduled" : "finished" } };
  // Changing a score clears all subsequent rounds: no stale winners or prefilled semis.
  for (const stage of stages.slice(index + 1)) for (const game of stage.games) {
    delete next.finals.results[game.id];
    if (next.matchMetadata[game.id]) next.matchMetadata[game.id].status = "scheduled";
  }
  return next;
}

export function validateGiallo(config) {
  if (config?.publicView || ["groupsPublished", "finalsPublished"].some(key => config?.[key] !== undefined && typeof config[key] !== "boolean")) throw new Error("Visibilità giallo non valida.");
  if (config?.format !== GIALLO_FORMAT || typeof config.published !== "boolean" || !Array.isArray(config.groups)) throw new Error("Formato giallo non valido.");
  const athletes = config.groups.flatMap((g) => g.athletes || []);
  const groupSize = athletes.length === 15 ? 5 : 4;
  if (!supportedGialloCount(athletes.length) || config.groups.some((g, i) => g.id !== String.fromCharCode(65 + i) || g.athletes?.length !== groupSize) ||
    athletes.some((a) => typeof a.id !== "string" || !a.id || typeof a.name !== "string" || !a.name.trim()) ||
    new Set(athletes.map((a) => a.id)).size !== athletes.length) throw new Error("Gironi o atleti non validi.");
  const groupIds = new Set(config.groups.flatMap(groupGames).map((g) => g.id));
  if (!config.results || Array.isArray(config.results) || Object.entries(config.results).some(([id, score]) => !groupIds.has(id) || !validGialloScore(score))) throw new Error("Risultati dei gironi non validi.");
  if (config.matchMetadata !== undefined) {
    if (!config.matchMetadata || typeof config.matchMetadata !== "object" || Array.isArray(config.matchMetadata)) throw new Error("Gestione partite non valida.");
    for (const [id, meta] of Object.entries(config.matchMetadata)) {
      const finalId = Boolean(config.finals) && /^(playoff|quarters|semis|final)-[0-5]$/.test(id);
      if ((!groupIds.has(id) && !finalId) || !meta || typeof meta !== "object" || Array.isArray(meta) ||
        (meta.court !== undefined && (typeof meta.court !== "string" || meta.court.length > 40)) ||
        (meta.time !== undefined && (typeof meta.time !== "string" || (meta.time !== "" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(meta.time)))) ||
        !["scheduled", "in_progress", "finished"].includes(meta.status) ||
        (meta.status === "finished") !== validGialloScore(groupIds.has(id) ? config.results[id] : config.finals?.results[id])) throw new Error("Campo, orario o stato della partita non valido.");
    }
  }
  if (config.finals) {
    const expected = startGialloFinals(config).finals.seeds;
    if (JSON.stringify(config.finals.seeds) !== JSON.stringify(expected)) throw new Error("Classifica del tabellone non aggiornata.");
    if (!config.finals.results || Array.isArray(config.finals.results)) throw new Error("Risultati finali non validi.");
    const available = new Set(gialloStages(config).flatMap((s) => s.games.map((g) => g.id)));
    if (Object.entries(config.finals.results).some(([id, score]) => !available.has(id) || !validGialloScore(score))) throw new Error("Risultati finali non validi o turno non ancora raggiunto.");
  }
  return true;
}
