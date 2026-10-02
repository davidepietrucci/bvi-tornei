import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getIscrizioni, getTornei } from "@/app/utils/db-server";
import { registrationIncludesAthlete } from "@/app/utils/circuit";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Accesso richiesto." }, { status: 401 });

    const user = await currentUser();
    const email = String(user?.primaryEmailAddress?.emailAddress || "").trim().toLocaleLowerCase("it-IT");
    const [all, tornei] = await Promise.all([getIscrizioni(), getTornei()]);
    const data = (Array.isArray(all) ? all : [])
      .filter((registration) => registrationIncludesAthlete(registration, userId, email))
      .map((registration) => ({
        id: String(registration.id),
        data: registration.data || "",
        torneo: registration.torneo || "",
        giocatori: registration.giocatori || "",
        stato: registration.stato || "In Attesa",
        tel: registration.tel || "",
        quotaPagata: Number(registration.quotaPagata) || 0,
        quotaTotale: Number(registration.quotaTotale) || 0,
        pagatoPlayer1: Number(registration.pagatoPlayer1) || 0,
        pagatoPlayer2: Number(registration.pagatoPlayer2) || 0,
        canCancel: registration.stato !== "Annullata"
          && (tornei || []).some((t) => String(t.nome || "").trim().toLocaleLowerCase("it-IT") === String(registration.torneo || "").trim().toLocaleLowerCase("it-IT") && t.stato === "Iscrizioni Aperte")
          && !(Number(registration.quotaPagata) > 0 || Number(registration.pagatoPlayer1) > 0 || Number(registration.pagatoPlayer2) > 0),
      }));

    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (error) {
    console.error("Errore caricamento iscrizioni atleta:", error);
    return NextResponse.json({ error: "Non è stato possibile caricare le iscrizioni." }, { status: 500 });
  }
}
