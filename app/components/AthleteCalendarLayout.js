"use client";

import AthleteHeader from "@/app/components/AthleteHeader";
import AthleteBottomNav from "@/app/components/AthleteBottomNav";
import SponsorBanner from "@/app/components/SponsorBanner";

export function athleteCalendarBackground(tournament) {
  if (tournament?.sfondo) return tournament.sfondo;
  const category = `${tournament?.categoria || ""} ${tournament?.nome || ""}`.toLowerCase();
  if (category.includes("femminile") || tournament?.nome?.toLowerCase() === "prova") return "/images/femminile-bg.jpg";
  if (category.includes("maschile")) return "/images/maschile-bg.jpg";
  return null;
}

export default function AthleteCalendarLayout({ tournament, viewControl, children, wide = false }) {
  const background = athleteCalendarBackground(tournament);
  return <main className="relative min-h-screen bg-[#f0f4ff] pb-28 text-[#0a1628] xl:pl-72">
    {background && <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-cover bg-center bg-no-repeat opacity-[.32] xl:left-72" style={{ backgroundImage: `url(${JSON.stringify(background)})`, filter: "contrast(1.05) brightness(.95)" }} />}
    <div className="relative">
      <AthleteHeader />
      <section aria-label="Live area atleta" className="border-b-4 border-[#FFD700] bg-[#0a1628] px-4 py-3 text-white">
        <div className={`mx-auto flex items-center justify-between gap-3 ${wide ? "max-w-5xl" : "max-w-2xl"}`}>
          <div className="min-w-0"><h1 className="text-sm font-black uppercase tracking-wide text-[#FFD700]">BVI Live · Area atleta</h1><p className="mt-1 truncate text-xs font-semibold">{tournament?.nome || "Gironi & Calendario"}</p></div>
          {tournament?.stato && <span className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold">{tournament.stato}</span>}
        </div>
      </section>
      <div className={`mx-auto px-3 pt-2 sm:px-5 ${wide ? "max-w-5xl" : "max-w-2xl"}`}>
        <SponsorBanner />
        {viewControl}
        {children}
      </div>
      <AthleteBottomNav />
    </div>
  </main>;
}
