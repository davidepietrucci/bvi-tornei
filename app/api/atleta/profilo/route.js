import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getIscrizioni, getTornei } from "@/app/utils/db-server";
import { findCircuitAthlete, getCircuitLeaderboard, getCircuitFinalists, getCircuitRules, getPlacementPoints, normalizeCircuitName, registrationIncludesAthlete } from "@/app/utils/circuit";
import { isTourPublished } from "@/app/utils/tour-view";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Accesso richiesto." }, { status: 401 });

    const user = await currentUser();
    const email = String(user?.primaryEmailAddress?.emailAddress || "").trim().toLocaleLowerCase("it-IT");
    const [registrations, tournaments] = await Promise.all([getIscrizioni(), getTornei()]);
    const safeRegistrations = Array.isArray(registrations) ? registrations : [];
    const safeTournaments = Array.isArray(tournaments) ? tournaments : [];
    const tournamentByName = new Map(safeTournaments.map((tournament) => [normalizeCircuitName(tournament.nome), tournament]));
    const mine = safeRegistrations.filter((registration) => registrationIncludesAthlete(registration, userId, email));
    const telefono = [...mine].reverse().find((registration) => {
      const value = String(registration.tel || "").trim();
      return value && value.toLocaleLowerCase("it-IT") !== "non inserito";
    })?.tel || "";

    const scoreDetails = mine.map((registration) => {
      const tournament = tournamentByName.get(normalizeCircuitName(registration.torneo));
      const placement = Number(registration.piazzamentoCircuito) || null;
      const isCircuitEvent = tournament?.circuitRole === "tappa" || tournament?.circuitRole === "finale";
      const points = isCircuitEvent && registration.stato === "Approvata" && tournament?.stato === "Concluso" && placement
        ? getPlacementPoints(tournament, placement)
        : null;
      return {
        id: String(registration.id),
        torneo: registration.torneo || "Torneo",
        data: registration.data || tournament?.data || "",
        stato: registration.stato || "In Attesa",
        giocatori: registration.giocatori || "",
        piazzamento: placement,
        punti: points,
        circuito: tournament?.circuitName || "",
        ruoloCircuito: tournament?.circuitRole || "",
        torneoConcluso: tournament?.stato === "Concluso",
      };
    }).sort((a, b) => String(b.data).localeCompare(String(a.data), "it-IT"));

    const circuitsByNormalizedName = new Map();
    for (const tournament of safeTournaments) {
      if (!tournament.circuitName) continue;
      const normalizedName = normalizeCircuitName(tournament.circuitName);
      if (normalizedName && !circuitsByNormalizedName.has(normalizedName)) {
        circuitsByNormalizedName.set(normalizedName, String(tournament.circuitName).trim());
      }
    }
    const circuitNames = [...circuitsByNormalizedName.values()];
    const circuits = circuitNames.map((circuitName) => {
      const leaderboard = getCircuitLeaderboard(safeTournaments, safeRegistrations, circuitName);
      const athlete = findCircuitAthlete(leaderboard, userId, email);
      const finals = safeTournaments
        .filter((tournament) => normalizeCircuitName(tournament.circuitName) === normalizeCircuitName(circuitName) && tournament.circuitRole === "finale")
        .map((tournament) => {
          const qualification = getCircuitFinalists(safeTournaments, safeRegistrations, tournament);
          const finalAthlete = findCircuitAthlete(qualification.athletes, userId, email);
          const limit = qualification.limit;
          return {
            torneo: tournament.nome,
            qualificati: limit,
            posizione: athlete?.posizione || null,
            qualificato: Boolean(finalAthlete?.qualificato),
            statoQualificazione: finalAthlete?.statoQualificazione || "excluded",
            motivoQualificazione: finalAthlete?.motivoQualificazione || "Non risulti ancora nella classifica del tour.",
          };
        });
      return {
        nome: circuitName,
        punti: athlete?.punti || 0,
        tappe: athlete?.tappe || 0,
        posizione: athlete?.posizione || null,
        regole: getCircuitRules(safeTournaments, circuitName),
        tourPubblico: isTourPublished(safeTournaments, circuitName),
        risultati: athlete?.risultati || [],
        idoneo: Boolean(athlete?.idoneo),
        finali: finals,
      };
    });

    const totalePunti = circuits.reduce((sum, circuit) => sum + circuit.punti, 0);
    const eligibleTournamentIds = new Set();
    for (const circuit of circuits) {
      for (const final of circuit.finali) if (final.qualificato) {
        const tournament = safeTournaments.find((item) => normalizeCircuitName(item.nome) === normalizeCircuitName(final.torneo));
        if (tournament) eligibleTournamentIds.add(String(tournament.id));
      }
    }

    return NextResponse.json({
      data: {
        telefono: String(telefono).trim(),
        totalePunti,
        iscrizioni: mine.length,
        punteggi: scoreDetails.map((detail) => {
          const tournament = tournamentByName.get(normalizeCircuitName(detail.torneo));
          return { ...detail, qualificato: tournament ? eligibleTournamentIds.has(String(tournament.id)) : false };
        }),
        circuiti: circuits,
      },
    }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (error) {
    console.error("Errore caricamento profilo atleta:", error);
    return NextResponse.json({ error: "Non è stato possibile caricare il profilo atleta." }, { status: 500 });
  }
}
