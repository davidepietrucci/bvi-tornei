export const WORKFLOW_STEPS = [
  { id: "prepare", label: "Preparazione", detail: "Partecipanti e formula" },
  { id: "groups", label: "Gironi", detail: "Composizione e risultati" },
  { id: "ranking", label: "Classifica", detail: "Posizioni e qualificazioni" },
  { id: "finals", label: "Fase finale", detail: "Tabellone e risultati" },
];

export function managementHref({ family, tour, step = "prepare" } = {}) {
  const params = new URLSearchParams();
  if (family) params.set("tipo", family);
  if (tour) params.set("tour", tour);
  params.set("fase", WORKFLOW_STEPS.some((s) => s.id === step) ? step : "prepare");
  return `/staff/gestione-torneo?${params}`;
}

export async function readWorkflowConfig(type, slug) {
  const response = await fetch(`/api/db?${new URLSearchParams({ type, slug })}`, { cache: "no-store" });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || "Impossibile caricare i dati del torneo.");
  return json.data;
}

const pendingSaves = new Map();
// Queue writes to the same resource so a previous autosave cannot overtake an explicit save.
export async function saveWorkflowConfig(type, slug, data) {
  const key = `${type}/${slug}`;
  const save = (pendingSaves.get(key) || Promise.resolve()).catch(() => {}).then(async () => {
    const response = await fetch("/api/db", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, slug, data }),
    });
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.error || "Salvataggio non riuscito. Rimani in questa sezione e riprova.");
    try {
      localStorage.setItem(`${type === "gironi" ? "bvi_gironi_v2" : "bvi_bracket_v1"}_${slug}`, JSON.stringify(data));
    } catch { /* Cache availability must not change the outcome of a server save. */ }
  });
  pendingSaves.set(key, save);
  try { await save; } finally { if (pendingSaves.get(key) === save) pendingSaves.delete(key); }
}
