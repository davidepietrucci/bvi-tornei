import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const isFirebaseConfigured = !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

let db = null;
if (isFirebaseConfigured && typeof window !== "undefined") {
  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app);
  } catch (error) {
    console.error("Firebase init error:", error);
  }
}

// Safe JSON parse helper to prevent crashes
function safeJsonParse(str, fallback) {
  try {
    if (!str || str === "undefined") return fallback;
    return JSON.parse(str);
  } catch (e) {
    console.error("Failed to parse JSON:", str, e);
    return fallback;
  }
}

// Helper per eseguire chiamate HTTP sicure dal Client verso l'API del Server
async function fetchFromServerDb(type, slug = null) {
  let url = `/api/db?type=${type}`;
  if (slug) url += `&slug=${slug}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch fallito: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  } catch (e) {
    console.error(`Errore nel caricamento dal server db (${type}):`, e);
    return null;
  }
}

// Sincronizza dinamicamente i nomi delle squadre nei gironi/tabellone con le iscrizioni aggiornate
export function syncAssignmentsWithIscrizioni(assignments, iscrizioniList) {
  if (!assignments || !iscrizioniList || iscrizioniList.length === 0) return assignments;

  let changed = false;
  const newAssignments = JSON.parse(JSON.stringify(assignments));
  const approved = iscrizioniList.filter(i => i.stato === "Approvata" || i.stato === undefined);

  const findUpdatedTeamName = (currentName) => {
    if (!currentName || currentName === "—" || currentName === "Slot Libero" || currentName.startsWith("TBD")) return currentName;

    const cleanCur = currentName.toLowerCase().trim();

    // 1. Exact match
    const exact = approved.find(i => (i.giocatori || "").toLowerCase().trim() === cleanCur);
    if (exact) return exact.giocatori;

    // 2. Extract significant word tokens (length >= 2)
    const words = cleanCur.split(/[^a-z0-9]+/).filter(w => w.length >= 2);
    if (words.length > 0) {
      const match = approved.find(i => {
        const gLower = (i.giocatori || "").toLowerCase().trim();
        return words.every(w => gLower.includes(w));
      });
      if (match) return match.giocatori;
    }

    return currentName;
  };

  if (typeof newAssignments === "object" && newAssignments !== null) {
    Object.keys(newAssignments).forEach(gKey => {
      const val = newAssignments[gKey];
      if (typeof val === "object" && val !== null) {
        Object.keys(val).forEach(slotIdx => {
          const currentName = val[slotIdx];
          const updatedName = findUpdatedTeamName(currentName);
          if (updatedName && updatedName !== currentName) {
            val[slotIdx] = updatedName;
            changed = true;
          }
        });
      } else if (typeof val === "string") {
        const updatedName = findUpdatedTeamName(val);
        if (updatedName && updatedName !== val) {
          newAssignments[gKey] = updatedName;
          changed = true;
        }
      }
    });
  }

  return changed ? newAssignments : assignments;
}

async function saveToServerDb(type, data, slug = null) {
  let url = `/api/db`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, data, slug })
    });
    if (!res.ok) throw new Error(`Salvataggio fallito: ${res.statusText}`);
    const json = await res.json();
    return json.success;
  } catch (e) {
    console.error(`Errore nel salvataggio sul server db (${type}):`, e);
    return false;
  }
}

// Helper to check if using Firestore
export function isUsingFirebase() {
  if (typeof window === "undefined") {
    return !!process.env.FIREBASE_PROJECT_ID;
  }
  return isFirebaseConfigured;
}

// 1. Tornei
export async function getTornei() {
  if (typeof window === "undefined") {
    const { getTornei } = await import("./db-server");
    return await getTornei();
  }

  const serverData = await fetchFromServerDb("tornei");
  if (serverData !== null) {
    localStorage.setItem("bvi_tornei", JSON.stringify(serverData));
    return serverData;
  }
  const saved = localStorage.getItem("bvi_tornei");
  return safeJsonParse(saved, []);
}

export async function saveTornei(list) {
  if (typeof window === "undefined") {
    const { saveTornei } = await import("./db-server");
    await saveTornei(list);
    return;
  }

  localStorage.setItem("bvi_tornei", JSON.stringify(list));
  await saveToServerDb("tornei", list);
}

// 2. Iscrizioni
export async function getIscrizioni() {
  if (typeof window === "undefined") {
    const { getIscrizioni } = await import("./db-server");
    return await getIscrizioni();
  }

  const serverData = await fetchFromServerDb("iscrizioni");
  if (serverData !== null) {
    localStorage.setItem("bvi_iscrizioni", JSON.stringify(serverData));
    return serverData;
  }
  const saved = localStorage.getItem("bvi_iscrizioni");
  return safeJsonParse(saved, []);
}

export async function saveIscrizioni(list) {
  if (typeof window === "undefined") {
    const { saveIscrizioni } = await import("./db-server");
    await saveIscrizioni(list);
    return;
  }

  localStorage.setItem("bvi_iscrizioni", JSON.stringify(list));
  await saveToServerDb("iscrizioni", list);
}

// 3. Gironi
export async function getGironi(slug) {
  const key = `bvi_gironi_v2_${slug}`;
  if (typeof window === "undefined") {
    const { getGironi } = await import("./db-server");
    return await getGironi(slug);
  }

  const serverData = await fetchFromServerDb("gironi", slug);
  if (serverData !== null) {
    if (serverData) localStorage.setItem(key, JSON.stringify(serverData));
    return serverData;
  }
  const saved = localStorage.getItem(key);
  return safeJsonParse(saved, null);
}

export async function saveGironi(slug, data) {
  const key = `bvi_gironi_v2_${slug}`;
  if (typeof window === "undefined") {
    const { saveGironi } = await import("./db-server");
    await saveGironi(slug, data);
    return;
  }

  localStorage.setItem(key, JSON.stringify(data));
  await saveToServerDb("gironi", data, slug);
}

// 4. Bracket
export async function getBracket(slug) {
  const key = `bvi_bracket_v1_${slug}`;
  if (typeof window === "undefined") {
    const { getBracket } = await import("./db-server");
    return await getBracket(slug);
  }

  const serverData = await fetchFromServerDb("bracket", slug);
  if (serverData !== null) {
    if (serverData) localStorage.setItem(key, JSON.stringify(serverData));
    return serverData;
  }
  const saved = localStorage.getItem(key);
  return safeJsonParse(saved, null);
}

export async function saveBracket(slug, data) {
  const key = `bvi_bracket_v1_${slug}`;
  if (typeof window === "undefined") {
    const { saveBracket } = await import("./db-server");
    await saveBracket(slug, data);
    return;
  }

  localStorage.setItem(key, JSON.stringify(data));
  await saveToServerDb("bracket", data, slug);
}

// 5. Users
export async function getUsers() {
  if (typeof window === "undefined") {
    const { getUsers } = await import("./db-server");
    return await getUsers();
  }

  const serverData = await fetchFromServerDb("users");
  if (serverData !== null) {
    localStorage.setItem("bvi_users", JSON.stringify(serverData));
    return serverData;
  }
  const saved = localStorage.getItem("bvi_users");
  return safeJsonParse(saved, []);
}

export async function saveUsers(list) {
  if (typeof window === "undefined") {
    const { saveUsers } = await import("./db-server");
    await saveUsers(list);
    return;
  }

  localStorage.setItem("bvi_users", JSON.stringify(list));
  await saveToServerDb("users", list);
}

// 6. Moduli
export async function getModuli() {
  if (typeof window === "undefined") {
    const { getModuli } = await import("./db-server");
    return await getModuli();
  }

  const serverData = await fetchFromServerDb("moduli");
  if (serverData !== null) {
    localStorage.setItem("bvi_moduli", JSON.stringify(serverData));
    return serverData;
  }
  const saved = localStorage.getItem("bvi_moduli");
  return safeJsonParse(saved, []);
}

export async function saveModuli(list) {
  if (typeof window === "undefined") {
    const { saveModuli } = await import("./db-server");
    await saveModuli(list);
    return;
  }

  localStorage.setItem("bvi_moduli", JSON.stringify(list));
  await saveToServerDb("moduli", list);
}

// 7. Notifiche
export async function getNotifiche() {
  if (typeof window === "undefined") {
    const { getNotifiche } = await import("./db-server");
    return await getNotifiche();
  }

  const serverData = await fetchFromServerDb("notifiche");
  if (serverData !== null) {
    localStorage.setItem("bvi_notifiche", JSON.stringify(serverData));
    return serverData;
  }
  const saved = localStorage.getItem("bvi_notifiche");
  return safeJsonParse(saved, []);
}

export async function saveNotifiche(list) {
  if (typeof window === "undefined") {
    const { saveNotifiche } = await import("./db-server");
    await saveNotifiche(list);
    return;
  }

  localStorage.setItem("bvi_notifiche", JSON.stringify(list));
  await saveToServerDb("notifiche", list);
}

// 8. Staff
export async function getStaff() {
  if (typeof window === "undefined") {
    const { getStaff } = await import("./db-server");
    return await getStaff();
  }

  const serverData = await fetchFromServerDb("staff");
  if (serverData !== null) {
    localStorage.setItem("bvi_staff", JSON.stringify(serverData));
    return serverData;
  }
  const saved = localStorage.getItem("bvi_staff");
  return safeJsonParse(saved, []);
}

export async function saveStaff(list) {
  if (typeof window === "undefined") {
    const { saveStaff } = await import("./db-server");
    await saveStaff(list);
    return;
  }

  localStorage.setItem("bvi_staff", JSON.stringify(list));
  await saveToServerDb("staff", list);
}
