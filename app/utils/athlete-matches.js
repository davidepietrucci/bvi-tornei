const normalize = (value) => String(value || "").normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("it-IT");
const approved = (registration) => /^(approvata|approvato|ok|confermato|confermata)$/i.test(String(registration.stato || "").trim());

export function tournamentRegistrations(registrations, tournament) {
  return registrations.filter((r) => normalize(r.torneo) === normalize(tournament) && approved(r));
}

// Team draws historically store the registration's team label rather than account IDs.
// Match the whole label, never a substring of the signed-in user's name.
const teamKey = (value) => normalize(value).split(/\s*(?:\/|&|\+)\s*|\s+-\s+/).map(normalize).sort().join("|");

export function personalMatchGroups(model, registrations, tournament) {
  const own = tournamentRegistrations(registrations, tournament);
  const ids = new Set(own.map((r) => String(r.id)));
  const labels = new Set(own.map((r) => teamKey(r.giocatori)).filter(Boolean));
  return [...model.groups, ...model.finals].map((group) => ({ ...group,
    matches: group.matches.filter((match) => model.individual
      ? [...(match.leftIds || []), ...(match.rightIds || [])].some((id) => ids.has(String(id)))
      : [...match.left, ...match.right].some((label) => labels.has(teamKey(label)))),
  })).filter((group) => group.matches.length > 0);
}
