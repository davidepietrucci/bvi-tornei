import { matchIdentity, validateMatchDetails, validateMatchSets } from "./match-scoring";
import { propagateFinalAssignments } from "./final-progression";

const realTeam = (name) => typeof name === "string" && Boolean(name.trim()) && !/^(—|slot\b|tbd\b|in attesa\b|da definire\b|vincente\b|perdente\b|\d+°)/i.test(name.trim());
const scoreKey = (key) => /^(score[LR]|s[123][LR])$/.test(key);

export function finalMatchGroups(config) {
  const a = config.bracketAssignments || {}, metadata = config.bracketMetadata || {};
  if (!Object.keys(a).length) return [];
  const groups = [];
  const seen = new Set();
  const multiSet = (id) => /^(gold|silver)-/.test(id) && (/-f[13]$/.test(id) || (config.subPhaseType !== "custom_18" && /-[qs][1-4]$/.test(id)));
  const result = (id, stack = new Set()) => {
    if (stack.has(id)) return null;
    const pair = teams(id, new Set([...stack, id]));
    if (pair[0] === "—" && realTeam(pair[1])) return pair[1];
    if (pair[1] === "—" && realTeam(pair[0])) return pair[0];
    const meta = metadata[id] || {};
    if (!realTeam(pair[0]) || !realTeam(pair[1]) || meta.scoreL === "" || meta.scoreR === "" || meta.scoreL == null || meta.scoreR == null) return null;
    if (Number(meta.scoreL) === Number(meta.scoreR)) return null;
    return pair[Number(meta.scoreL) > Number(meta.scoreR) ? 0 : 1];
  };
  const loser = (id, stack) => {
    const pair = teams(id, stack), winner = result(id, stack);
    return winner ? pair.find((name) => name !== winner) : null;
  };
  const teams = (id, stack = new Set()) => {
    const pool = id.match(/^(.+)-m(\d+)$/);
    if (pool) {
      const [, key, number] = pool, n = Number(number);
      const isPool = config.subPhaseType === "pool_stepladder" || key.startsWith("pool-gold-");
      if (!isPool) {
        const count = config.subPhaseType === "custom_18" ? 3 : key.startsWith("gold-") ? config.teamsPerGoldGirone || 4 : config.teamsPerSilverGirone || 4;
        const pairs = [];
        for (let l = 0; l < count; l++) for (let r = l + 1; r < count; r++) pairs.push([a[`${key}-${l}`], a[`${key}-${r}`]]);
        return pairs[n] || [null, null];
      }
      if (n < 2) return [a[`${key}-m${n}-L`] || a[`${key}-${2 * n}`], a[`${key}-m${n}-R`] || a[`${key}-${2 * n + 1}`]];
      const pair = n === 2 ? [result(`${key}-m0`, stack), result(`${key}-m1`, stack)] : n === 3 ? [loser(`${key}-m0`, stack), loser(`${key}-m1`, stack)] : [loser(`${key}-m2`, stack), result(`${key}-m3`, stack)];
      return [a[`${id}-L`] || pair[0], a[`${id}-R`] || pair[1]];
    }
    return [a[`${id}-L`], a[`${id}-R`]];
  };
  const add = (key, label, ids) => {
    const matches = ids.filter((id) => !seen.has(id)).map((id) => {
      seen.add(id);
      const meta = metadata[id] || {}, pair = teams(id);
      const hasSets = Object.keys(meta).some((k) => /^s[123][LR]$/.test(k) && meta[k] !== "" && meta[k] != null);
      // Never invent set-by-set points for historical aggregate-only results.
      const aggregate = !hasSets && meta.scoreL !== "" && meta.scoreR !== "" && meta.scoreL != null && meta.scoreR != null && Number(meta.scoreL) !== Number(meta.scoreR);
      const legacySingle = multiSet(id) && aggregate && Math.max(Number(meta.scoreL), Number(meta.scoreR)) > 2;
      const bestOf = multiSet(id) && !legacySingle ? 3 : 1;
      const round = id.match(/-([oqsf])(\d+)$/);
      const matchLabel = round ? round[1] === "f" ? round[2] === "3" ? "Finale 3°/4°" : "Finale 1°/2°" : `${({ o: "Ottavo", q: "Quarto", s: "Semifinale" })[round[1]]} ${round[2]}` : id === "grand-final" ? "Finalissima" : id.endsWith("-f") ? "Finale" : id;
      return { id, label: id.includes("-m") ? `Partita ${Number(id.split("-m").at(-1)) + 1}` : matchLabel,
        left: [pair[0] || "In attesa di qualificazione"], right: [pair[1] || "In attesa di qualificazione"],
        ready: realTeam(pair[0]) && realTeam(pair[1]) && pair[0] !== pair[1], bestOf,
        court: meta.court || "", time: meta.time || "", status: meta.status,
        legacyResult: aggregate && bestOf === 3 && Math.max(Number(meta.scoreL), Number(meta.scoreR)) === 2 && [0, 1].includes(Math.min(Number(meta.scoreL), Number(meta.scoreR))) ? `${meta.scoreL}–${meta.scoreR}` : null,
        score: bestOf === 3 ? Array.from({ length: 3 }, (_, i) => [meta[`s${i + 1}L`] ?? "", meta[`s${i + 1}R`] ?? ""])
          : [[meta.scoreL ?? "", meta.scoreR ?? ""]],
      };
    });
    if (matches.length) groups.push({ id: key, label, matches });
  };
  const intermediate = config.phaseType === "gold_silver" && ["groups", "pool_stepladder", "custom_18"].includes(config.subPhaseType);
  if (intermediate) {
    const keys = [...new Set(Object.keys(a).map((key) => key.match(/^((?:gold|silver)-[A-Z]|pool-gold-\d+)-\d+$/)?.[1]).filter(Boolean))].sort();
    for (const key of keys) {
      const pool = config.subPhaseType === "pool_stepladder" || key.startsWith("pool-gold-");
      const count = config.subPhaseType === "custom_18" ? 3 : key.startsWith("gold-") ? config.teamsPerGoldGirone || 4 : config.teamsPerSilverGirone || 4;
      add(key, key.replace("pool-gold-", "Pool Gold ").replace("gold-", "Gold · Girone ").replace("silver-", "Silver · Girone "), Array.from({ length: pool ? key.startsWith("pool-gold-") ? 4 : 5 : count * (count - 1) / 2 }, (_, i) => `${key}-m${i}`));
    }
  }
  for (const p of config.phaseType === "single" ? ["gold"] : config.phaseType === "double" ? ["wb", "lb"] : ["gold", "silver"]) {
    const label = ({ gold: config.phaseType === "single" ? "Tabellone" : "Gold", silver: "Silver", wb: "Vincenti", lb: "Recupero" })[p];
    const size = config.phaseType === "gold_silver" && config.subPhaseType === "direct" ? (p === "gold" ? config.teamsToGold : config.teamsToSilver) || config.bracketSize || 8 : config.bracketSize || 8;
    const present = (round, max) => Array.from({ length: max }, (_, i) => `${p}-${round}${i + 1}`).filter((id) => Object.keys(a).some((key) => key === `${id}-L` || key === `${id}-R`) || metadata[id]);
    if (!intermediate && config.phaseType !== "double") {
      if (size >= 12) add(`${p}-o`, `${label} · Ottavi`, Array.from({ length: size === 12 ? 4 : 8 }, (_, i) => `${p}-o${i + 1}`));
      if (size >= 8) add(`${p}-q`, `${label} · Quarti`, [1, 2, 3, 4].map((i) => `${p}-q${i}`));
    } else {
      add(`${p}-o`, `${label} · Ottavi`, present("o", 8));
      add(`${p}-q`, `${label} · Quarti`, present("q", 4));
    }
    add(`${p}-s`, `${label} · Semifinali`, [`${p}-s1`, `${p}-s2`]);
    const legacyFinal = a[`${p}-f1-L`] !== undefined || a[`${p}-f1-R`] !== undefined || metadata[`${p}-f1`];
    add(`${p}-f`, `${label} · Finali`, config.phaseType === "double" ? [legacyFinal ? `${p}-f1` : `${p}-f`, ...present("f", 3).filter((id) => id !== `${p}-f1`)] : [`${p}-f3`, `${p}-f1`]);
  }
  if (config.phaseType === "double") add("grand-final", "Finalissima", ["grand-final"]);
  return groups;
}

export function reconcileFinals(config, initialGroups = {}, previousConfig = null) {
  let next = structuredClone(config);
  const cleared = new Set();
  for (let pass = 0; pass < 20; pass++) {
    const before = new Map(finalMatchGroups(pass === 0 && previousConfig ? previousConfig : next).flatMap((g) => g.matches.map((m) => [m.id, m])));
    const assignments = propagateFinalAssignments(next, initialGroups);
    const assignmentsChanged = JSON.stringify(assignments) !== JSON.stringify(next.bracketAssignments);
    let resultsChanged = false;
    next.bracketAssignments = assignments;
    for (const game of finalMatchGroups(next).flatMap((g) => g.matches)) {
      if (!before.has(game.id) || matchIdentity(before.get(game.id)) === matchIdentity(game)) continue;
      const meta = next.bracketMetadata[game.id];
      if (!meta) continue;
      if (Object.keys(meta).some((key) => scoreKey(key) && meta[key] !== "" && meta[key] != null)) cleared.add(game.id);
      next.bracketMetadata[game.id] = { ...Object.fromEntries(Object.entries(meta).filter(([key]) => !scoreKey(key))), status: "scheduled" };
      resultsChanged = true;
    }
    if (!assignmentsChanged && !resultsChanged) return { config: next, cleared: [...cleared] };
  }
  throw new Error("Gli abbinamenti non risultano stabili. Controlla la configurazione prima di salvare.");
}

export function applyFinalScore(config, matchId, sets, details, initialGroups) {
  const match = finalMatchGroups(config).flatMap((g) => g.matches).find((m) => m.id === matchId);
  if (!match?.ready) throw new Error("Questa partita attende le qualificazioni o gli incontri precedenti.");
  const score = sets === null ? [] : validateMatchSets(sets, match.bestOf);
  const next = structuredClone(config);
  const meta = Object.fromEntries(Object.entries(next.bracketMetadata[matchId] || {}).filter(([key]) => !scoreKey(key)));
  if (sets !== null) {
    if (match.bestOf === 3) {
      let left = 0, right = 0;
      score.forEach((pair, i) => { meta[`s${i + 1}L`] = String(pair[0]); meta[`s${i + 1}R`] = String(pair[1]); if (pair[0] > pair[1]) left++; else right++; });
      meta.scoreL = String(left); meta.scoreR = String(right);
    } else { meta.scoreL = String(score[0][0]); meta.scoreR = String(score[0][1]); }
  }
  Object.assign(meta, details ? validateMatchDetails(match, details, sets === null ? null : score) : {}, { status: sets === null ? "scheduled" : "finished" });
  next.bracketMetadata[matchId] = meta;
  return reconcileFinals(next, initialGroups, config);
}

export function applyFinalDetails(config, matchId, details) {
  const match = finalMatchGroups(config).flatMap((g) => g.matches).find((m) => m.id === matchId);
  if (!match) throw new Error("Partita non trovata.");
  const validated = validateMatchDetails(match, details);
  return { ...config, bracketMetadata: { ...config.bracketMetadata, [matchId]: { ...config.bracketMetadata[matchId], ...validated } } };
}

export function applyFinalAssignment(config, key, value, initialGroups) {
  const before = new Map(finalMatchGroups(config).flatMap((g) => g.matches.map((m) => [m.id, m])));
  const next = structuredClone(config), cleared = [];
  next.bracketAssignments[key] = value.trim();
  for (const game of finalMatchGroups(next).flatMap((g) => g.matches)) {
    if (!before.has(game.id) || matchIdentity(before.get(game.id)) === matchIdentity(game)) continue;
    const meta = next.bracketMetadata[game.id];
    if (!meta) continue;
    if (Object.keys(meta).some((name) => scoreKey(name) && meta[name] !== "" && meta[name] != null)) cleared.push(game.id);
    next.bracketMetadata[game.id] = { ...Object.fromEntries(Object.entries(meta).filter(([name]) => !scoreKey(name))), status: "scheduled" };
  }
  const settled = reconcileFinals(next, initialGroups);
  return { config: settled.config, cleared: [...new Set([...cleared, ...settled.cleared])] };
}
