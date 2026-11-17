import { getCircuitFinalists, getCircuitRules, isGialloCircuitEvent, normalizeCircuitName } from "./circuit";

export function tourHref(name) {
  return `/tour?${new URLSearchParams({ tour: name })}`;
}

function dateValue(value) {
  const raw = String(value || "").trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const local = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  return iso ? `${iso[1]}${iso[2]}${iso[3]}` : local ? `${local[3]}${local[2]}${local[1]}` : "99999999";
}

export function circuitEvents(tournaments, name) {
  return tournaments.filter((t) => normalizeCircuitName(t.circuitName) === normalizeCircuitName(name) && ["tappa", "finale"].includes(t.circuitRole));
}

export function isTourPublished(tournaments, name) {
  const events = circuitEvents(tournaments, name);
  // Conflicting settings fail closed. The staff control updates every linked event together.
  return events.some((t) => t.circuitPublic === true) && !events.some((t) => t.circuitPublic === false);
}

export function getTourOverview(tournaments, registrations, name) {
  const events = circuitEvents(tournaments, name);
  const stages = events.filter((t) => t.circuitRole === "tappa").sort((a, b) => dateValue(a.data).localeCompare(dateValue(b.data)) || String(a.id ?? a.nome).localeCompare(String(b.id ?? b.nome), "it-IT", { numeric: true }));
  const finals = events.filter((t) => t.circuitRole === "finale");
  const qualification = getCircuitFinalists(tournaments, registrations, finals[0] || { circuitName: name, categoria: "Giallo", circuitQualifiers: 16 });
  const completed = stages.filter((t) => t.stato === "Concluso").length;
  const nextStage = stages.find((t) => t.stato !== "Concluso") || null;
  const status = finals.length === 1 && finals[0].stato === "Concluso" ? "Tour concluso" : qualification.ready && finals.length === 1 ? "Finale" : completed > 0 || stages.some((t) => t.stato === "Iscrizioni Aperte") ? "Qualificazioni in corso" : "In preparazione";
  const warnings = [];
  if (stages.length !== 3) warnings.push(`Calendario da completare: ${stages.length} tappe configurate su 3.`);
  if (qualification.missingPlacements.length) warnings.push(`Piazzamenti mancanti: ${qualification.missingPlacements.join(", ")}.`);
  if (qualification.playoff.athletes.length && !qualification.playoff.resolved) warnings.push(`Spareggio da risolvere: ${qualification.playoff.athletes.length} atleti per ${qualification.playoff.places} posti.`);
  if (qualification.ready && qualification.eligibleCount < 16) warnings.push(`Solo ${qualification.eligibleCount} atleti hanno almeno 2 tappe valide. Nessun ripescaggio automatico.`);
  if (finals.length > 1) warnings.push("Ci sono più finali collegate: verifica la configurazione.");
  if (events.some((t) => !isGialloCircuitEvent(t))) warnings.push("Nel tour sono presenti eventi non gialli: verifica il collegamento delle tappe.");
  const action = qualification.missingPlacements.length ? { label: "Completa i piazzamenti", href: `/staff/iscrizioni?${new URLSearchParams({ tour: qualification.missingPlacements[0] })}` }
    : qualification.playoff.athletes.length && !qualification.playoff.resolved ? { label: "Risolvi gli spareggi", view: "final" }
      : stages.length < 3 ? { label: "Completa il calendario", view: "stages" }
        : nextStage ? { label: "Gestisci la prossima tappa", href: `/staff/gestione-torneo?${new URLSearchParams({ tipo: "giallo", tour: nextStage.nome })}` }
          : finals.length === 1 ? { label: "Gestisci la finale", href: `/staff/gestione-torneo?${new URLSearchParams({ tipo: "giallo", tour: finals[0].nome })}` }
            : { label: "Configura la finale", view: "final" };
  return { name, stages, finals, qualification, completed, nextStage, status, warnings, action, athleteCount: qualification.athletes.length, qualifiedCount: qualification.athletes.filter((a) => a.qualificato).length };
}

// Explicit allowlists: never expose account IDs, emails, registrations or staff playoff decisions.
export function serializePublicTour(tournaments, registrations, name) {
  if (!getCircuitRules(tournaments, name).giallo || !isTourPublished(tournaments, name)) return null;
  const view = getTourOverview(tournaments, registrations, name);
  const event = (t) => ({ id: String(t.id), nome: String(t.nome || ""), data: String(t.data || ""), location: String(t.location || ""), stato: String(t.stato || ""), circuitRole: t.circuitRole });
  return {
    name: view.name, status: view.status, completed: view.completed, athleteCount: view.athleteCount, qualifiedCount: view.qualifiedCount,
    provisional: !view.qualification.ready, playoffPending: view.qualification.playoff.athletes.length > 0 && !view.qualification.playoff.resolved,
    stages: view.stages.map(event), finals: view.finals.map(event),
    athletes: view.qualification.athletes.map((a, i) => ({ key: `athlete-${i + 1}`, nome: String(a.nome || "").includes("@") ? "Atleta" : a.nome, posizione: a.posizione, posizioneQualificazione: a.posizioneQualificazione, tappe: a.tappe, punti: a.punti, idoneo: a.idoneo, qualificato: a.qualificato, statoQualificazione: a.statoQualificazione,
      risultati: a.risultati.map((r) => ({ id: r.id, torneo: r.torneo, piazzamento: r.piazzamento, punti: r.punti, conteggiata: r.conteggiata })),
    })),
  };
}
