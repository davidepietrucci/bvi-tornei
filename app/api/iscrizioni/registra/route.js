import { NextResponse } from "next/server";
import { auth, currentUser, clerkClient } from "@clerk/nextjs/server";
import { getAthleteName } from "@/app/utils/athleteIdentity";
import { updateRegistrationsAtomically } from "@/app/utils/db-server";
import { sendConfirmationEmail, sendPartnerInviteEmail } from "@/app/utils/email";
import { findCircuitAthlete, getCircuitLeaderboard, normalizeCircuitName, registrationIncludesAthlete } from "@/app/utils/circuit";

export async function POST(request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Accedi al portale atleta per inviare un'iscrizione." }, { status: 401 });
    }

    const user = await currentUser();
    // Tutti gli utenti registrati (atleta, staff, admin) possono iscriversi ai tornei dal portale
    const athleteEmail = String(user?.primaryEmailAddress?.emailAddress || "").trim().toLocaleLowerCase("it-IT");

    const body = await request.json();
    const { 
      torneo, 
      giocatore2,
      email2,
      atletaUserId2,
      tel, 
      note, 
    } = body;

    const athleteName = getAthleteName(user);

    if (!athleteEmail || !athleteName) {
      return NextResponse.json({ error: "Completa nome e cognome nel tuo profilo prima di iscriverti.", code: "ATHLETE_PROFILE_INCOMPLETE" }, { status: 400 });
    }

    if (!torneo || !tel || !String(tel).trim()) {
      return NextResponse.json(
        { error: "Seleziona un torneo e inserisci un numero di cellulare." },
        { status: 400 }
      );
    }

    const notificationEmail = athleteEmail;

    let verifiedPartnerId = "";
    let verifiedPartnerName = "";
    if (atletaUserId2) {
      const client = await clerkClient();
      let partner;
      try {
        partner = await client.users.getUser(String(atletaUserId2).trim());
      } catch (error) {
        if (error?.status === 404) return NextResponse.json({ error: "Profilo del compagno non trovato. Selezionalo nuovamente." }, { status: 400 });
        throw error;
      }
      const email = partner.emailAddresses?.find((item) => item.id === partner.primaryEmailAddressId);
      if (!email || email.verification?.status !== "verified" || String(email.emailAddress).trim().toLowerCase() !== String(email2 || "").trim().toLowerCase() || partner.id === userId) {
        return NextResponse.json({ error: "Il profilo del compagno non corrisponde all'email indicata. Selezionalo nuovamente." }, { status: 400 });
      }
      verifiedPartnerId = partner.id;
      verifiedPartnerName = getAthleteName(partner);
      if (!verifiedPartnerName) {
        return NextResponse.json({ error: "Il compagno deve completare nome e cognome nel proprio profilo prima dell'iscrizione." }, { status: 400 });
      }
    }

    const outcome = await updateRegistrationsAtomically(async (iscrizioni, tornei) => {
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

    const isIndividualTournament = (() => {
      const cat = String(matchTorneo.categoria || "").toLowerCase().trim();
      if (cat.includes("2x2") || cat.includes("4x4") || cat.includes("coppi")) {
        return false;
      }
      if (matchTorneo.formato === "coppia" || matchTorneo.tipoIscrizione === "coppia") {
        return false;
      }
      if (cat.includes("giallo") || cat.includes("1x1") || cat.includes("singol") || matchTorneo.formato === "singolo" || matchTorneo.tipoIscrizione === "singola") {
        return true;
      }
      return false;
    })();
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
    const partnerName = verifiedPartnerName || String(giocatore2 || "").trim();
    const giocatori = isIndividualTournament ? athleteName : `${athleteName} & ${partnerName}`;
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
          atleta2Nome: partnerName,
          atletaEmail2: partnerEmail,
          atletaUserId2: verifiedPartnerId,
          statoInvitoCompagno: verifiedPartnerId ? "Confermato" : "Invitato",
        } : {}),
        tel: tel ? String(tel).trim() : "Non inserito",
        email: notificationEmail,
        note: note ? String(note).trim() : "",
        stato: "In Attesa",
        quotaPagata: 0,
      };

    // Salva l'iscrizione accodata
    const updatedIscrizioni = [...iscrizioni, nuovaIscrizione];

    // Incrementa contatore iscritti del torneo specifico
    const updatedTornei = tornei.map(t => {
      if (String(t.id) === String(matchTorneo.id)) {
        return { ...t, iscritti: (t.iscritti || 0) + 1 };
      }
      return t;
    });
    return { registrations: updatedIscrizioni, tournaments: updatedTornei, result: { nuovaIscrizione, matchTorneo, isIndividualTournament, partnerEmail, giocatori } };
    });
    if (outcome instanceof Response) return outcome;
    const { nuovaIscrizione, matchTorneo, isIndividualTournament, partnerEmail, giocatori } = outcome;

    // L'iscrizione è già salvata; eventuali errori email non devono annullarla.
    const emailStatus = { atleta: false, compagno: isIndividualTournament ? null : false };
    if (notificationEmail) {
      try {
        const result = await sendConfirmationEmail({
          email: notificationEmail,
          torneo: matchTorneo.nome,
          giocatori: String(giocatori).trim(),
          data: matchTorneo.data,
          quota: matchTorneo.quota,
          note: note ? String(note).trim() : ""
        });
        emailStatus.atleta = result?.success === true && !result?.isMock;
      } catch (emailError) {
        console.error("Errore nell'invio dell'email di conferma:", emailError);
      }
    }

    // Invia l'email di notifica/invito al compagno di squadra (se torneo a coppie)
    if (!isIndividualTournament && partnerEmail) {
      try {
        const result = await sendPartnerInviteEmail({
          email: partnerEmail,
          partnerName: verifiedPartnerName || String(giocatore2).trim(),
          inviterName: athleteName,
          torneo: matchTorneo.nome,
          data: matchTorneo.data,
          quota: matchTorneo.quota,
        });
        emailStatus.compagno = result?.success === true && !result?.isMock;
      } catch (inviteError) {
        console.error("Errore nell'invio dell'email al compagno:", inviteError);
      }
    }

    return NextResponse.json(
      { 
        success: true, 
        emailStatus,
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
