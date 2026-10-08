import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getIscrizioni, getTornei } from "@/app/utils/db-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function findTournament(id) {
  const tournaments = await getTornei();
  return (Array.isArray(tournaments) ? tournaments : []).find((item) => String(item.id) === String(id)) || null;
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

  const registrations = await getIscrizioni();
  const tournamentName = String(tournament.nome || "").trim().toLocaleLowerCase("it-IT");
  const confirmedRegistrations = (Array.isArray(registrations) ? registrations : []).filter((registration) =>
    String(registration.torneo || "").trim().toLocaleLowerCase("it-IT") === tournamentName
      && registration.stato !== "Annullata"
      && isConfirmed(registration)
  );

  const isOpen = tournament.stato === "Iscrizioni Aperte";
  const isIndividual = ["tappa", "finale"].includes(tournament.circuitRole) ||
    String(tournament.categoria || "").toLowerCase().includes("giallo") ||
    tournament.formato === "singolo" ||
    tournament.tipoIscrizione === "singola";
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

      <section className="mx-auto grid max-w-7xl gap-8 px-5 py-8 sm:px-8 sm:py-12 lg:grid-cols-[1.1fr_.9fr] lg:items-stretch">
        <div className="flex flex-col justify-center py-3">
          <Link href="/#tornei" className="mb-8 inline-flex w-fit items-center gap-2 text-xs font-bold text-[#657080] hover:text-[#101d2c">← Torna al calendario</Link>
          <p className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[.23em] text-[#78600d]"><span className="h-2 w-2 rounded-full bg-[#d6aa16]" /> Torneo BVI · {tournament.stato || "In Programmazione"}</p>
          <h1 className="max-w-3xl text-4xl font-black leading-[.98] tracking-[-.045em] sm:text-6xl">{tournament.nome}</h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#596574]">{tournament.circuitName ? `${tournament.circuitRole === "finale" ? "Finale" : "Tappa del tour"} ${tournament.circuitName}. ` : "Una giornata di beach volley firmata Beach Volley Institute. "}{category}</p>

          <div className="mt-8 grid max-w-xl grid-cols-2 gap-px overflow-hidden rounded-xl border border-[#101d2c]/10 bg-[#101d2c]/10 sm:grid-cols-4">
            <InfoTile label="Data" value={tournament.data || "Da definire"} />
            <InfoTile label="Luogo" value={tournament.location || "Da definire"} />
            <InfoTile label="Categoria" value={category} />
            <InfoTile label="Quota" value={`€${Number(tournament.quota ?? 40)}`} />
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {isOpen && !isFull && <Link href={`/atleta/iscriviti?tour=${encodeURIComponent(tournament.nome)}`} className="rounded-xl bg-[#101d2c] px-6 py-4 text-sm font-black text-white shadow-lg transition hover:bg-[#263d57]">Iscriviti dal Portale Atleta <span className="ml-2 text-[#f5ca3e]">↗</span></Link>}
            {isOpen && isFull && <span className="rounded-xl bg-gray-200 px-6 py-4 text-sm font-black text-gray-500">Posti esauriti</span>}
            {!isOpen && isFinished && <Link href={`/classifica?tour=${encodeURIComponent(tournament.nome)}`} className="rounded-xl bg-[#101d2c] px-6 py-4 text-sm font-black text-white shadow-lg hover:bg-[#263d57]">Vedi classifica finale ↗</Link>}
            {!isOpen && !isFinished && <Link href="/atleta" className="rounded-xl bg-[#101d2c] px-6 py-4 text-sm font-black text-white shadow-lg hover:bg-[#263d57]">Accedi all’Area Atleta ↗</Link>}
            <Link href={`/iscritti?tour=${encodeURIComponent(tournament.nome)}`} className="rounded-xl border border-[#101d2c]/20 px-5 py-4 text-sm font-bold hover:bg-white">Partecipanti</Link>
          </div>
          {isOpen && !isFull && <p className="mt-3 text-xs text-[#657080]">Iscrizione personale e gestione della richiesta dalla tua Area Atleta.</p>}
        </div>

        <div className="relative min-h-[360px] overflow-hidden rounded-[1.7rem] bg-[#101d2c] shadow-[0_28px_70px_-28px_rgba(16,29,44,.65)] sm:min-h-[470px]">
          <Image src={heroImage} alt={`Beach volley, ${tournament.nome}`} fill priority sizes="(max-width: 1024px) 100vw, 45vw" className="object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#071321]/90 via-[#071321]/10 to-transparent" />
          <div className="absolute left-5 top-5 rounded-lg border border-white/20 bg-[#101d2c]/75 px-3 py-2 text-[9px] font-black uppercase tracking-[.2em] text-white backdrop-blur-sm">BVI · {tournament.id ? `Evento #${tournament.id}` : "Evento"}</div>
          <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/15 bg-[#101d2c]/90 p-5 text-white backdrop-blur-md sm:inset-x-6 sm:bottom-6 sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-[#f5ca3e]">{capacity ? `Posti ${participantLabel}` : `Iscritti ${participantLabel}`}</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="text-3xl font-black">{confirmedRegistrations.length}{capacity > 0 && <span className="text-lg text-white/50"> / {capacity}</span>}</p>
              <p className="text-right text-xs font-semibold text-white/60">{placesLeft === null ? "Iscrizioni da confermare" : isFull ? "Capienza raggiunta" : `${placesLeft} ${placesLeft === 1 ? "posto" : "posti"} disponibili`}</p>
            </div>
            {capacity > 0 && <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#f5ca3e]" style={{ width: `${Math.min(100, (confirmedRegistrations.length / capacity) * 100)}%` }} /></div>}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 sm:px-8 sm:pb-20">
        <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
          <div className="rounded-2xl bg-[#101d2c] p-6 text-white sm:p-8">
            <p className="text-[10px] font-black uppercase tracking-[.23em] text-[#f5ca3e]">Informazioni utili</p>
            <h2 className="mt-3 text-2xl font-black">Tutto sul torneo</h2>
            <dl className="mt-6 divide-y divide-white/10">
              <DetailRow label="Stato" value={tournament.stato || "In Programmazione"} />
              <DetailRow label="Formato" value={isIndividual ? "Iscrizione singola" : "Iscrizione a coppie"} />
              <DetailRow label="Quota" value={`€${Number(tournament.quota ?? 40)}`} />
              <DetailRow label="Capienza" value={capacity > 0 ? `${capacity} ${participantLabel}` : "Da definire"} />
              {tournament.circuitName && <DetailRow label="Tour" value={tournament.circuitName} />}
            </dl>
            <p className="mt-6 text-xs leading-5 text-white/50">Per iscriverti o gestire la tua richiesta, accedi al Portale Atleta BVI.</p>
          </div>

          <div className="rounded-2xl border border-[#101d2c]/10 bg-white p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><p className="text-[10px] font-black uppercase tracking-[.23em] text-[#78600d]">{String(confirmedRegistrations.length).padStart(2, "0")} confermati</p><h2 className="mt-2 text-2xl font-black">Partecipanti</h2></div>
              <Link href={`/iscritti?tour=${encodeURIComponent(tournament.nome)}`} className="text-xs font-black text-[#101d2c] underline decoration-[#f5ca3e] decoration-2 underline-offset-4">Elenco completo →</Link>
            </div>
            {confirmedRegistrations.length ? <ul className="mt-6 grid gap-2 sm:grid-cols-2">
              {confirmedRegistrations.slice(0, 8).map((registration, index) => <li key={registration.id || index} className="flex min-w-0 items-center gap-3 rounded-xl bg-[#f5f4ef] px-4 py-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#101d2c] text-xs font-black text-[#f5ca3e]">{String(index + 1).padStart(2, "0")}</span><span className="truncate text-sm font-bold">{registration.giocatori || "Partecipante"}</span></li>)}
            </ul> : <div className="mt-6 rounded-xl border border-dashed border-[#101d2c]/20 bg-[#f5f4ef] px-5 py-8 text-center"><p className="font-bold">Ancora nessun partecipante confermato.</p>{isOpen && <p className="mt-1 text-sm text-[#657080]">Puoi essere il primo a iscriverti.</p>}</div>}
            {confirmedRegistrations.length > 8 && <p className="mt-4 text-xs text-[#657080]">E altri {confirmedRegistrations.length - 8} {participantLabel} iscritti.</p>}
          </div>
        </div>
      </section>

      <footer className="border-t border-[#101d2c]/10 bg-white px-5 py-6 text-center text-xs font-semibold text-[#657080] sm:px-8">
        <Link href="/" className="font-black text-[#101d2c] hover:text-[#78600d]">Beach Volley Institute · BVI Tornei</Link>
        <span className="mx-2">·</span>
        <Link href="/#tornei" className="hover:text-[#101d2c]">Tutti i tornei</Link>
      </footer>
    </main>
  );
}

function InfoTile({ label, value }) {
  return <div className="min-w-0 bg-white p-4"><dt className="text-[9px] font-black uppercase tracking-wider text-[#657080]">{label}</dt><dd className="mt-1 truncate text-xs font-black text-[#101d2c]">{value}</dd></div>;
}

function DetailRow({ label, value }) {
  return <div className="flex items-start justify-between gap-4 py-3"><dt className="text-xs text-white/55">{label}</dt><dd className="text-right text-xs font-bold text-white">{value}</dd></div>;
}
