"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StaffHeader from "@/app/components/StaffHeader";
import { getIscrizioni, getTornei } from "@/app/utils/db";
import { getCircuitLeaderboard, normalizeCircuitName } from "@/app/utils/circuit";

export default function StaffTour() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [selectedCircuit, setSelectedCircuit] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [allTournaments, allRegistrations] = await Promise.all([getTornei(), getIscrizioni()]);
        if (cancelled) return;
        setTournaments(Array.isArray(allTournaments) ? allTournaments : []);
        setRegistrations(Array.isArray(allRegistrations) ? allRegistrations : []);
        setSelectedCircuit((current) => current || allTournaments?.find((tournament) => tournament.circuitRole === "tappa")?.circuitName || "");
        setError("");
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || "Non è stato possibile caricare la classifica del tour.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const circuits = useMemo(() => {
    const names = new Map();
    for (const tournament of tournaments) {
      if (tournament.circuitRole !== "tappa" || !tournament.circuitName) continue;
      const key = normalizeCircuitName(tournament.circuitName);
      if (key && !names.has(key)) names.set(key, String(tournament.circuitName).trim());
    }
    return [...names.values()];
  }, [tournaments]);
  const finals = tournaments.filter((tournament) =>
    tournament.circuitRole === "finale" && normalizeCircuitName(tournament.circuitName) === normalizeCircuitName(selectedCircuit)
  );
  const qualifierLimit = Number(finals[0]?.circuitQualifiers) || 0;
  const leaderboard = useMemo(
    () => getCircuitLeaderboard(tournaments, registrations, selectedCircuit),
    [tournaments, registrations, selectedCircuit]
  );

  return (
    <main className="min-h-screen bg-[#f8faff] pb-20">
      <StaffHeader />
      <div className="mx-auto max-w-5xl px-4 pt-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-500">Circuito</p>
            <h1 className="mt-1 text-3xl font-black uppercase tracking-tight text-[#0a1628]">Classifica Tour</h1>
            <p className="mt-2 text-sm font-medium text-gray-500">I punti arrivano dalle tappe concluse con piazzamento assegnato.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push("/staff/tornei/nuovo")} className="rounded-xl bg-[#0a1628] px-4 py-3 text-xs font-black uppercase tracking-wide text-white">Nuovo torneo</button>
            <button onClick={() => router.push("/staff/iscrizioni")} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-wide text-[#0a1628]">Piazzamenti</button>
          </div>
        </div>

        {circuits.length > 0 && (
          <label className="mt-6 block max-w-sm">
            <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-gray-400">Seleziona tour</span>
            <select value={selectedCircuit} onChange={(event) => setSelectedCircuit(event.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 font-bold text-[#0a1628]">
              {circuits.map((circuit) => <option key={circuit} value={circuit}>{circuit}</option>)}
            </select>
          </label>
        )}

        {finals.length > 0 && (
          <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-900">
            {finals.map((final) => `${final.nome}: top ${final.circuitQualifiers || "—"} atleti`).join(" · ")}
          </div>
        )}

        {loading ? (
          <div className="mt-8 rounded-3xl bg-white p-10 text-center text-sm font-semibold text-gray-400">Caricamento classifica…</div>
        ) : error ? (
          <div className="mt-8 rounded-3xl border border-red-100 bg-white p-6 text-sm font-semibold text-red-600">{error}</div>
        ) : circuits.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-lg font-black text-[#0a1628]">Nessun tour configurato</p>
            <p className="mt-2 text-sm text-gray-500">Crea un torneo e assegnagli un nome tour e il ruolo “Tappa di qualificazione”.</p>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="mt-8 rounded-3xl bg-white p-10 text-center text-sm font-semibold text-gray-400">La classifica si popolerà quando una tappa sarà conclusa e lo staff avrà inserito i piazzamenti.</div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left">
                <thead className="bg-[#0a1628] text-[10px] font-black uppercase tracking-widest text-white/70">
                  <tr>
                    <th className="px-5 py-4">Pos.</th>
                    <th className="px-5 py-4">Atleta</th>
                    <th className="px-5 py-4 text-center">Tappe</th>
                    <th className="px-5 py-4 text-right">Punti</th>
                    {qualifierLimit > 0 && <th className="px-5 py-4 text-right">Finale</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leaderboard.map((athlete) => {
                    const qualified = qualifierLimit > 0 && athlete.posizione <= qualifierLimit;
                    return (
                      <tr key={athlete.userIds[0] || athlete.emails[0] || athlete.nome} className={qualified ? "bg-green-50/50" : ""}>
                        <td className="px-5 py-4 font-black text-[#0a1628]">#{athlete.posizione}</td>
                        <td className="px-5 py-4 font-bold text-[#0a1628]">{athlete.nome}</td>
                        <td className="px-5 py-4 text-center font-semibold text-gray-500">{athlete.tappe}</td>
                        <td className="px-5 py-4 text-right text-lg font-black text-[#0a1628]">{athlete.punti}</td>
                        {qualifierLimit > 0 && <td className="px-5 py-4 text-right text-[10px] font-black uppercase tracking-wide">{qualified ? <span className="text-green-700">Qualificato</span> : <span className="text-gray-300">—</span>}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
