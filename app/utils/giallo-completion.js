import { approvedGialloAthletes, gialloFinalStandings } from "./giallo";
import { getPlacementPoints, normalizeCircuitName } from "./circuit";

export function gialloClosingPreview(config, tournament, registrations) {
  const standings = gialloFinalStandings(config);
  const approved = approvedGialloAthletes(registrations, tournament.nome);
  const participants = new Map((config?.groups || []).flatMap(group => group.athletes).map(athlete => [athlete.id, athlete.name]));
  const rosterMatches = approved.length === participants.size && approved.every(athlete => participants.get(athlete.id) === athlete.name);
  const problems = [...standings.problems];
  if (!rosterMatches) problems.push("Le iscrizioni approvate sono cambiate. Verifica i partecipanti prima di chiudere il torneo.");
  const awardsTourPoints = tournament.circuitRole === "tappa" && Boolean(normalizeCircuitName(tournament.circuitName));
  return { ready: standings.ready && rosterMatches, problems, awardsTourPoints, tourName: awardsTourPoints ? tournament.circuitName : "",
    rows: standings.rows.map(row => ({ ...row, points: awardsTourPoints && row.placement ? getPlacementPoints(tournament, row.placement) : 0 })) };
}
