import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    error: "Le iscrizioni online passano ora dall'Area Atleta. Accedi su /atleta/iscriviti e invia la richiesta dal tuo profilo.",
  }, { status: 410 });
}
