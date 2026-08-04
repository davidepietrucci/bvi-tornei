import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

let parsedServiceAccount = null;
const jsonEnv = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_CONFIG_JSON || process.env.FIREBASE_CREDENTIALS;
if (jsonEnv) {
  try {
    let cleanJson = typeof jsonEnv === "string" ? jsonEnv.trim() : jsonEnv;
    if (typeof cleanJson === "string" && ((cleanJson.startsWith("'") && cleanJson.endsWith("'")) || (cleanJson.startsWith('"') && cleanJson.endsWith('"')))) {
      cleanJson = cleanJson.slice(1, -1).trim();
    }
    parsedServiceAccount = typeof cleanJson === "string" ? JSON.parse(cleanJson) : cleanJson;
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
  saveLocalFileDb(docId, list);
  if (db) {
    try {
      const docRef = db.collection("config").doc(docId);
      await docRef.set({ list });
    } catch (e) {
      console.error(`Firestore write config/${docId} error:`, e);
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
  saveLocalFileDb(collectionId, data, docId);
  if (db) {
    try {
      const docRef = db.collection(collectionId).doc(docId);
      await docRef.set({ data });
    } catch (e) {
      console.error(`Firestore write ${collectionId}/${docId} error:`, e);
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

export async function getGironi(slug) {
  return getSpecificDoc("gironi", slug);
}
export async function saveGironi(slug, data) {
  await saveSpecificDoc("gironi", slug, data);
}

export async function getBracket(slug) {
  return getSpecificDoc("bracket", slug);
}
export async function saveBracket(slug, data) {
  await saveSpecificDoc("bracket", slug, data);
}

export async function getUsers() {
  return getConfigDoc("users");
}
export async function saveUsers(list) {
  await saveConfigDoc("users", list);
}

export async function getModuli() {
  return getConfigDoc("moduli");
}
export async function saveModuli(list) {
  await saveConfigDoc("moduli", list);
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

