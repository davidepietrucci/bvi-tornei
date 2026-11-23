import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import { isDeepStrictEqual } from "node:util";
import { approvedGialloAthletes, gialloSlug, isGiallo } from "./giallo";
import { randomUUID, createHash } from "node:crypto";
import { tournamentNotifications } from "./notifications";
import { gialloClosingPreview } from "./giallo-completion";

let parsedServiceAccount = null;
const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_CONFIG_JSON || process.env.FIREBASE_CREDENTIALS;
if (jsonEnv) {
  try {
    let cleanJson = typeof jsonEnv === "string" ? jsonEnv.trim() : jsonEnv;
    if (typeof cleanJson === "string" && ((cleanJson.startsWith("'") && cleanJson.endsWith("'")) || (cleanJson.startsWith('"') && cleanJson.endsWith('"')))) {
      cleanJson = cleanJson.slice(1, -1).trim();
    }
    parsedServiceAccount = typeof cleanJson === "string" ? JSON.parse(cleanJson) : cleanJson;
    if (parsedServiceAccount && typeof parsedServiceAccount.private_key === "string") {
      parsedServiceAccount.private_key = parsedServiceAccount.private_key.replace(/\\n/g, "\n");
    }
  } catch (e) {
    console.warn("Could not parse FIREBASE_SERVICE_ACCOUNT JSON:", e.message);
  }
}

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || parsedServiceAccount?.project_id;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL || parsedServiceAccount?.client_email;
const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY || parsedServiceAccount?.private_key;

let privateKey = null;
if (rawPrivateKey) {
  let cleaned = String(rawPrivateKey).trim();
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1);
  }
  privateKey = cleaned.replace(/\\n/g, "\n");
}

const isFirebaseAdminConfigured = !!(projectId && clientEmail && privateKey);

let db = null;
if (isFirebaseAdminConfigured) {
  try {
    if (getApps().length === 0) {
      const credentialConfig = parsedServiceAccount?.private_key
        ? cert(parsedServiceAccount)
        : cert({
            projectId,
            clientEmail,
            privateKey
          });
      initializeApp({
        credential: credentialConfig
      });
    }
    db = getFirestore();
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch (e) {}
  } catch (error) {
    console.error("Firebase Admin SDK init error:", error);
  }
} else {
  console.warn("Firebase Admin SDK is not fully configured (missing projectId, clientEmail, or privateKey).");
}

export function getDbStatus() {
  return {
    isConfigured: isFirebaseAdminConfigured,
    isConnected: !!db,
    hasProjectId: !!projectId,
    hasClientEmail: !!clientEmail,
    hasPrivateKey: !!privateKey,
    missing: [
      !projectId && "FIREBASE_PROJECT_ID",
      !clientEmail && "FIREBASE_CLIENT_EMAIL",
      !privateKey && "FIREBASE_PRIVATE_KEY"
    ].filter(Boolean)
  };
}

function sanitizeData(data) {
  if (data === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(data));
  } catch (e) {
    return data;
  }
}

// Helpers per il salvataggio su file JSON locali (solo lato Server)
function getLocalFileDb(type, slug = null, fallback = []) {
  try {
    const dir = path.join(process.cwd(), "db_local");
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        console.warn("Could not create db_local directory (read-only filesystem):", err.message);
        return fallback;
      }
    }
    const filename = slug ? `${type}_${slug}.json` : `${type}.json`;
    const filePath = path.join(dir, filename);
    if (!fs.existsSync(filePath)) {
      return fallback;
    }
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (e) {
    console.error(`Error reading local db file for ${type}:`, e);
    return fallback;
  }
}

function saveLocalFileDb(type, data, slug = null) {
  try {
    const dir = path.join(process.cwd(), "db_local");
    if (!fs.existsSync(dir)) {
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        console.warn("Could not create db_local directory (read-only filesystem):", err.message);
        return false;
      }
    }
    const filename = slug ? `${type}_${slug}.json` : `${type}.json`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (e) {
    console.error(`Error writing local db file for ${type}:`, e);
    return false;
  }
}

async function getConfigDoc(docId, fallback = []) {
  if (db) {
    try {
      const docRef = db.collection("config").doc(docId);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const list = docSnap.data()?.list;
        if (list !== undefined && list !== null) {
          return list;
        }
      }
    } catch (e) {
      console.error(`Firestore read config/${docId} error:`, e);
    }
  }
  return getLocalFileDb(docId, null, fallback);
}

async function saveConfigDoc(docId, list) {
  const cleanList = sanitizeData(list) || [];
  saveLocalFileDb(docId, cleanList);
  if (db) {
    try {
      const docRef = db.collection("config").doc(docId);
      await docRef.set({ list: cleanList });
    } catch (e) {
      console.error(`Firestore write config/${docId} error:`, e);
      throw e;
    }
  }
}

async function getSpecificDoc(collectionId, docId, fallback = null) {
  if (db) {
    try {
      const docRef = db.collection(collectionId).doc(docId);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const data = docSnap.data()?.data;
        if (data !== undefined && data !== null) {
          return data;
        }
      }
    } catch (e) {
      console.error(`Firestore read ${collectionId}/${docId} error:`, e);
    }
  }
  return getLocalFileDb(collectionId, docId, fallback);
}

async function saveSpecificDoc(collectionId, docId, data) {
  const cleanData = sanitizeData(data);
  saveLocalFileDb(collectionId, cleanData, docId);
  if (db) {
    try {
      const docRef = db.collection(collectionId).doc(docId);
      await docRef.set({ data: cleanData });
    } catch (e) {
      console.error(`Firestore write ${collectionId}/${docId} error:`, e);
      throw e;
    }
  }
}

export async function getTornei() {
  return getConfigDoc("tornei");
}
export async function saveTornei(list) {
  await saveConfigDoc("tornei", list);
}

export async function getIscrizioni() {
  return getConfigDoc("iscrizioni");
}
export async function saveIscrizioni(list) {
  await saveConfigDoc("iscrizioni", list);
}

// Both lists are updated together and Firestore retries when another writer changes them.
export async function updateRegistrationsAtomically(update) {
  if (!db) throw new Error("Database Firestore non disponibile");
  const registrationsRef = db.collection("config").doc("iscrizioni");
  const tournamentsRef = db.collection("config").doc("tornei");
  return db.runTransaction(async (transaction) => {
    const [registrationsDoc, tournamentsDoc] = await Promise.all([
      transaction.get(registrationsRef), transaction.get(tournamentsRef)
    ]);
    const registrations = registrationsDoc.data()?.list ?? [];
    const tournaments = tournamentsDoc.data()?.list ?? [];
    if (!Array.isArray(registrations) || !Array.isArray(tournaments)) throw new Error("Dati torneo non validi");
    const outcome = await update(registrations, tournaments);
    if (outcome instanceof Response) return outcome;
    transaction.set(registrationsRef, { list: sanitizeData(outcome.registrations) });
    transaction.set(tournamentsRef, { list: sanitizeData(outcome.tournaments) });
    return outcome.result;
  });
}

export async function saveConfigIfUnchanged(type, list, baseline) {
  if (!db) throw new Error("Database Firestore non disponibile");
  const ref = db.collection("config").doc(type);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.data()?.list ?? [];
    if (!isDeepStrictEqual(current, baseline)) return false;
    transaction.set(ref, { list: sanitizeData(list) });
    return true;
  });
}

export async function getGironi(slug) {
  return getSpecificDoc("gironi", slug);
}

// Separate collection: the giallo never overwrites legacy group/bracket configurations.
export async function getGiallo(slug) {
  if (!db) throw new Error("Database Firestore non disponibile");
  const snapshot = await db.collection("giallo").doc(slug).get();
  return snapshot.data()?.data ?? null;
}

export async function saveGialloIfUnchanged(slug, data, baseline, tournamentName) {
  if (!db) throw new Error("Database Firestore non disponibile");
  const ref = db.collection("giallo").doc(slug);
  const registrationsRef = db.collection("config").doc("iscrizioni");
  const operationId = randomUUID();
  return db.runTransaction(async (transaction) => {
    const [snapshot, registrationsSnapshot, settingsSnapshot] = await Promise.all([
      transaction.get(ref), transaction.get(registrationsRef),
      transaction.get(db.collection("config").doc("notification_settings")),
    ]);
    if (!isDeepStrictEqual(snapshot.data()?.data ?? null, baseline)) return "conflict";
    const current = snapshot.data()?.data;
    if (!isDeepStrictEqual(current?.completion ?? null, data.completion ?? null)) return "completion_protected";
    if (current?.completion) {
      const withoutVisibility = value => Object.fromEntries(Object.entries(value).filter(([key]) => !["published", "groupsPublished", "finalsPublished"].includes(key)));
      if (!isDeepStrictEqual(withoutVisibility(current), withoutVisibility(data))) return "closed";
    }
    const previousGroups = current?.groups;
    // Recheck approvals atomically when generating/regenerating, not while recording results.
    if (!isDeepStrictEqual(previousGroups, data.groups)) {
      const approved = approvedGialloAthletes(registrationsSnapshot.data()?.list ?? [], tournamentName);
      const requestedIds = data.groups.flatMap((g) => g.athletes.map((a) => a.id)).sort();
      if (!isDeepStrictEqual(approved.map((a) => a.id).sort(), requestedIds)) return "registrations_changed";
      const names = new Map(approved.map((a) => [a.id, a.name]));
      if (data.groups.some((g) => g.athletes.some((a) => names.get(a.id) !== a.name))) return "registrations_changed";
    }
    if (settingsSnapshot.data()?.automaticEnabled !== false) {
      const notices = tournamentNotifications("giallo", current, data, tournamentName, registrationsSnapshot.data()?.list ?? [], new Date().toISOString());
      writeAutomaticNotifications(transaction, notices, operationId);
    }
    transaction.set(ref, { data: sanitizeData(data) });
    return "saved";
  });
}
export async function manageGialloCompletion(slug, action, fingerprint, actor, baseline) {
  if (!db) throw new Error("Database Firestore non disponibile");
  const ref = db.collection("giallo").doc(slug);
  const registrationsRef = db.collection("config").doc("iscrizioni");
  const tournamentsRef = db.collection("config").doc("tornei");
  const fail = (message, status = 409) => { throw Object.assign(new Error(message), { status }); };
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  return db.runTransaction(async transaction => {
    const [snapshot, registrationsDoc, tournamentsDoc] = await Promise.all([transaction.get(ref), transaction.get(registrationsRef), transaction.get(tournamentsRef)]);
    const data = snapshot.data()?.data;
    const registrations = registrationsDoc.data()?.list ?? [], tournaments = tournamentsDoc.data()?.list ?? [];
    if (!Array.isArray(registrations) || !Array.isArray(tournaments)) fail("Dati del torneo non validi.", 400);
    const tournament = tournaments.find(item => isGiallo(item) && gialloSlug(item.nome) === slug);
    if (!data || !tournament) fail("Torneo giallo non trovato.", 404);
    if (action === "preview" && !isDeepStrictEqual(data, baseline)) fail("Il torneo è cambiato. Aggiorna i dati prima di verificare la classifica.");
    const preview = gialloClosingPreview(data, tournament, registrations);
    const related = registrations.filter(item => String(item.torneo || "").trim().toLocaleLowerCase("it-IT") === tournament.nome.trim().toLocaleLowerCase("it-IT"));
    const currentFingerprint = createHash("sha256").update(JSON.stringify(canonical({ data, tournament, registrations: related }))).digest("hex");
    if (action === "preview") return { preview, fingerprint: currentFingerprint, closed: Boolean(data.completion), config: data, tournament };
    if (action === "close" && data.completion && fingerprint === data.completion.requestFingerprint && tournament.stato === "Concluso") return { preview, config: data, tournament, closed: true, alreadyClosed: true };
    if (fingerprint !== currentFingerprint) fail("Risultati, iscrizioni o configurazione sono cambiati. Verifica nuovamente la classifica prima di confermare.");
    if (action === "close" && data.completion) return { preview, config: data, tournament, closed: true, alreadyClosed: true };
    let next, nextTournament, nextRegistrations;
    if (action === "close") {
      if (!preview.ready) fail(preview.problems.join(" "), 400);
      const placements = new Map(preview.rows.map(row => [row.registrationId, row.placement]));
      const previousPlacements = Object.fromEntries(related.filter(item => placements.has(String(item.id))).map(item => [String(item.id), { piazzamentoCircuito: item.piazzamentoCircuito ?? null, piazzamentoFinale: item.piazzamentoFinale ?? null }]));
      next = { ...data, completion: { version: 1, at: new Date().toISOString(), by: actor, requestFingerprint: fingerprint, previousState: tournament.stato, previousPlacements, rows: preview.rows } };
      nextTournament = { ...tournament, stato: "Concluso" };
      nextRegistrations = registrations.map(item => related.includes(item) && placements.has(String(item.id)) ? { ...item, piazzamentoCircuito: placements.get(String(item.id)), piazzamentoFinale: placements.get(String(item.id)) } : item);
    } else if (action === "reopen") {
      if (!data.completion) fail("Il torneo non è stato chiuso da questa gestione.");
      const placements = new Map(data.completion.rows.map(row => [row.registrationId, row.placement]));
      const previous = data.completion.previousPlacements;
      if (related.some(item => placements.has(String(item.id)) && (item.piazzamentoCircuito !== placements.get(String(item.id)) || item.piazzamentoFinale !== placements.get(String(item.id))))) fail("Alcuni piazzamenti sono stati modificati dopo la chiusura. Verifica le iscrizioni prima di riaprire.");
      next = { ...data }; delete next.completion;
      nextTournament = { ...tournament, stato: data.completion.previousState && data.completion.previousState !== "Concluso" ? data.completion.previousState : "In Programmazione" };
      nextRegistrations = registrations.map(item => {
        const saved = related.includes(item) ? previous?.[String(item.id)] : null;
        if (!saved) return item;
        const restored = { ...item };
        for (const key of ["piazzamentoCircuito", "piazzamentoFinale"]) { if (saved[key] === null) delete restored[key]; else restored[key] = saved[key]; }
        return restored;
      });
    } else fail("Operazione non valida.", 400);
    transaction.set(ref, { data: sanitizeData(next) });
    transaction.set(registrationsRef, { list: sanitizeData(nextRegistrations) });
    transaction.set(tournamentsRef, { list: sanitizeData(tournaments.map(item => item === tournament ? nextTournament : item)) });
    return { preview, config: next, tournament: nextTournament, closed: action === "close" };
  });
}

export async function saveGironi(slug, data) {
  await saveTournamentWithNotifications("gironi", slug, data);
}

export async function getBracket(slug) {
  return getSpecificDoc("bracket", slug);
}
export async function saveBracket(slug, data) {
  await saveTournamentWithNotifications("bracket", slug, data);
}

function writeAutomaticNotifications(transaction, notices, operationId) {
  notices.forEach((notice, index) => {
    const id = `${operationId}-${index}`;
    transaction.set(db.collection("notifications").doc(id), sanitizeData({ ...notice, id }));
  });
}

async function saveTournamentWithNotifications(type, slug, data) {
  if (!db) return saveSpecificDoc(type, slug, data);
  const ref = db.collection(type).doc(slug), operationId = randomUUID();
  await db.runTransaction(async (transaction) => {
    const [snapshot, registrations, tournaments, settings] = await Promise.all([
      transaction.get(ref), transaction.get(db.collection("config").doc("iscrizioni")),
      transaction.get(db.collection("config").doc("tornei")), transaction.get(db.collection("config").doc("notification_settings")),
    ]);
    const tournament = (tournaments.data()?.list || []).find((t) => String(t.nome || "").toLowerCase().trim().replace(/\s+/g, "_") === slug);
    if (tournament && settings.data()?.automaticEnabled !== false) {
      writeAutomaticNotifications(transaction, tournamentNotifications(type, snapshot.data()?.data, data, tournament.nome, registrations.data()?.list || [], new Date().toISOString()), operationId);
    }
    transaction.set(ref, { data: sanitizeData(data) });
  });
  saveLocalFileDb(type, sanitizeData(data), slug);
}

export async function getNotificationEvents() {
  if (!db) throw new Error("Database notifiche non disponibile.");
  const snapshot = await db.collection("notifications").orderBy("data", "desc").limit(200).get();
  return snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
}

export async function getNotificationRegistrations() {
  if (!db) throw new Error("Database notifiche non disponibile.");
  const doc = await db.collection("config").doc("iscrizioni").get();
  return Array.isArray(doc.data()?.list) ? doc.data().list : [];
}

export async function createNotificationEvent(notice) {
  if (!db) throw new Error("Database notifiche non disponibile.");
  const id = randomUUID(), data = sanitizeData({ ...notice, id });
  await db.collection("notifications").doc(id).create(data);
  return data;
}

export async function archiveNotificationEvent(id, actor) {
  if (!db || typeof id !== "string" || id.includes("/")) throw new Error("Notifica non valida.");
  const ref = db.collection("notifications").doc(id);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return false;
    transaction.update(ref, { archived: true, archivedAt: new Date().toISOString(), archivedBy: actor });
    return true;
  });
}

export async function getNotificationPreferences(userId) {
  if (!db) throw new Error("Database notifiche non disponibile.");
  const doc = await db.collection("athlete_notification_state").doc(userId).get();
  return { enabled: doc.data()?.enabled !== false, read: Array.isArray(doc.data()?.read) ? doc.data().read : [], initialized: doc.exists };
}

export async function updateNotificationPreferences(userId, { read = [], enabled }) {
  if (!db) throw new Error("Database notifiche non disponibile.");
  const ref = db.collection("athlete_notification_state").doc(userId);
  return db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref), current = doc.data() || {};
    const next = { enabled: typeof enabled === "boolean" ? enabled : current.enabled !== false,
      read: [...new Set([...(Array.isArray(current.read) ? current.read : []), ...read])].slice(-1000) };
    transaction.set(ref, next); return { ...next, initialized: true };
  });
}

export async function getNotificationDeliverySettings() {
  if (!db) throw new Error("Database notifiche non disponibile.");
  const doc = await db.collection("config").doc("notification_settings").get();
  return { automaticEnabled: doc.data()?.automaticEnabled !== false };
}

export async function setNotificationDeliverySettings(automaticEnabled) {
  if (!db) throw new Error("Database notifiche non disponibile.");
  await db.collection("config").doc("notification_settings").set({ automaticEnabled }, { merge: true });
}

export async function getUsers() {
  return getConfigDoc("users");
}
export async function saveUsers(list) {
  await saveConfigDoc("users", list);
}

export async function getNotifiche() {
  return getConfigDoc("notifiche");
}
export async function saveNotifiche(list) {
  await saveConfigDoc("notifiche", list);
}

export async function getStaff() {
  return getConfigDoc("staff");
}
export async function saveStaff(list) {
  await saveConfigDoc("staff", list);
}

export async function getSponsors() {
  return getConfigDoc("sponsors");
}
export async function saveSponsors(list) {
  await saveConfigDoc("sponsors", list);
}
