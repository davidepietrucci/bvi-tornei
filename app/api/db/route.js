import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { 
  getTornei, saveTornei, 
  getIscrizioni, saveIscrizioni, 
  getUsers, saveUsers, 
  getModuli, saveModuli, 
  getGironi, saveGironi,
  getBracket, saveBracket,
  getNotifiche, saveNotifiche,
  getStaff, saveStaff,
  getSponsors, saveSponsors
} from "@/app/utils/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 1. GET: Gestisce le letture del database controllando i permessi di lettura
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const slug = searchParams.get("slug");

    // Controlliamo l'autenticazione per le letture sensibili
    const { userId, sessionClaims } = await auth();
    const role = sessionClaims?.metadata?.role || "atleta";

    if (type === "users" || type === "staff") {
      if (!userId) {
        return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
      }
      if (role !== "admin") {
        return NextResponse.json({ error: "Accesso negato: richiesto ruolo Admin" }, { status: 403 });
      }
    }

    let data = null;
    if (type === "tornei") data = await getTornei();
    else if (type === "iscrizioni") {
      data = await getIscrizioni();
      const isPublicRequest = searchParams.get("public") === "true";
      // Sanitizziamo i dati sensibili SOLO se è esplicitamente richiesta una vista pubblica
      if (isPublicRequest && Array.isArray(data)) {
        data = data.map((isc) => ({
          id: isc.id,
          torneo: isc.torneo,
          giocatori: isc.giocatori,
          stato: isc.stato,
          data: isc.data,
        }));
      }
    }
    else if (type === "users") data = await getUsers();
    else if (type === "staff") data = await getStaff();
    else if (type === "moduli") data = await getModuli();
    else if (type === "gironi") data = await getGironi(slug);
    else if (type === "bracket") data = await getBracket(slug);
    else if (type === "notifiche") data = await getNotifiche();
    else if (type === "sponsors") data = await getSponsors();
    else {
      return NextResponse.json({ error: "Tipo database non valido" }, { status: 400 });
    }

    return NextResponse.json({ data }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate"
      }
    });
  } catch (error) {
    console.error("Errore nell'API GET database:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}

// 2. POST: Gestisce le scritture sicure sul database verificando l'autenticazione ed il ruolo lato server
export async function POST(req) {
  try {
    const { userId, sessionClaims } = await auth();
    const body = await req.json();
    const { type, data, slug } = body;

    // Se non c'è una sessione, blocca la scrittura.
    // Eccezione: registrazione atleta (type === 'users' e non è presente una sessione)
    const isRegistration = (type === "users" && !userId);

    if (!userId && !isRegistration) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const role = sessionClaims?.metadata?.role || "atleta";

    // Controllo dei permessi di scrittura lato server
    if (type === "moduli" || type === "staff") {
      if (role !== "admin") {
        return NextResponse.json({ error: "Accesso negato: richiesto ruolo Admin" }, { status: 403 });
      }
      if (type === "moduli") await saveModuli(data);
      if (type === "staff") await saveStaff(data);
    }
    else if (type === "tornei" || type === "gironi" || type === "bracket" || type === "iscrizioni" || type === "notifiche" || type === "sponsors") {
      if (role !== "admin" && role !== "staff") {
        return NextResponse.json({ error: "Accesso negato: richiesto ruolo Staff" }, { status: 403 });
      }
      if (type === "tornei") await saveTornei(data);
      if (type === "gironi") await saveGironi(slug, data);
      if (type === "bracket") await saveBracket(slug, data);
      if (type === "sponsors") await saveSponsors(data);

      if (type === "iscrizioni") {
        const existing = await getIscrizioni();
        const existingMap = new Map(existing.map(i => [String(i.id), i]));
        const mergedData = Array.isArray(data) ? data.map(item => {
          const oldItem = existingMap.get(String(item.id));
          if (!oldItem) return item;
          return {
            ...oldItem,
            ...item,
            giocatori: item.giocatori !== undefined ? item.giocatori : oldItem.giocatori,
            tel: item.tel !== undefined ? item.tel : oldItem.tel,
            email: item.email !== undefined ? item.email : oldItem.email,
            torneo: item.torneo !== undefined ? item.torneo : oldItem.torneo,
            stato: item.stato !== undefined ? item.stato : oldItem.stato,
            note: item.note !== undefined ? item.note : oldItem.note,
            risposte: (item.risposte && item.risposte.length > 0) ? item.risposte : (oldItem.risposte || item.risposte)
          };
        }) : data;
        await saveIscrizioni(mergedData);
      }
      if (type === "notifiche") await saveNotifiche(data);
    }
    else if (type === "users") {
      if (isRegistration) {
        await saveUsers(data);
      } else if (role === "admin") {
        await saveUsers(data);
      } else {
        return NextResponse.json({ error: "Accesso negato" }, { status: 403 });
      }
    }
    else {
      return NextResponse.json({ error: "Tipo database non valido" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore nell'API POST database:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
