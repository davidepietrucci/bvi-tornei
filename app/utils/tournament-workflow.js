export const WORKFLOW_STEPS = [
  { id: "prepare", label: "Preparazione", detail: "Partecipanti e formula" },
  { id: "groups", label: "Gironi", detail: "Composizione e risultati" },
  { id: "ranking", label: "Classifica", detail: "Posizioni e qualificazioni" },
  { id: "finals", label: "Fase finale", detail: "Tabellone e risultati" },
];

export function managementHref({ family, tour, step = "prepare", mode } = {}) {
  const params = new URLSearchParams();
  if (family) params.set("tipo", family);
  if (tour) params.set("tour", tour);
  params.set("fase", WORKFLOW_STEPS.some((s) => s.id === step) || step === "summary" ? step : "prepare");
  if (mode === "day" || mode === "prepare") params.set("vista", mode);
  return `/staff/gestione-torneo?${params}`;
}

export function tournamentNextAction(summary) {
  if (!summary.groupsConfigured) return { label: "Prepara i gironi", detail: "Controlla i partecipanti e completa la composizione prima di inserire risultati.", step: "groups", mode: "prepare" };
  if (summary.groupMatches > 0 && summary.groupCompleted < summary.groupMatches) return { label: "Gestisci le partite dei gironi", detail: `${summary.groupMatches - summary.groupCompleted} risultati dei gironi ancora da completare.`, step: "groups", mode: "day" };
  if (summary.groupMatches > 0 && summary.groupCompleted === summary.groupMatches && !summary.finalsConfigured) return { label: "Prepara la fase finale", detail: "Gironi completati: controlla la classifica e conferma gli abbinamenti. Nessun tabellone viene generato automaticamente.", step: "finals", mode: "prepare" };
  if (summary.finalsConfigured) return { label: "Apri le partite della fase finale", detail: "Gestisci campo, orario e risultati. Gli avanzamenti seguono la formula già configurata.", step: "finals", mode: "day" };
  return null;
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
