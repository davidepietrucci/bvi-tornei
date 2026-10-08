import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getIscrizioni, getTornei, getGironi, getBracket } from "@/app/utils/db-server";
import TournamentPublicView from "./TournamentPublicView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function findTournament(id) {
  const tournaments = await getTornei();
  if (!Array.isArray(tournaments)) return null;
  const rawId = String(id || "").trim();
  const decodedId = decodeURIComponent(rawId).trim();
  return tournaments.find((item) => 
    String(item.id) === rawId || 
    String(item.id) === decodedId ||
    String(item.nome || "").toLowerCase().trim() === decodedId.toLowerCase()
  ) || null;
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const tournament = await findTournament(id);
  if (!tournament) return { title: "Torneo non trovato | BVI" };

  const description = [tournament.categoria, tournament.data, tournament.location]
    .filter(Boolean)
    .join(" · ");

  return {
    title: `${tournament.nome} | BVI Tornei`,
    description: `${description || "Torneo Beach Volley Institute"}. Informazioni, iscrizioni e risultati del torneo.`,
    openGraph: {
      title: `${tournament.nome} | BVI Tornei`,
      description: `${description || "Torneo Beach Volley Institute"}. Scopri i dettagli e segui il torneo.`,
      images: ["/images/maschile-bg.jpg"],
    },
  };
}

function isConfirmed(registration) {
  const status = String(registration.stato || "").trim().toLocaleLowerCase("it-IT");
  return !status || status.startsWith("approvat") || status.startsWith("confermat") || status === "ok";
}

export default async function TournamentPage({ params }) {
  const { id } = await params;
  const tournament = await findTournament(id);
  if (!tournament) notFound();

  const slug = String(tournament.nome || "").toLowerCase().trim().replace(/\s+/g, '_');

  let registrations = [];
  let gironiData = null;
  let bracketData = null;

  try {
    const [rawRegs, rawGironi, rawBracket] = await Promise.all([
      getIscrizioni().catch(() => []),
      getGironi(slug).catch(() => null),
      getBracket(slug).catch(() => null)
    ]);
    registrations = Array.isArray(rawRegs) ? JSON.parse(JSON.stringify(rawRegs)) : [];
    gironiData = rawGironi ? JSON.parse(JSON.stringify(rawGironi)) : null;
    bracketData = rawBracket ? JSON.parse(JSON.stringify(rawBracket)) : null;
  } catch (e) {
    console.error("Errore nel recupero dati torneo:", e);
  }

  const tournamentName = String(tournament.nome || "").trim().toLocaleLowerCase("it-IT");
  const confirmedRegistrations = registrations.filter((registration) =>
    String(registration.torneo || "").trim().toLocaleLowerCase("it-IT") === tournamentName
      && registration.stato !== "Annullata"
      && isConfirmed(registration)
  );

  const cleanTournament = JSON.parse(JSON.stringify(tournament));
  const cleanConfirmed = JSON.parse(JSON.stringify(confirmedRegistrations));

  const isOpen = cleanTournament.stato === "Iscrizioni Aperte";
  const isIndividual = (() => {
    const cat = String(tournament.categoria || "").toLowerCase().trim();
    if (cat.includes("2x2") || cat.includes("4x4") || cat.includes("coppi")) {
      return false;
    }
    if (tournament.formato === "coppia" || tournament.tipoIscrizione === "coppia") {
      return false;
    }
    if (cat.includes("giallo") || cat.includes("1x1") || cat.includes("singol") || tournament.formato === "singolo" || tournament.tipoIscrizione === "singola") {
      return true;
    }
    return false;
  })();
  const capacity = Number(tournament.maxSquadre) || 0;
  const isFull = capacity > 0 && confirmedRegistrations.length >= capacity;
  const placesLeft = capacity > 0 ? Math.max(0, capacity - confirmedRegistrations.length) : null;
  const category = String(tournament.categoria || "Categoria libera");
  const heroImage = category.toLocaleLowerCase("it-IT").includes("femminile") ? "/images/femminile-bg.jpg" : "/images/maschile-bg.jpg";
  const participantLabel = isIndividual ? "atleti" : "squadre";

  return (
    <main className="min-h-screen bg-[#f5f4ef] text-[#101d2c]">
      <div className="h-1.5 bg-[#f5ca3e]" />
      <header className="bg-[#101d2c] text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3" aria-label="BVI Tornei, home">
            <Image src="/logo.png" alt="BVI" width={42} height={42} className="rounded-full bg-white" />
            <span className="text-lg font-black">BVI <span className="text-[#f5ca3e]">/</span> TORNEI</span>
          </Link>
          <nav className="flex items-center gap-2 sm:gap-5" aria-label="Navigazione torneo">
            <Link href="/#tornei" className="hidden text-sm font-semibold text-white/75 hover:text-[#f5ca3e] sm:block">Calendario</Link>
            <Link href="/classifica" className="hidden text-sm font-semibold text-white/75 hover:text-[#f5ca3e] sm:block">Classifiche</Link>
            <Link href="/atleta" className="rounded-lg bg-[#f5ca3e] px-4 py-2.5 text-xs font-black text-[#101d2c] hover:bg-yellow-300">Area atleta ↗</Link>
          </nav>
        </div>
      </header>

      {/* Vista pubblica con dettagli, anteprima, classifiche in linea e popup per tutte le iscrizioni */}
      <TournamentPublicView
        tournament={cleanTournament}
        confirmedRegistrations={cleanConfirmed}
        gironiData={gironiData}
        bracketData={bracketData}
        isIndividual={isIndividual}
        capacity={capacity}
        isOpen={isOpen}
        isFull={isFull}
        placesLeft={placesLeft}
        category={category}
        participantLabel={participantLabel}
        heroImage={heroImage}
      />

      <footer className="border-t border-[#101d2c]/10 bg-white px-5 py-6 text-center text-xs font-semibold text-[#657080] sm:px-8">
        <Link href="/" className="font-black text-[#101d2c] hover:text-[#78600d]">Beach Volley Institute · BVI Tornei</Link>
        <span className="mx-2">·</span>
        <Link href="/#tornei" className="hover:text-[#101d2c]">Tutti i tornei</Link>
      </footer>
    </main>
  );
}
