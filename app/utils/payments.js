const normalized = (value) => String(value || "").trim().toLocaleLowerCase("it-IT");
export const euro = (cents) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(cents / 100);
export function moneyCents(value) {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error("Inserisci un importo positivo con massimo due decimali.");
  const cents = Math.round(Number(text) * 100);
  if (!Number.isSafeInteger(cents)) throw new Error("Importo non valido.");
  return cents;
}
const legacyCents = (value) => { try { return moneyCents(value ?? 0); } catch { return null; } };

export function paymentRegistrations(registrations, tournaments) {
  const names = new Set(tournaments.map((t) => normalized(t.nome)).filter(Boolean));
  return registrations.filter((registration) => names.has(normalized(registration.torneo)));
}

export function paymentModel(registration, tournaments) {
  const tournament = tournaments.find((t) => normalized(t.nome) === normalized(registration.torneo));
  const individual = registration.formatoIscrizione === "singola" || /giallo/i.test(tournament?.categoria || "");
  const names = String(registration.giocatori || "").split(/\s*(?:&|\/|\+)\s*|\s+-\s+/).filter(Boolean);
  const players = individual ? [registration.atleta1Nome || names[0] || "Atleta"]
    : [registration.atleta1Nome || names[0] || "Atleta 1", registration.atleta2Nome || names[1] || "Atleta 2"];
  const rawDue = registration.quotaTotale ?? tournament?.quota;
  const due = rawDue == null ? null : legacyCents(rawDue);
  const shares = individual ? [due ?? 0] : [Math.ceil((due ?? 0) / 2), Math.floor((due ?? 0) / 2)];
  const total = legacyCents(registration.quotaPagata);
  const explicit = registration.versatoAtleta1 !== undefined || registration.versatoAtleta2 !== undefined;
  const invalidIndividualAmount = explicit && players.some((_, i) => legacyCents(registration[`versatoAtleta${i + 1}`]) === null);
  let paid = explicit ? players.map((_, i) => legacyCents(registration[`versatoAtleta${i + 1}`]) ?? 0)
    : players.map((_, i) => registration[`pagatoPlayer${i + 1}`] === true ? shares[i] : typeof registration[`pagatoPlayer${i + 1}`] === "number" ? legacyCents(registration[`pagatoPlayer${i + 1}`]) ?? 0 : 0);
  if (!explicit && individual && total !== null) paid = [total];
  const attributed = paid.reduce((sum, amount) => sum + amount, 0);
  // Never guess which partner paid a historical aggregate-only amount.
  const unassigned = (total ?? 0) - attributed;
  const needsReview = due === null || total === null || invalidIndividualAmount || unassigned !== 0 || paid.some((p, i) => p > shares[i]);
  return { registration, tournament, individual, players, due, shares, paid, total: total ?? 0, unassigned, needsReview,
    remaining: due === null ? null : Math.max(0, due - (total ?? 0)),
    status: needsReview ? "review" : (total ?? 0) >= due ? "paid" : total > 0 ? "partial" : "unpaid",
    inactive: /^(annullata|rifiutata)$/i.test(String(registration.stato || "")),
  };
}

export function paymentVersion(registration, tournaments) {
  const model = paymentModel(registration, tournaments);
  return JSON.stringify([registration.id, registration.torneo, registration.stato, registration.giocatori,
    registration.atleta1Nome ?? null, registration.atleta2Nome ?? null, model.due, model.individual,
    registration.quotaPagata ?? null, registration.pagatoPlayer1 ?? null, registration.pagatoPlayer2 ?? null,
    registration.versatoAtleta1 ?? null, registration.versatoAtleta2 ?? null]);
}

export function updatePayment(registration, tournaments, { amounts, mode, reason }, actor, now) {
  const model = paymentModel(registration, tournaments);
  if (!model.tournament) throw new Error("Il torneo non esiste più. Aggiorna l’elenco dei pagamenti.");
  if (model.inactive) throw new Error("Non puoi registrare pagamenti su iscrizioni annullate o rifiutate.");
  if (model.due === null) throw new Error("Quota mancante o non valida: correggi prima la configurazione del torneo.");
  if (!["add", "correct", "allocate"].includes(mode) || !Array.isArray(amounts) || amounts.length !== model.players.length) throw new Error("Dati pagamento non validi.");
  if (mode === "add" && model.needsReview) throw new Error("Attribuisci o verifica prima i pagamenti precedenti.");
  const parsed = amounts.map(moneyCents);
  const paid = parsed.map((amount, i) => mode === "add" ? model.paid[i] + amount : amount);
  if (paid.some((amount, i) => amount > model.shares[i])) throw new Error("L’importo supera la quota del singolo atleta.");
  const total = paid.reduce((sum, amount) => sum + amount, 0);
  if (mode === "add" && !parsed.some((amount) => amount > 0)) throw new Error("Inserisci almeno un versamento.");
  if (mode === "allocate" && total !== model.total) throw new Error("L’attribuzione deve mantenere invariato il totale già incassato.");
  if (mode === "correct" && !String(reason || "").trim()) throw new Error("Inserisci il motivo della correzione.");
  return { ...registration, versatoAtleta1: paid[0] / 100, versatoAtleta2: (paid[1] || 0) / 100,
    quotaPagata: total / 100, quotaTotale: model.due / 100,
    pagatoPlayer1: paid[0] > 0 && paid[0] >= model.shares[0], pagatoPlayer2: !model.individual && paid[1] > 0 && paid[1] >= model.shares[1],
    paymentHistory: [...(Array.isArray(registration.paymentHistory) ? registration.paymentHistory : []),
      { at: now, by: actor, mode, reason: String(reason || "").trim().slice(0, 500), before: model.total / 100, after: total / 100,
        beforePlayers: model.paid.map((p) => p / 100), afterPlayers: paid.map((p) => p / 100), previousUnassigned: model.unassigned / 100 }],
  };
}
