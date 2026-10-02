import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getIscrizioni, saveIscrizioni, getTornei, saveTornei } from "@/app/utils/db-server";
import { registrationIncludesAthlete } from "@/app/utils/circuit";

export async function POST(request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Accedi al portale atleta." }, { status: 401 });

    const user = await currentUser();
    const email = String(user?.primaryEmailAddress?.emailAddress || "").trim().toLocaleLowerCase("it-IT");
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: "Iscrizione non specificata." }, { status: 400 });

    const [iscrizioni, tornei] = await Promise.all([getIscrizioni(), getTornei()]);
    const target = (iscrizioni || []).find((item) => String(item.id) === String(id));
    if (!target || !registrationIncludesAthlete(target, userId, email)) {
      return NextResponse.json({ error: "Iscrizione non trovata nel tuo profilo." }, { status: 404 });
    }
    if (target.stato === "Annullata") {
      return NextResponse.json({ error: "Questa iscrizione è già stata annullata." }, { status: 409 });
    }
    if (Number(target.quotaPagata) > 0 || Number(target.pagatoPlayer1) > 0 || Number(target.pagatoPlayer2) > 0) {
      return NextResponse.json({ error: "Per annullare un'iscrizione con pagamenti registrati, contatta lo staff." }, { status: 409 });
    }

    const tournamentIndex = (tornei || []).findIndex((item) =>
      String(item.nome || "").trim().toLocaleLowerCase("it-IT") === String(target.torneo || "").trim().toLocaleLowerCase("it-IT")
    );
    if (tournamentIndex < 0 || tornei[tournamentIndex].stato !== "Iscrizioni Aperte") {
      return NextResponse.json({ error: "Le iscrizioni sono chiuse: contatta lo staff per modificare la tua richiesta." }, { status: 409 });
    }

    const now = new Date().toISOString();
    const updatedIscrizioni = iscrizioni.map((item) => String(item.id) === String(id)
      ? { ...item, stato: "Annullata", annullataIl: now }
      : item
    );
    await saveIscrizioni(updatedIscrizioni);

    const updatedTornei = tornei.map((item, index) => index === tournamentIndex
      ? { ...item, iscritti: Math.max(0, (Number(item.iscritti) || 0) - 1) }
      : item
    );
    await saveTornei(updatedTornei);

    return NextResponse.json({ success: true, message: "Iscrizione annullata." });
  } catch (error) {
    console.error("Errore annullamento iscrizione atleta:", error);
    return NextResponse.json({ error: "Non è stato possibile annullare l'iscrizione." }, { status: 500 });
  }
}
