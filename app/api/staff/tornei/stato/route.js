import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { updateTournamentStatus } from "@/app/utils/db-server";

export async function POST(request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Accesso richiesto." }, { status: 401 });
    const user = await currentUser();
    if (!["admin", "staff"].includes(user?.publicMetadata?.role)) return NextResponse.json({ error: "Operazione riservata allo staff." }, { status: 403 });
    const body = await request.json();
    if (!body || typeof body.nome !== "string" || !body.nome.trim() || body.nome.length > 300 || !["In Programmazione", "Iscrizioni Aperte", "In Corso"].includes(body.stato) || typeof body.baseline !== "string") return NextResponse.json({ error: "Stato o torneo non valido." }, { status: 400 });
    const tournament = await updateTournamentStatus(body);
    return NextResponse.json({ success: true, tournament }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = [400, 404, 409].includes(error.status) ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? "Stato non salvato. Aggiorna e riprova." : error.message }, { status });
  }
}
