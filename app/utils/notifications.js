import { registrationIncludesAthlete } from "./circuit";
import { publicLiveModel } from "./public-live";
import { matchStatus } from "./match-scoring";

const normalize = (value) => String(value || "").trim().toLocaleLowerCase("it-IT");
const teamKey = (value) => normalize(value).split(/\s*(?:&|\/|\+)\s*|\s+-\s+/).map((part) => part.trim()).sort().join("|");
export const notificationReadId = (notice) => String(notice.id);
export function visibleNotifications(notices, userId, email, registrations, now = Date.now()) {
  const own = registrations.filter((r) => !/^(annullata|rifiutata)$/i.test(String(r.stato || "")) && registrationIncludesAthlete(r, userId, email));
  const ids = new Set(own.map((r) => String(r.id)));
  const tournaments = new Set(own.map((r) => normalize(r.torneo)));
  return notices.filter((notice) => {
    if (notice.archived || notice.expiresAt && Date.parse(notice.expiresAt) <= now) return false;
    const audience = notice.audience;
    if (!audience || audience.type === "all") return true;
    if (audience.type === "athlete") return audience.userId === userId;
    if (audience.type === "tournament") return tournaments.has(normalize(audience.tournamentName));
    if (audience.type === "registrations") return (audience.registrationIds || []).some((id) => ids.has(String(id)));
    return false;
  }).map(({ id, titolo, messaggio, tipo, data, href, source }) => ({ id, titolo, messaggio, tipo, data,
    ...(typeof href === "string" && href.startsWith("/atleta/") ? { href } : {}), source: source || "manual" }));
}

export function validateNotificationText(body) {
  if (typeof body.titolo !== "string" || typeof body.messaggio !== "string") throw new Error("Titolo e messaggio non validi.");
  const titolo = String(body.titolo || "").trim(), messaggio = String(body.messaggio || "").trim();
  if (!titolo || titolo.length > 120 || !messaggio || messaggio.length > 2000) throw new Error("Inserisci un titolo (max 120 caratteri) e un messaggio (max 2000). ");
  if (!["info", "avviso", "urgente"].includes(body.tipo)) throw new Error("Tipo di avviso non valido.");
  return { titolo, messaggio, tipo: body.tipo };
}

export function tournamentNotifications(type, before, after, tournamentName, registrations, now) {
  const published = (config) => type === "giallo" ? config?.published === true : type === "gironi" ? config?.pubblicato === true : config?.tabellonePubblicato === true;
  if (!published(after)) return [];
  const href = `/atleta/gironi?${new URLSearchParams({ tour: tournamentName })}`;
  const common = { data: now, tipo: "info", source: "automatic", archived: false, href };
  if (!published(before)) return [{ ...common, titolo: type === "bracket" ? "Fasi finali pubblicate" : "Gironi e calendario disponibili", messaggio: `Lo staff ha pubblicato ${type === "bracket" ? "le fasi finali" : "i gironi e il calendario"} di ${tournamentName}. Consulta le tue partite.`, audience: { type: "tournament", tournamentName } }];
  const model = (config) => type === "giallo" ? publicLiveModel(null, null, config) : type === "gironi" ? publicLiveModel(config, null, null) : publicLiveModel(null, config, null);
  const previous = model(before), current = model(after);
  const games = (value) => [...value.groups, ...value.finals].flatMap((group) => group.matches.map((match) => ({ ...match, group: group.label })));
  const old = new Map(games(previous).map((game) => [game.id, game]));
  const eligible = registrations.filter((r) => normalize(r.torneo) === normalize(tournamentName) && /^(approvata|approvato|ok|confermato|confermata)$/i.test(String(r.stato || "")));
  const participants = (game) => {
    if (!game) return [];
    if (type === "giallo") return [...(game.leftIds || []), ...(game.rightIds || [])].map(String);
    const names = [...game.left, ...game.right].map(teamKey);
    return eligible.filter((r) => names.includes(teamKey(r.giocatori))).map((r) => String(r.id));
  };
  return games(current).filter((game) => game.ready !== false).flatMap((game) => {
    const prev = old.get(game.id);
    const pairing = !prev || JSON.stringify([prev.left, prev.right]) !== JSON.stringify([game.left, game.right]);
    const schedule = prev && (String(prev.court || "") !== String(game.court || "") || String(prev.time || "") !== String(game.time || ""));
    const started = matchStatus(game) === "in_progress" && (!prev || matchStatus(prev) !== "in_progress");
    const result = (matchStatus(game) === "finished" || prev && matchStatus(prev) === "finished") && (!prev || JSON.stringify([prev.score, prev.legacyResult]) !== JSON.stringify([game.score, game.legacyResult]));
    if (!pairing && !schedule && !started && !result) return [];
    const registrationIds = [...new Set([...participants(prev), ...participants(game)])];
    if (!registrationIds.length) return [];
    const titolo = result ? "Risultato della partita aggiornato" : started ? "La tua partita è in corso" : schedule ? "Campo o orario aggiornato" : "Nuovo abbinamento disponibile";
    const details = [tournamentName, game.group, game.label, game.court ? `Campo ${game.court}` : "Campo da definire", game.time ? `Ore ${game.time}` : "Orario da definire"].filter(Boolean).join(" · ");
    return [{ ...common, tipo: schedule || started ? "avviso" : "info", titolo, messaggio: `${details}. Controlla la sezione Le mie partite per i dettagli aggiornati.`, audience: { type: "registrations", tournamentName, registrationIds } }];
  });
}
