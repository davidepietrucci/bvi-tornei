import { initializeApp, getApps, getApp } from "firebase/app";

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

// Helper per eseguire chiamate HTTP sicure dal Client verso l'API del Server (Single Source of Truth)
async function fetchFromServerDb(type, slug = null) {
  let url = `/api/db?type=${type}&_t=${Date.now()}`;
  if (slug) url += `&slug=${slug}`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "Pragma": "no-cache", "Cache-Control": "no-cache" }
    });
    if (!res.ok) throw new Error(`Fetch fallito: ${res.statusText}`);
    const json = await res.json();
    return json.data;
  } catch (e) {
    console.error(`Errore nel caricamento dal server db (${type}):`, e);
    return null;
  }
}

async function saveToServerDb(type, data, slug = null) {
  let url = `/api/db`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, data, slug })
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`Salvataggio fallito per ${type} (${res.status}): ${errText}`);
      throw new Error(`Salvataggio fallito status ${res.status}`);
    }
    const json = await res.json();
    return json.success;
  } catch (e) {
    console.error(`Errore nel salvataggio sul server db (${type}):`, e);
    return false;
  }
}

export function isUsingFirebase() {
  return true;
}

// Sincronizza dinamicamente i nomi delle squadre nei gironi/tabellone con le iscrizioni aggiornate
export function syncAssignmentsWithIscrizioni(assignments, iscrizioniList) {
  if (!assignments || !iscrizioniList || iscrizioniList.length === 0) return assignments;

  let changed = false;
  const newAssignments = JSON.parse(JSON.stringify(assignments));

  const isApproved = (st) => {
    if (!st) return true;
    const l = String(st).toLowerCase().trim();
    return l.startsWith("approvat") || l === "ok" || l === "confermato" || l === "confermata";
  };

  const approved = iscrizioniList.filter(i => isApproved(i.stato));

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

// Helper generico per le entità di tipo array (tornei, iscrizioni, users, moduli, notifiche, staff, sponsors)
async function getArrayEntity(key, type) {
  if (typeof window === "undefined") {
    const dbServer = await import("./db-server");
    const funcName = `get${type.charAt(0).toUpperCase() + type.slice(1)}`;
    if (dbServer[funcName]) {
      return await dbServer[funcName]();
    }
    return [];
  }

  const serverData = await fetchFromServerDb(type);
  if (serverData !== null && Array.isArray(serverData)) {
    try {
      localStorage.setItem(key, JSON.stringify(serverData));
    } catch (e) {
      console.warn(`Could not set localStorage key ${key}:`, e);
    }
    return serverData;
  }

  // Fallback offline a localStorage
  const saved = localStorage.getItem(key);
  return safeJsonParse(saved, []);
}

async function saveArrayEntity(key, type, list) {
  if (typeof window === "undefined") {
    const dbServer = await import("./db-server");
    const funcName = `save${type.charAt(0).toUpperCase() + type.slice(1)}`;
    if (dbServer[funcName]) {
      await dbServer[funcName](list);
    }
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch (e) {
    console.warn(`Could not set localStorage key ${key}:`, e);
  }
  await saveToServerDb(type, list);
}

// 1. Tornei
export async function getTornei() {
  return getArrayEntity("bvi_tornei", "tornei");
}
export async function saveTornei(list) {
  return saveArrayEntity("bvi_tornei", "tornei", list);
}

// 2. Iscrizioni
export async function getIscrizioni() {
  return getArrayEntity("bvi_iscrizioni", "iscrizioni");
}
export async function saveIscrizioni(list) {
  return saveArrayEntity("bvi_iscrizioni", "iscrizioni", list);
}

// 3. Gironi
export async function getGironi(slug) {
  const key = `bvi_gironi_v2_${slug}`;
  if (typeof window === "undefined") {
    const { getGironi } = await import("./db-server");
    return await getGironi(slug);
  }

  const serverData = await fetchFromServerDb("gironi", slug);
  if (serverData !== null && serverData !== undefined) {
    try {
      localStorage.setItem(key, JSON.stringify(serverData));
    } catch (e) {}
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

  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {}
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
  if (serverData !== null && serverData !== undefined) {
    try {
      localStorage.setItem(key, JSON.stringify(serverData));
    } catch (e) {}
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

  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {}
  await saveToServerDb("bracket", data, slug);
}

// 5. Users
export async function getUsers() {
  return getArrayEntity("bvi_users", "users");
}
export async function saveUsers(list) {
  return saveArrayEntity("bvi_users", "users", list);
}

// 6. Moduli
export async function getModuli() {
  return getArrayEntity("bvi_moduli", "moduli");
}
export async function saveModuli(list) {
  return saveArrayEntity("bvi_moduli", "moduli", list);
}

// 7. Notifiche
export async function getNotifiche() {
  return getArrayEntity("bvi_notifiche", "notifiche");
}
export async function saveNotifiche(list) {
  return saveArrayEntity("bvi_notifiche", "notifiche", list);
}

// 8. Staff
export async function getStaff() {
  return getArrayEntity("bvi_staff", "staff");
}
export async function saveStaff(list) {
  return saveArrayEntity("bvi_staff", "staff", list);
}

// 9. Sponsors
export async function getSponsors() {
  return getArrayEntity("bvi_sponsors", "sponsors");
}
export async function saveSponsors(list) {
  return saveArrayEntity("bvi_sponsors", "sponsors", list);
}
