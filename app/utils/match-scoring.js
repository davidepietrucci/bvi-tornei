import { getSchedule } from "./ranking";

export function validateMatchSets(sets, bestOf = 1, target = null) {
  if (!Array.isArray(sets) || !sets.length || sets.length > bestOf) throw new Error("Inserisci il punteggio della partita.");
  const requiredWins = bestOf === 3 ? 2 : 1;
  let left = 0, right = 0;
  const completed = [];
  for (const pair of sets) {
    if (pair.every((n) => n === "" || n === null || n === undefined)) continue;
    if (left === requiredWins || right === requiredWins) throw new Error("La partita era già conclusa: lascia vuoti i set non disputati.");
    if (pair.length !== 2 || pair.some((n) => n === "" || n === null || n === undefined || !/^\d+$/.test(String(n)))) throw new Error("Inserisci entrambi i punteggi, usando solo numeri interi.");
    const values = pair.map(Number);
    if (values.some((n) => !Number.isSafeInteger(n))) throw new Error("Il punteggio inserito non è valido.");
    if (values[0] === values[1]) throw new Error("Un set concluso non può finire in pareggio.");
    if (target) {
      const high = Math.max(...values), low = Math.min(...values);
      if (!(high === target ? low <= target - 2 : high > target && high - low === 2)) {
        throw new Error(`Il set si gioca a ${target}, con due punti di vantaggio.`);
      }
    }
    completed.push(values);
    if (values[0] > values[1]) left++; else right++;
  }
  if (left !== requiredWins && right !== requiredWins) throw new Error(bestOf === 3 ? "Completa i set: una coppia deve vincerne due." : "Inserisci entrambi i punteggi della partita.");
  if (bestOf === 3 && completed.length < sets.filter((pair) => pair.some((n) => n !== "" && n !== null && n !== undefined)).length) throw new Error("Controlla l’ordine dei set.");
  // A gap before a played set is not a valid sequence (e.g. set 1 and set 3 only).
  if (sets.slice(0, completed.length).some((pair) => pair.every((n) => n === "" || n === null || n === undefined))) throw new Error("Compila i set in ordine, senza saltarne uno.");
  return completed;
}

export function completedMatch(match) {
  if (match.ready === false) return false;
  if (match.legacyResult) return true;
  try { validateMatchSets(match.score || [], match.bestOf || 1, match.target || null); return true; }
  catch { return false; }
}

export function matchIdentity(match) {
  return JSON.stringify([match.id, match.left, match.right, match.bestOf || 1]);
}

export function matchStatus(match) {
  if (completedMatch(match)) return "finished";
  return match.ready !== false && match.status === "in_progress" ? "in_progress" : "scheduled";
}

export function validateMatchDetails(match, details, score = undefined) {
  const court = String(details.court || "").trim();
  const time = String(details.time || "").trim();
  if (court.length > 40) throw new Error("Il nome del campo può contenere al massimo 40 caratteri.");
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Inserisci un orario valido nel formato HH:mm.");
  const status = score !== undefined && score !== null ? "finished" : details.status;
  if (!["scheduled", "in_progress", "finished"].includes(status)) throw new Error("Seleziona uno stato valido per la partita.");
  if (status === "in_progress" && match.ready === false) throw new Error("Attendi che entrambe le squadre siano definite prima di avviare la partita.");
  const done = score !== undefined ? score !== null : completedMatch(match);
  if (status === "finished" && !done) throw new Error("Per terminare la partita inserisci e salva un risultato valido.");
  if (status !== "finished" && done) throw new Error("Rimuovi prima il risultato salvato per riaprire la partita.");
  return { court, time, status };
}

export function applyTeamMatchDetails(config, matchId, details) {
  const match = teamGroupMatches(config).flatMap((g) => g.matches).find((m) => m.id === matchId);
  if (!match) throw new Error("Partita non trovata.");
  const validated = validateMatchDetails(match, details);
  return { ...config, matchMetadata: { ...config.matchMetadata, [matchId]: { ...config.matchMetadata[matchId], ...validated } } };
}

export function teamGroupMatches(config) {
  return Array.from({ length: config.numGironi }, (_, i) => {
    const id = String.fromCharCode(65 + i);
    const assignments = config.gironeAssignments[id] || {};
    const known = new Set(Object.values(assignments).filter((n) => n && n !== "—" && n !== "Slot Libero"));
    const bestOf = config.gironeSets[id] === "3 set" ? 3 : 1;
    return { id, label: `Girone ${id}`, matches: getSchedule(config.teamCounts[id], id, assignments, config.gironeTypes, config.gironeSets, config.matchMetadata).map((game, index) => {
      const meta = config.matchMetadata[`${id}-${index}`] || {};
      return { id: `${id}-${index}`, groupId: id, index, left: [game.left], right: [game.right], bestOf,
        ready: known.has(game.left) && known.has(game.right), court: meta.court || "", time: meta.time || "", status: meta.status,
        score: Array.from({ length: bestOf }, (_, set) => [meta[`s${set + 1}L`] ?? "", meta[`s${set + 1}R`] ?? ""]),
      };
    }) };
  });
}

export function applyTeamGroupScore(config, matchId, sets) {
  const groups = teamGroupMatches(config);
  const group = groups.find((g) => g.matches.some((m) => m.id === matchId));
  const match = group?.matches.find((m) => m.id === matchId);
  if (!match?.ready) throw new Error("Questa partita attende ancora le squadre: completa gli incontri precedenti o la composizione del girone.");
  const validated = sets === null ? [] : validateMatchSets(sets, match.bestOf);
  const next = structuredClone(config);
  const metadata = { ...(next.matchMetadata[matchId] || {}) };
  for (const key of Object.keys(metadata)) if (/^s[123][LR]$/.test(key)) delete metadata[key];
  validated.forEach((pair, i) => { metadata[`s${i + 1}L`] = String(pair[0]); metadata[`s${i + 1}R`] = String(pair[1]); });
  metadata.status = sets === null ? "scheduled" : "finished";
  next.matchMetadata[matchId] = metadata;
  const after = teamGroupMatches(next).find((g) => g.id === group.id);
  const cleared = [];
  after.matches.forEach((game, i) => {
    if (matchIdentity(game) === matchIdentity(group.matches[i])) return;
    const old = next.matchMetadata[game.id] || {};
    if (Object.keys(old).some((key) => /^s[123][LR]$/.test(key) && old[key] !== "")) cleared.push(game.id);
    next.matchMetadata[game.id] = Object.fromEntries(Object.entries(old).filter(([key]) => !/^s[123][LR]$/.test(key)));
    next.matchMetadata[game.id].status = "scheduled";
  });
  return { config: next, cleared };
}
