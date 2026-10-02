"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import StaffHeader from "@/app/components/StaffHeader";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("it-IT");
}

function roleLabel(role) {
  const normalized = String(role || "atleta").toLocaleLowerCase("it-IT");
  if (normalized === "admin") return "Admin";
  if (normalized === "staff") return "Staff";
  return "Atleta";
}

async function readResponse(response) {
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || "Errore durante il caricamento.");
  return json.data;
}

export default function StaffAtleti() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [atleti, setAtleti] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAtleta, setSelectedAtleta] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      router.replace("/staff");
      return;
    }
    if (user.publicMetadata?.role !== "admin") {
      router.replace("/staff/dashboard");
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    fetch("/api/staff/atleti", { cache: "no-store", signal: controller.signal })
      .then(readResponse)
      .then((data) => setAtleti(Array.isArray(data) ? data : []))
      .catch((fetchError) => {
        if (fetchError.name !== "AbortError") setError(fetchError.message || "Non è stato possibile caricare gli atleti.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [isLoaded, router, user]);

  const filteredAtleti = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase("it-IT");
    if (!search) return atleti;
    return atleti.filter((athlete) =>
      [athlete.nome, athlete.cognome, athlete.email, athlete.username, athlete.id]
        .some((value) => String(value || "").toLocaleLowerCase("it-IT").includes(search))
    );
  }, [atleti, searchTerm]);

  const openProfile = async (athlete) => {
    setSelectedAtleta({ ...athlete, iscrizioni: [] });
    setDetailLoading(true);
    setDetailError("");
    try {
      const params = new URLSearchParams({ userId: athlete.id });
      const data = await readResponse(await fetch(`/api/staff/atleti?${params}`, { cache: "no-store" }));
      setSelectedAtleta(data);
    } catch (fetchError) {
      setDetailError(fetchError.message || "Non è stato possibile caricare il profilo.");
    } finally {
      setDetailLoading(false);
    }
  };

  const fullName = (athlete) => `${athlete.nome || ""} ${athlete.cognome || ""}`.trim() || athlete.username || athlete.email || "Atleta";

  return (
    <main className="min-h-screen pb-20 bg-[#f8faff]">
      <StaffHeader />

      <div className="max-w-6xl mx-auto mt-6 md:mt-10 px-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-5">
          <div>
            <h2 className="text-3xl md:text-5xl font-black text-[#0a1628] uppercase tracking-tighter leading-none">Anagrafica Atleti 👤</h2>
            <p className="text-[10px] md:text-xs text-gray-400 font-bold uppercase tracking-widest mt-2">Account registrati nell’area atleta</p>
            <p className="text-sm text-gray-500 mt-3">Gli account Clerk compaiono qui automaticamente dopo la registrazione.</p>
          </div>
          <div className="w-full md:w-80">
            <label htmlFor="athlete-search" className="sr-only">Cerca atleta</label>
            <input
              id="athlete-search"
              type="search"
              placeholder="Cerca per nome, email o ID…"
              className="w-full pl-5 pr-4 py-4 bg-white border-2 border-gray-100 rounded-2xl focus:border-[#0a1628] outline-none transition-all shadow-sm text-sm font-bold text-gray-900"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between rounded-2xl bg-white px-5 py-4 border border-gray-100 shadow-sm">
          <span className="text-xs font-black uppercase tracking-widest text-gray-500">Atleti trovati</span>
          <span className="text-2xl font-black text-[#0a1628]">{loading ? "…" : filteredAtleti.length}</span>
        </div>

        {error && <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-5 text-sm font-bold text-red-700">{error}</div>}

        <div className="space-y-3">
          {loading ? (
            <div className="rounded-3xl bg-white p-12 text-center text-sm font-bold text-gray-400 shadow-sm">Caricamento anagrafica…</div>
          ) : filteredAtleti.length === 0 ? (
            <div className="rounded-3xl bg-white p-12 text-center text-sm font-bold text-gray-400 shadow-sm">
              {atleti.length === 0 ? "Non ci sono ancora account atleta registrati." : "Nessun atleta corrisponde alla ricerca."}
            </div>
          ) : filteredAtleti.map((athlete) => (
            <article key={athlete.id} className="bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-[#0a1628] text-[#FFD700] flex items-center justify-center font-black text-sm shrink-0">
                  {(athlete.nome || athlete.email || "A").charAt(0).toUpperCase()}{(athlete.cognome || "").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-black text-lg text-[#0a1628] truncate">{fullName(athlete)}</h3>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
                      String(athlete.role).toLocaleLowerCase("it-IT") === "admin"
                        ? "bg-purple-100 text-purple-700"
                        : String(athlete.role).toLocaleLowerCase("it-IT") === "staff"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-blue-50 text-blue-700"
                    }`}>
                      {roleLabel(athlete.role)}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-500 truncate">{athlete.email || "Email non disponibile"}</p>
                  <p className="mt-1 text-[10px] font-bold text-gray-400">Registrato il {formatDate(athlete.dataRegistrazione)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between md:justify-end gap-4">
                <span className="rounded-xl bg-blue-50 px-3 py-2 text-[10px] font-black uppercase tracking-wider text-blue-700">
                  {athlete.iscrizioni} {athlete.iscrizioni === 1 ? "iscrizione" : "iscrizioni"}
                </span>
                <button
                  type="button"
                  onClick={() => openProfile(athlete)}
                  className="px-5 py-3 bg-[#0a1628] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors"
                >
                  Vedi profilo
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {selectedAtleta && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedAtleta(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="athlete-profile-title" className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 bg-[#0a1628] p-6 text-white flex items-start justify-between gap-4 rounded-t-3xl">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#FFD700]">Profilo atleta</p>
                <div className="mt-1 flex items-center gap-2 min-w-0">
                  <h2 id="athlete-profile-title" className="text-2xl font-black truncate">{fullName(selectedAtleta)}</h2>
                  <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-white">{roleLabel(selectedAtleta.role)}</span>
                </div>
                <p className="mt-1 text-sm text-white/70 truncate">{selectedAtleta.email || "Email non disponibile"}</p>
              </div>
              <button type="button" aria-label="Chiudi profilo" onClick={() => setSelectedAtleta(null)} className="rounded-xl bg-white/10 px-3 py-2 text-white hover:bg-white/20">✕</button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">ID Clerk</p>
                  <p className="mt-1 break-all text-xs font-bold text-[#0a1628]">{selectedAtleta.id}</p>
                </div>
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Registrazione</p>
                  <p className="mt-1 text-sm font-bold text-[#0a1628]">{formatDate(selectedAtleta.dataRegistrazione)}</p>
                </div>
                {selectedAtleta.username && (
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Username</p>
                    <p className="mt-1 text-sm font-bold text-[#0a1628]">{selectedAtleta.username}</p>
                  </div>
                )}
                <div className="rounded-2xl bg-gray-50 p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Ultimo accesso</p>
                  <p className="mt-1 text-sm font-bold text-[#0a1628]">{formatDate(selectedAtleta.ultimoAccesso)}</p>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-[#0a1628]">Iscrizioni ai tornei</h3>
                {detailLoading ? (
                  <p className="mt-3 rounded-2xl bg-gray-50 p-5 text-sm font-semibold text-gray-400">Caricamento iscrizioni…</p>
                ) : detailError ? (
                  <p className="mt-3 rounded-2xl bg-red-50 p-5 text-sm font-semibold text-red-700">{detailError}</p>
                ) : selectedAtleta.iscrizioni?.length ? (
                  <div className="mt-3 divide-y divide-gray-100 rounded-2xl border border-gray-100">
                    {selectedAtleta.iscrizioni.map((registration) => (
                      <div key={registration.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="font-black text-[#0a1628]">{registration.torneo}</p>
                          <p className="mt-1 text-xs text-gray-500">{registration.giocatori || "Partecipazione singola"} · {formatDate(registration.data)}</p>
                        </div>
                        <span className="self-start sm:self-auto rounded-lg bg-gray-100 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-gray-600">{registration.stato}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 rounded-2xl bg-gray-50 p-5 text-sm font-semibold text-gray-500">Questo account non ha ancora iscrizioni ai tornei.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
