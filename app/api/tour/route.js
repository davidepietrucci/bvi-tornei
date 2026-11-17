import { NextResponse } from "next/server";
import { getTornei, getIscrizioni } from "@/app/utils/db-server";
import { getCircuitRules, normalizeCircuitName } from "@/app/utils/circuit";
import { isTourPublished, serializePublicTour } from "@/app/utils/tour-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const headers = { "Cache-Control": "no-store, no-cache, must-revalidate" };
  try {
    const name = new URL(request.url).searchParams.get("tour");
    if (name && name.length > 300) return NextResponse.json({ error: "Nome tour non valido." }, { status: 400, headers });
    const tournaments = await getTornei();
    const names = [...new Map(tournaments.filter((t) => t.circuitName && ["tappa", "finale"].includes(t.circuitRole)).map((t) => [normalizeCircuitName(t.circuitName), String(t.circuitName).trim()])).values()]
      .filter((n) => getCircuitRules(tournaments, n).giallo && isTourPublished(tournaments, n));
    if (name) {
      const canonical = names.find((n) => normalizeCircuitName(n) === normalizeCircuitName(name));
      if (!canonical) return NextResponse.json({ error: "Tour non disponibile al pubblico." }, { status: 404, headers });
      const registrations = await getIscrizioni();
      return NextResponse.json({ data: serializePublicTour(tournaments, registrations, canonical) }, { headers });
    }
    return NextResponse.json({ data: names.map((n) => ({ name: n })) }, { headers });
  } catch (error) {
    console.error("Errore caricamento tour pubblico:", error);
    return NextResponse.json({ error: "Non è stato possibile caricare il tour. Riprova." }, { status: 500, headers });
  }
}
