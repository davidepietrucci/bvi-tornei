"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import dynamic from "next/dynamic";
import StaffHeader from "@/app/components/StaffHeader";
import TournamentSetupHeader from "@/app/components/TournamentSetupHeader";
import GialloTournament from "@/app/components/GialloTournament";
import { isGiallo, gialloSlug } from "@/app/utils/giallo";
import { managementHref, readWorkflowConfig, WORKFLOW_STEPS } from "@/app/utils/tournament-workflow";

const TeamGroups = dynamic(() => import("@/app/components/tournament/TeamGroups"));
const TeamRanking = dynamic(() => import("@/app/components/tournament/TeamRanking"));
const TeamFinals = dynamic(() => import("@/app/components/tournament/TeamFinals"));
const actionClass = "rounded-xl bg-[#0a1628] px-5 py-3 text-sm font-bold text-white disabled:opacity-40";

async function readList(type, publicView = false) {
  const response = await fetch(`/api/db?${new URLSearchParams({ type, ...(publicView ? { public: "true" } : {}) })}`, { cache: "no-store" });
  const json = await response.json();
  if (!response.ok || !Array.isArray(json.data)) throw new Error(json.error || "Caricamento non riuscito. Riprova.");
  return json.data;
}

function TournamentWorkspace({ tournament, step, onNavigate, onSummary, saveRef }) {
  const groupsRef = useRef(null);
  const finalsRef = useRef(null);
  const [visited, setVisited] = useState([step]);
  const [participants, setParticipants] = useState([]);
  const [formula, setFormula] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const yellow = isGiallo(tournament);

  useEffect(() => { setVisited((list) => list.includes(step) ? list : [...list, step]); }, [step]);
  useImperativeHandle(saveRef, () => ({ flush: async () => {
    if (yellow || step === "prepare" || step === "ranking") return;
    const editor = step === "groups" ? groupsRef.current : finalsRef.current;
    if (!editor) throw new Error("Attendi il caricamento della sezione prima di proseguire.");
    await editor.flush();
  } }));

  useEffect(() => {
    if (yellow) return;
    let cancelled = false;
    setLoading(true); setError("");
    const slug = gialloSlug(tournament.nome);
    Promise.all([readList("iscrizioni", true), readWorkflowConfig("gironi", slug), readWorkflowConfig("bracket", slug)])
      .then(([registrations, groups, finals]) => {
        if (cancelled) return;
        setParticipants(registrations.filter((r) => String(r.torneo || "").trim().toLowerCase() === tournament.nome.trim().toLowerCase() &&
          /^(approvata|approvato|ok|confermato|confermata)$/i.test(String(r.stato || "").trim())));
        setFormula(finals?.phaseType || null);
        onSummary({ groupsPublished: Boolean(groups?.pubblicato), finalsPublished: Boolean(finals?.tabellonePubblicato), groupCount: groups?.numGironi || 0 });
      }).catch((reason) => { if (!cancelled) setError(reason.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [yellow, tournament.nome, onSummary, reload]);

  if (yellow) return <GialloTournament tournament={tournament} editable embedded workflowView={step}
    onWorkflowViewChange={(next) => onNavigate(next, true)} onSummary={onSummary} />;

  return <div className="space-y-5">
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
    <section hidden={step !== "prepare"} className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-bold">Preparazione del torneo a squadre</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">Controlla le squadre approvate. Le coppie restano quelle dell’iscrizione; la formula della fase finale si sceglie nel quarto passaggio.</p>
      {loading ? <p className="mt-5" role="status">Caricamento partecipanti e configurazione…</p> : <>
        <div className="my-5 grid gap-3 sm:grid-cols-3">
          {[{ label: "Squadre approvate", value: participants.length }, { label: "Categoria", value: tournament.categoria || "Da definire" },
            { label: "Fase finale", value: ({ single: "Eliminazione diretta", double: "Doppia eliminazione", gold_silver: "Gold e Silver" })[formula] || "Da scegliere" }].map((item) => <div key={item.label} className="rounded-xl bg-slate-50 p-4"><span className="block text-xs text-slate-500">{item.label}</span><strong className="mt-2 block">{item.value}</strong></div>)}
        </div>
        {participants.length ? <ol className="mb-5 grid list-inside list-decimal gap-2 text-sm sm:grid-cols-2">{participants.map((p, i) => <li key={p.id || i} className="rounded-lg border border-slate-100 p-3">{p.giocatori}</li>)}</ol>
          : <p className="mb-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Non ci sono squadre approvate. Verifica le iscrizioni prima di distribuire le squadre nei gironi.</p>}
        <div className="flex flex-wrap gap-3"><button className={actionClass} onClick={() => onNavigate("groups")}>Configura i gironi →</button><button className="rounded-xl border px-4 py-3 text-sm" onClick={() => setReload((n) => n + 1)}>Aggiorna partecipanti</button></div>
      </>}
    </section>
    {(visited.includes("groups") || step === "groups") && <section hidden={step !== "groups"} aria-label="Gestione gironi a squadre">
      <TeamGroups tournament={tournament} embedded active={step === "groups"} saveRef={groupsRef} onSummary={onSummary} />
    </section>}
    {(visited.includes("ranking") || step === "ranking") && <section hidden={step !== "ranking"} aria-label="Classifica del torneo">
      <TeamRanking tournament={tournament} embedded active={step === "ranking"} />
    </section>}
    {(visited.includes("finals") || step === "finals") && <section hidden={step !== "finals"} aria-label="Fase finale del torneo">
      <TeamFinals tournament={tournament} embedded active={step === "finals"} saveRef={finalsRef} onSummary={onSummary} />
    </section>}
  </div>;
}

export default function TournamentManagement() {
  const [tournaments, setTournaments] = useState([]);
  const [family, setFamily] = useState("teams");
  const [selected, setSelected] = useState("");
  const [step, setStep] = useState("prepare");
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [navigating, setNavigating] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const workspaceRef = useRef(null);
  const receiveSummary = useCallback((value) => setSummary((previous) => ({ ...previous, ...value })), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    readList("tornei").then((list) => {
      if (cancelled) return;
      const available = list.filter((t) => ["Iscrizioni Aperte", "In Programmazione", "Concluso"].includes(t.stato));
      const params = new URLSearchParams(window.location.search);
      const requested = available.find((t) => t.nome === params.get("tour"));
      const nextFamily = requested ? isGiallo(requested) ? "giallo" : "teams" : params.get("tipo") === "giallo" ? "giallo" : "teams";
      const nextTournament = requested || available.find((t) => isGiallo(t) === (nextFamily === "giallo"));
      setTournaments(available); setFamily(nextFamily); setSelected(nextTournament?.nome || "");
      setStep(WORKFLOW_STEPS.some((s) => s.id === params.get("fase")) ? params.get("fase") : "prepare");
    }).catch((reason) => { if (!cancelled) setError(reason.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  const updateUrl = (nextFamily, tour, nextStep) => {
    window.history.replaceState(window.history.state, "", managementHref({ family: nextFamily, tour, step: nextStep }));
  };
  const navigate = async (next, internal = false) => {
    if (next === step || navigating || (!internal && summary.busy)) return;
    setNavigating(true); setError("");
    try {
      if (step === "groups" && summary.scoreDrafts) throw new Error("Ci sono punteggi non salvati. Salva o scarta le bozze prima di cambiare sezione.");
      await workspaceRef.current?.flush();
      setStep(next); updateUrl(family, selected, next);
    } catch (reason) { setError(reason.message); }
    finally { setNavigating(false); }
  };
  const choose = async (nextFamily, name) => {
    if (navigating || summary.busy || (nextFamily === family && name === selected)) return;
    setNavigating(true); setError("");
    try {
      await workspaceRef.current?.flush();
      if (family === "giallo" && selected && !window.confirm("Cambiare torneo? I punteggi digitati ma non salvati dal relativo pulsante andranno persi.")) return;
      setSummary({}); setFamily(nextFamily); setSelected(name); setStep("prepare");
      updateUrl(nextFamily, name, "prepare");
    } catch (reason) { setError(reason.message); }
    finally { setNavigating(false); }
  };
  const available = tournaments.filter((t) => isGiallo(t) === (family === "giallo"));
  const tournament = available.find((t) => t.nome === selected);
  return <main className="min-h-screen bg-[#f5f7fa] pb-20 text-[#0a1628]">
    <StaffHeader />
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {error && <div role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-red-800">{error}{!tournaments.length && <button className="ml-3 underline" onClick={() => setReload((n) => n + 1)}>Riprova</button>}</div>}
      {loading ? <p role="status">Caricamento gestione torneo…</p> : <>
        <TournamentSetupHeader family={family} step={step} tournaments={available} selected={selected}
          onSelect={(name) => choose(family, name)} summary={summary} disabled={navigating || summary.busy}
          onStepChange={navigate} onFamilyChange={(next) => {
            if (next === family) return;
            choose(next, tournaments.find((t) => isGiallo(t) === (next === "giallo"))?.nome || "");
          }} />
        {navigating && <p role="status" className="mb-4 text-sm text-slate-600">Verifica e salvataggio delle modifiche…</p>}
        {tournament && <div inert={navigating || undefined} aria-busy={navigating}>
          <TournamentWorkspace key={tournament.id || tournament.nome} tournament={tournament} step={step}
            onNavigate={navigate} onSummary={receiveSummary} saveRef={workspaceRef} />
        </div>}
      </>}
    </div>
  </main>;
}
