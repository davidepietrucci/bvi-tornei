import { teamGroupMatches, matchStatus, completedMatch } from "./match-scoring";
import { finalMatchGroups } from "./final-scoring";
import { gialloRanking, gialloStages, groupGames } from "./giallo";
import { calculateUnifiedRanking } from "./ranking";

export function publicLiveModel(groups, bracket, giallo) {
  if (giallo?.published === true) {
    const adapt = (game, results) => ({ ...game, leftIds: game.left.map((a) => String(a.id)), rightIds: game.right.map((a) => String(a.id)), left: game.left.map((a) => a.name), right: game.right.map((a) => a.name), bestOf: 1, target: 21, ready: true, score: results[game.id] ? [results[game.id]] : [], ...giallo.matchMetadata?.[game.id] });
    return {
      groups: giallo.groups.map((g) => ({ id: g.id, label: `Girone ${g.id}`, teams: g.athletes.map((a) => a.name), matches: groupGames(g).map((game) => adapt(game, giallo.results)) })),
      finals: gialloStages(giallo).map((stage) => ({ id: stage.id, label: stage.title, byes: stage.byes?.map((a) => a.name), matches: stage.games.map((game) => adapt(game, giallo.finals.results)) })),
      ranking: gialloRanking(giallo).map((a) => ({ id: a.id, name: a.name, group: a.group, played: a.played, wins: a.wins, pf: a.pf, ps: a.ps })), individual: true,
    };
  }
  const initial = groups?.pubblicato === true ? { ...groups, gironeAssignments: groups.gironeAssignments || {}, gironeSets: groups.gironeSets || {}, teamCounts: groups.teamCounts || {}, matchMetadata: groups.matchMetadata || {} } : null;
  const final = bracket?.tabellonePubblicato === true ? bracket : null;
  return {
    groups: initial ? teamGroupMatches(initial).map((g) => ({ ...g, teams: Object.values(initial.gironeAssignments?.[g.id] || {}).filter((t) => t && t !== "—" && t !== "Slot Libero") })) : [],
    finals: final ? finalMatchGroups(final) : [],
    ranking: initial ? calculateUnifiedRanking(initial).map((t) => ({ id: `${t.girone}-${t.nome}`, name: t.nome, group: t.girone, played: t.giocate, wins: t.vinte, pf: t.puntiFatti, ps: t.puntiSubiti })) : [], individual: false,
  };
}

export function filterLiveMatches(groups, { court = "", status = "all", search = "" } = {}) {
  const text = search.trim().toLocaleLowerCase("it-IT");
  const priority = { in_progress: 0, scheduled: 1, finished: 2 };
  return groups.flatMap((g) => g.matches.map((m) => ({ ...m, group: g.label })))
    .filter((m) => (!court || String(m.court) === court) && (status === "all" || matchStatus(m) === status) && (!text || [...m.left, ...m.right].some((n) => String(n || "").toLocaleLowerCase("it-IT").includes(text))))
    .sort((a, b) => priority[matchStatus(a)] - priority[matchStatus(b)] || (a.time || "99:99").localeCompare(b.time || "99:99") || String(a.court || "").localeCompare(String(b.court || ""), "it-IT", { numeric: true }));
}

export function intermediateLiveRanking(group) {
  const real = (name) => name && !/^(in attesa|vincente|perdente|slot|tbd|—|da definire)/i.test(name);
  const rows = new Map();
  for (const match of group.matches) for (const team of [match.left, match.right]) {
    const name = team.join(" + ");
    if (team.every(real) && !rows.has(name)) rows.set(name, { id: name, name, group: group.label, played: 0, wins: 0, pf: 0, ps: 0 });
  }
  for (const match of group.matches) {
    if (!completedMatch(match)) continue;
    const left = rows.get(match.left.join(" + ")), right = rows.get(match.right.join(" + "));
    if (!left || !right) continue;
    const sets = match.score.filter((pair) => pair.every((n) => n !== "" && n !== null && n !== undefined));
    const l = sets.reduce((sum, pair) => sum + Number(pair[0]), 0), r = sets.reduce((sum, pair) => sum + Number(pair[1]), 0);
    left.played++; right.played++; left.pf += l; left.ps += r; right.pf += r; right.ps += l;
    const leftWins = sets.filter((pair) => Number(pair[0]) > Number(pair[1])).length;
    const rightWins = sets.filter((pair) => Number(pair[1]) > Number(pair[0])).length;
    if (leftWins > rightWins) left.wins++; else right.wins++;
  }
  const quotient = (a) => a.ps ? a.pf / a.ps : a.pf;
  return [...rows.values()].sort((a, b) => b.wins - a.wins || quotient(b) - quotient(a) || b.pf - a.pf);
}
