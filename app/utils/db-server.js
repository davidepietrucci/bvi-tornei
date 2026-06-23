import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const isFirebaseAdminConfigured = !!process.env.FIREBASE_PROJECT_ID;

let db = null;
if (isFirebaseAdminConfigured) {
  try {
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
        })
      });
    }
    db = admin.firestore();
  } catch (error) {
    console.error("Firebase Admin SDK init error:", error);
  }
}

// Helpers per il salvataggio su file JSON locali (solo lato Server)
function getLocalFileDb(type, slug = null, fallback = []) {
  try {
    const dir = path.join(process.cwd(), "db_local");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
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
      fs.mkdirSync(dir, { recursive: true });
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
        return docSnap.data().list || fallback;
      }
    } catch (e) {
      console.error(`Firestore read config/${docId} error:`, e);
    }
    return fallback;
  }
  return getLocalFileDb(docId, null, fallback);
}

async function saveConfigDoc(docId, list) {
  if (db) {
    try {
      const docRef = db.collection("config").doc(docId);
      await docRef.set({ list });
    } catch (e) {
      console.error(`Firestore write config/${docId} error:`, e);
    }
    return;
  }
  saveLocalFileDb(docId, list);
}

async function getSpecificDoc(collectionId, docId, fallback = null) {
  if (db) {
    try {
      const docRef = db.collection(collectionId).doc(docId);
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        return docSnap.data().data || fallback;
      }
    } catch (e) {
      console.error(`Firestore read ${collectionId}/${docId} error:`, e);
    }
    return fallback;
  }
  return getLocalFileDb(collectionId, docId, fallback);
}

async function saveSpecificDoc(collectionId, docId, data) {
  if (db) {
    try {
      const docRef = db.collection(collectionId).doc(docId);
      await docRef.set({ data });
    } catch (e) {
      console.error(`Firestore write ${collectionId}/${docId} error:`, e);
    }
    return;
  }
  saveLocalFileDb(collectionId, data, docId);
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
