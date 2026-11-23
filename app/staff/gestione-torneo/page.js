"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import dynamic from "next/dynamic";
import StaffHeader from "@/app/components/StaffHeader";
import TournamentSetupHeader from "@/app/components/TournamentSetupHeader";
import GialloTournament from "@/app/components/GialloTournament";
import TournamentOverview from "@/app/components/tournament/TournamentOverview";
import { isGiallo, gialloSlug } from "@/app/utils/giallo";
import { managementHref, readWorkflowConfig, tournamentNextAction, WORKFLOW_STEPS } from "@/app/utils/tournament-workflow";
import { completedMatch, teamGroupMatches } from "@/app/utils/match-scoring";
import { finalMatchGroups } from "@/app/utils/final-scoring";

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

function TournamentWorkspace({ tournament, step, onNavigate, onSummary, saveRef, workspaceMode }) {
  const groupsRef = useRef(null);
  const finalsRef = useRef(null);
  const yellowRef = useRef(null);
  const [visited, setVisited] = useState([step]);
  const [participants, setParticipants] = useState([]);
  const [formula, setFormula] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const yellow = isGiallo(tournament);

  useEffect(() => { setVisited((list) => list.includes(step) ? list : [...list, step]); }, [step]);
  useImperativeHandle(saveRef, () => ({ flush: async () => {
    if (yellow || step === "prepare" || step === "ranking" || step === "summary") return;
    const editor = step === "groups" ? groupsRef.current : finalsRef.current;
    if (!editor) throw new Error("Attendi il caricamento della sezione prima di proseguire.");
    await editor.flush();
  }, publish: async (phase) => {
    const editor = yellow ? yellowRef.current : phase === "groups" ? groupsRef.current : finalsRef.current;
    if (!editor?.publish) throw new Error("Attendi il caricamento della pubblicazione e riprova.");
    return editor.publish(phase);
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
        const groupMatches = teamGroupMatches({ numGironi: 0, gironeAssignments: {}, gironeTypes: {}, gironeSets: {}, teamCounts: {}, matchMetadata: {}, ...groups }).flatMap(g => g.matches);
        const finalMatches = finalMatchGroups(finals || {}).flatMap(g => g.matches);
        onSummary({ groupsPublished: Boolean(groups?.pubblicato), finalsPublished: Boolean(finals?.tabellonePubblicato), groupCount: groups?.numGironi || 0,
          groupsConfigured: groupMatches.length > 0 && Array.from({ length: groups?.numGironi || 0 }, (_, index) => String.fromCharCode(65 + index)).every(id =>
            (groups.teamCounts?.[id] || 0) > 0 && Array.from({ length: groups.teamCounts[id] }, (_, index) => groups.gironeAssignments?.[id]?.[index]).every(name => name && name !== "—" && name !== "Slot Libero")),
          finalsConfigured: Boolean(Object.values(finals?.bracketAssignments || {}).some(Boolean)),
          groupMatches: groupMatches.length, groupCompleted: groupMatches.filter(completedMatch).length,
          finalMatches: finalMatches.length, finalCompleted: finalMatches.filter(completedMatch).length, summaryReady: true });
      }).catch((reason) => { if (!cancelled) setError(reason.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [yellow, tournament.nome, onSummary, reload]);

  if (yellow) return <GialloTournament tournament={tournament} editable embedded workflowView={step} workspaceMode={workspaceMode} saveRef={yellowRef} sharedPublication
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
    <section hidden={step !== "groups"} aria-label="Gestione gironi a squadre">
      <TeamGroups tournament={tournament} embedded sharedPublication active={step === "groups"} workspaceMode={workspaceMode} saveRef={groupsRef} onSummary={onSummary} />
    </section>
    {(visited.includes("ranking") || step === "ranking") && <section hidden={step !== "ranking"} aria-label="Classifica del torneo">
      <TeamRanking tournament={tournament} embedded active={step === "ranking"} />
    </section>}
    <section hidden={step !== "finals"} aria-label="Fase finale del torneo">
      <TeamFinals tournament={tournament} embedded sharedPublication active={step === "finals"} workspaceMode={workspaceMode} saveRef={finalsRef} onSummary={onSummary} />
    </section>
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
  const [workspaceMode, setWorkspaceMode] = useState("prepare");
  const [publicationSaving, setPublicationSaving] = useState("");
  const publicationLock = useRef(false);
  const workspaceRef = useRef(null);
  const receiveSummary = useCallback(({ updatedTournament, ...value }) => {
    setSummary(previous => ({ ...previous, ...value }));
    if (updatedTournament) setTournaments(list => list.map(item => String(item.id) === String(updatedTournament.id) && item.nome === updatedTournament.nome ? updatedTournament : item));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError("");
    readList("tornei").then((list) => {
      if (cancelled) return;
      const available = list.filter((t) => ["Iscrizioni Aperte", "In Programmazione", "In Corso", "Concluso"].includes(t.stato));
      const params = new URLSearchParams(window.location.search);
      const requested = available.find((t) => t.nome === params.get("tour"));
      const nextFamily = requested ? isGiallo(requested) ? "giallo" : "teams" : params.get("tipo") === "giallo" ? "giallo" : "teams";
      const nextTournament = requested || available.find((t) => isGiallo(t) === (nextFamily === "giallo"));
      setTournaments(available); setFamily(nextFamily); setSelected(nextTournament?.nome || "");
      const requestedMode = params.get("vista") === "day" ? "day" : "prepare";
      const requestedStep = WORKFLOW_STEPS.some((s) => s.id === params.get("fase")) || params.get("fase") === "summary" ? params.get("fase") : "prepare";
      setWorkspaceMode(requestedMode);
      setStep(requestedMode === "day" && !["groups", "finals", "ranking"].includes(requestedStep) ? "groups" : requestedStep);
    }).catch((reason) => { if (!cancelled) setError(reason.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

  const updateUrl = (nextFamily, tour, nextStep, mode = workspaceMode) => {
    window.history.replaceState(window.history.state, "", managementHref({ family: nextFamily, tour, step: nextStep, mode }));
  };
  const navigate = async (next, internal = false, nextMode = workspaceMode) => {
    if ((next === step && nextMode === workspaceMode) || navigating || publicationLock.current || (!internal && summary.busy)) return;
    setNavigating(true); setError("");
    try {
      if (summary.scoreDrafts) throw new Error("Ci sono modifiche alle partite non salvate. Salva o scarta le bozze prima di cambiare sezione.");
      await workspaceRef.current?.flush();
      setStep(next); setWorkspaceMode(nextMode); updateUrl(family, selected, next, nextMode);
    } catch (reason) { setError(reason.message); }
    finally { setNavigating(false); }
  };
  const choose = async (nextFamily, name) => {
    if (navigating || publicationLock.current || summary.busy || (nextFamily === family && name === selected)) return;
    setNavigating(true); setError("");
    try {
      if (summary.scoreDrafts) throw new Error("Salva o scarta le bozze delle partite prima di cambiare torneo.");
      await workspaceRef.current?.flush();
      if (family === "giallo" && selected && !window.confirm("Cambiare torneo? Le modifiche non salvate a punteggi, campo, orario e stato andranno perse.")) return;
      setSummary({}); setFamily(nextFamily); setSelected(name); setStep("prepare"); setWorkspaceMode("prepare");
      updateUrl(nextFamily, name, "prepare", "prepare");
    } catch (reason) { setError(reason.message); }
    finally { setNavigating(false); }
  };
  const available = tournaments.filter((t) => isGiallo(t) === (family === "giallo"));
  const tournament = available.find((t) => t.nome === selected);
  const nextAction = summary.summaryReady ? tournamentNextAction(summary) : null;
  const publish = async (phase) => {
    if (publicationLock.current || navigating || summary.busy) return;
    if (summary.scoreDrafts) { setError("Salva o scarta le bozze delle partite prima di cambiare la pubblicazione."); return; }
    publicationLock.current = true; setPublicationSaving(phase); setError("");
    try {
      if (!workspaceRef.current?.publish) throw new Error("Attendi il caricamento del torneo e riprova.");
      const visible = await workspaceRef.current.publish(phase);
      if (typeof visible !== "boolean") throw new Error("Pubblicazione non confermata. Riprova.");
      setSummary(previous => ({ ...previous, [phase === "groups" ? "groupsPublished" : "finalsPublished"]: visible }));
    } catch (reason) { setError(reason.message); }
    finally { publicationLock.current = false; setPublicationSaving(""); }
  };
  return <main className="min-h-screen bg-[#f5f7fa] pb-20 text-[#0a1628]">
    <StaffHeader />
    <div className="staff-tournament-workspace mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {error && <div role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-red-800">{error}{!tournaments.length && <button className="ml-3 underline" onClick={() => setReload((n) => n + 1)}>Riprova</button>}</div>}
      {loading ? <p role="status">Caricamento gestione torneo…</p> : <>
        <TournamentSetupHeader family={family} step={step} tournaments={available} selected={selected}
          workspaceMode={workspaceMode} onModeChange={(mode) => navigate(mode === "day" ? ["groups", "finals"].includes(step) ? step : "groups" : "summary", false, mode)}
          onSelect={(name) => choose(family, name)} summary={summary} disabled={navigating || summary.busy || Boolean(publicationSaving)} onPublish={publish} publicationSaving={publicationSaving}
          onStepChange={navigate} onFamilyChange={(next) => {
            if (next === family) return;
            choose(next, tournaments.find((t) => isGiallo(t) === (next === "giallo"))?.nome || "");
          }} />
        {navigating && <p role="status" className="mb-4 text-sm text-slate-600">Verifica e salvataggio delle modifiche…</p>}
        {tournament && workspaceMode === "day" && nextAction && <aside className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4"><div><p className="text-sm font-bold">{nextAction.label}</p><p className="mt-1 text-sm text-slate-600">{nextAction.detail}</p></div>{(step !== nextAction.step || workspaceMode !== nextAction.mode) && <button type="button" disabled={navigating || summary.busy} onClick={() => navigate(nextAction.step, false, nextAction.mode)} className="min-h-11 rounded-xl bg-[#0a1628] px-4 py-3 text-sm font-bold text-white disabled:opacity-40">Apri →</button>}</aside>}
        {tournament && step === "ranking" && <button type="button" disabled={navigating || summary.busy} onClick={() => navigate(workspaceMode === "day" ? "groups" : "summary")} className="mb-4 min-h-11 text-sm font-bold underline">← {workspaceMode === "day" ? "Torna alle partite" : "Torna al riepilogo"}</button>}
        {tournament && <div inert={navigating || Boolean(publicationSaving) || undefined} aria-busy={navigating || Boolean(publicationSaving)}>
          <TournamentWorkspace key={tournament.id || tournament.nome} tournament={tournament} step={step}
            workspaceMode={workspaceMode} onNavigate={navigate} onSummary={receiveSummary} saveRef={workspaceRef} />
          {step === "summary" && (summary.summaryReady ? <TournamentOverview tournament={tournament} summary={summary} disabled={navigating || summary.busy} onNavigate={(next, mode) => navigate(next, false, mode)} /> : <p role="status">Verifica configurazione del torneo…</p>)}
        </div>}
      </>}
    </div>
  </main>;
}
