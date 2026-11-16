"use client";

import { useEffect, useState } from "react";
import StaffHeader from "@/app/components/StaffHeader";
import TournamentSetupHeader from "@/app/components/TournamentSetupHeader";
import GialloTournament from "@/app/components/GialloTournament";
import { getTornei } from "@/app/utils/db";
import { isGiallo } from "@/app/utils/giallo";

export default function StaffGiallo() {
  const [tournaments, setTournaments] = useState([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    getTornei().then((list) => {
      if (cancelled) return;
      const available = list.filter((t) => isGiallo(t) && ["Iscrizioni Aperte", "In Programmazione", "Concluso"].includes(t.stato));
      const requested = new URLSearchParams(window.location.search).get("tour");
      setTournaments(available);
      setSelected(available.some((t) => t.nome === requested) ? requested : available[0]?.nome || "");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);
  const tournament = tournaments.find((t) => t.nome === selected);
  return <main className="min-h-screen bg-[#f5f7fa] pb-20 text-[#0a1628]">
    <StaffHeader />
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {loading ? <p role="status">Caricamento tornei…</p> : <>
        <TournamentSetupHeader family="giallo" tournaments={tournaments} selected={selected} onSelect={setSelected} />
        {tournament && <GialloTournament tournament={tournament} editable embedded />}
      </>}
    </div>
  </main>;
}
