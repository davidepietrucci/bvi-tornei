const normalize = (value) => String(value || "").trim().toLowerCase();

export function calendarDay(value) {
  const text = String(value || "").trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  const italian = text.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  const written = text.toLocaleLowerCase("it-IT").match(/^(\d{1,2})\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre)\s+(\d{4})$/);
  if (!iso && !italian && !written) return null;
  const months = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
  const [year, month, day] = iso ? iso.slice(1).map(Number) : italian ? [Number(italian[3]), Number(italian[2]), Number(italian[1])] : [Number(written[3]), months.indexOf(written[2]) + 1, Number(written[1])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date.getTime() : null;
}

export function nextAthleteRegistration(registrations, tournaments, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return registrations.filter((r) => ["approvata", "in attesa", "approvato", "ok", "confermato", "confermata"].includes(normalize(r.stato)))
    .map((r) => ({ registration: r, tournament: tournaments.find((t) => normalize(t.nome) === normalize(r.torneo)) }))
    .filter(({ tournament: t }) => t && !["concluso", "annullato", "annullata"].includes(normalize(t.stato)) && calendarDay(t.data) !== null && calendarDay(t.data) >= today)
    .sort((a, b) => calendarDay(a.tournament.data) - calendarDay(b.tournament.data) || Number(normalize(a.registration.stato) === "in attesa") - Number(normalize(b.registration.stato) === "in attesa"))
    .map(({ registration, tournament }) => ({ ...registration, dataTorneo: tournament.data }))[0] || null;
}

export function athletePhaseVisibility(groups, bracket) {
  return {
    initial: groups?.pubblicato === true,
    finals: bracket?.tabellonePubblicato === true,
    intermediate: bracket?.tabellonePubblicato === true && bracket.phaseType === "gold_silver" && ["groups", "custom_18", "pool_stepladder"].includes(bracket.subPhaseType),
  };
}

export async function fetchAthleteData(type, { slug, signal, array = false } = {}) {
  const query = new URLSearchParams({ type, public: "true" });
  if (slug) query.set("slug", slug);
  const response = await fetch(`/api/db?${query}`, { cache: "no-store", signal });
  if (!response.ok) throw new Error("Caricamento non riuscito. Riprova tra poco.");
  const json = await response.json();
  if (!("data" in json) || (array && !Array.isArray(json.data))) throw new Error("Risposta del server non valida. Riprova.");
  return json.data;
}

export function notificationKey(notification) {
  return JSON.stringify([notification.id ?? null, notification.data || "", notification.tipo || "", notification.titolo || "", notification.messaggio || ""]);
}

export function sortNotifications(notifications) {
  const timestamp = (n) => /^\d{4}-\d{2}-\d{2}T/.test(n.data) && Number.isFinite(Date.parse(n.data)) ? Date.parse(n.data) : calendarDay(n.data) ?? 0;
  return [...notifications].sort((a, b) => timestamp(b) - timestamp(a));
}
