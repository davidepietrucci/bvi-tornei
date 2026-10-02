import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getTornei, saveTornei, getIscrizioni, saveIscrizioni } from "@/app/utils/db-server";
import { sendConfirmationEmail } from "@/app/utils/email";
import { findCircuitAthlete, getCircuitLeaderboard, normalizeCircuitName, registrationIncludesAthlete } from "@/app/utils/circuit";

export async function POST(request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Accedi al portale atleta per inviare un'iscrizione." }, { status: 401 });
    }

    const user = await currentUser();
    const role = user?.publicMetadata?.role || "atleta";
    if (role !== "atleta") {
      return NextResponse.json({ error: "Per iscriverti usa un account atleta e accedi al Portale Atleta." }, { status: 403 });
    }
    const athleteEmail = String(user?.primaryEmailAddress?.emailAddress || "").trim().toLocaleLowerCase("it-IT");
    const athleteName = String(user?.fullName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim()).trim();
    if (!athleteEmail || !athleteName) {
      return NextResponse.json({ error: "Completa nome, cognome ed email nel tuo account prima di iscriverti." }, { status: 400 });
    }

    const body = await request.json();
    const { 
      torneo, 
      giocatore2,
      email2,
      tel, 
      email: contactEmail,
      note, 
    } = body;

    if (!torneo || !tel || !String(tel).trim()) {
      return NextResponse.json(
        { error: "Seleziona un torneo e inserisci un numero di cellulare." },
        { status: 400 }
      );
    }

    const notificationEmail = String(contactEmail || athleteEmail).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notificationEmail)) {
      return NextResponse.json({ error: "L'email di contatto non è valida." }, { status: 400 });
    }

    const tornei = await getTornei();
    const matchTorneo = tornei.find(
      t => String(t.nome || "").toLowerCase().trim() === String(torneo).toLowerCase().trim()
    );

    if (!matchTorneo) {
      return NextResponse.json(
        { error: `Il torneo "${torneo}" non è stato trovato nel database.` },
        { status: 404 }
      );
    }

    if (matchTorneo.stato !== "Iscrizioni Aperte") {
      return NextResponse.json({ error: "Le iscrizioni a questo torneo non sono aperte." }, { status: 409 });
    }

    const isIndividualTournament = ["tappa", "finale"].includes(matchTorneo.circuitRole);
    const partnerEmail = String(email2 || "").trim().toLocaleLowerCase("it-IT");
    if (!isIndividualTournament && (!giocatore2 || !String(giocatore2).trim())) {
      return NextResponse.json({ error: "Inserisci il nome del compagno o della compagna." }, { status: 400 });
    }
    if (!isIndividualTournament && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(partnerEmail)) {
      return NextResponse.json({ error: "L'email del compagno o della compagna non è valida." }, { status: 400 });
    }
    if (!isIndividualTournament && partnerEmail === athleteEmail) {
      return NextResponse.json({ error: "Usa un indirizzo diverso per il compagno o la compagna." }, { status: 400 });
    }

    // Carica iscrizioni esistenti
    const iscrizioni = await getIscrizioni();

    if (matchTorneo.circuitRole === "finale") {
      const qualifierLimit = Number(matchTorneo.circuitQualifiers);
      if (!String(matchTorneo.circuitName || "").trim() || !Number.isInteger(qualifierLimit) || qualifierLimit < 1) {
        return NextResponse.json({ error: "La finale non è ancora configurata dallo staff per il tour." }, { status: 409 });
      }
      const standings = getCircuitLeaderboard(tornei, iscrizioni, matchTorneo.circuitName);
      const athlete = findCircuitAthlete(standings, userId, athleteEmail);
      if (!athlete || athlete.posizione > qualifierLimit) {
        return NextResponse.json({
          error: `La finale è riservata ai primi ${matchTorneo.circuitQualifiers} atleti della classifica ${matchTorneo.circuitName}. Al momento non risulti tra i qualificati.`,
        }, { status: 403 });
      }
    }

    const lowerTorneo = normalizeCircuitName(matchTorneo.nome);
    const alreadyRegistered = iscrizioni.some((registration) => {
      if (registration.stato === "Annullata") return false;
      if (normalizeCircuitName(registration.torneo) !== lowerTorneo) return false;
      return registrationIncludesAthlete(registration, userId, athleteEmail) ||
        (!isIndividualTournament && registrationIncludesAthlete(registration, null, partnerEmail));
    });
    if (alreadyRegistered) {
      return NextResponse.json({ error: `Risulti già iscritto al torneo "${matchTorneo.nome}".` }, { status: 409 });
    }

    const teamSlots = iscrizioni.filter((registration) =>
      normalizeCircuitName(registration.torneo) === lowerTorneo && registration.stato !== "Annullata"
    ).length;
    if (Number(matchTorneo.maxSquadre) > 0 && teamSlots >= Number(matchTorneo.maxSquadre)) {
      return NextResponse.json({ error: "I posti disponibili per questo torneo sono esauriti." }, { status: 409 });
    }

    // Genera un nuovo ID numerico progressivo per l'iscrizione
    const numericIds = iscrizioni.map(i => parseInt(i.id)).filter(id => !isNaN(id));
    const newId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 100;

    const oggi = new Date();
    const dataFormatted = `${oggi.getDate().toString().padStart(2, "0")}/${(oggi.getMonth() + 1).toString().padStart(2, "0")}/${oggi.getFullYear()}`;

    // L'atleta registrato deriva sempre dall'account Clerk verificato.
    const giocatori = isIndividualTournament ? athleteName : `${athleteName} & ${String(giocatore2).trim()}`;
    const nuovaIscrizione = {
        id: newId.toString(),
        data: dataFormatted,
        torneo: matchTorneo.nome,
        giocatori,
        formatoIscrizione: isIndividualTournament ? "singola" : "coppia",
        atleta1Nome: athleteName,
        atletaUserId1: userId,
        atletaEmail1: athleteEmail,
        ...(!isIndividualTournament ? {
          atleta2Nome: String(giocatore2).trim(),
          atletaEmail2: partnerEmail,
        } : {}),
        tel: tel ? String(tel).trim() : "Non inserito",
        email: notificationEmail,
        note: note ? String(note).trim() : "",
        stato: "In Attesa",
        quotaPagata: 0,
      };

    // Salva l'iscrizione accodata
    const updatedIscrizioni = [...iscrizioni, nuovaIscrizione];
    await saveIscrizioni(updatedIscrizioni);

    // Incrementa contatore iscritti del torneo specifico
    const updatedTornei = tornei.map(t => {
      if (String(t.id) === String(matchTorneo.id)) {
        return { ...t, iscritti: (t.iscritti || 0) + 1 };
      }
      return t;
    });
    await saveTornei(updatedTornei);

    // Invia l'email di conferma all'atleta
    if (notificationEmail) {
      try {
        await sendConfirmationEmail({
          email: notificationEmail,
          torneo: matchTorneo.nome,
          giocatori: String(giocatori).trim(),
          data: matchTorneo.data,
          quota: matchTorneo.quota,
          note: note ? String(note).trim() : ""
        });
      } catch (emailError) {
        console.error("Errore nell'invio dell'email di conferma:", emailError);
      }
    }

    return NextResponse.json(
      { 
        success: true, 
        message: "Iscrizione avvenuta con successo!", 
        data: nuovaIscrizione 
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Errore durante la registrazione:", error);
    return NextResponse.json(
      { error: "Errore interno del server durante la registrazione." },
      { status: 500 }
    );
  }
}
