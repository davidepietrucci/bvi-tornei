import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { sendConfirmationEmail, sendPartnerInviteEmail, sendRegistrationApprovedEmail, sendRegistrationRejectedEmail } from "@/app/utils/email";
import { getIscrizioni, getTornei } from "@/app/utils/db-server";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Accesso non autorizzato." }, { status: 401 });
    }

    let role = "atleta";
    try {
      const user = await currentUser();
      if (user?.publicMetadata?.role) role = user.publicMetadata.role;
    } catch (_) {}
    if (role === "atleta") {
      role = sessionClaims?.metadata?.role || sessionClaims?.publicMetadata?.role || "atleta";
    }

    if (role !== "staff" && role !== "admin") {
      return NextResponse.json({ error: "Permesso negato: operazione riservata allo staff." }, { status: 403 });
    }

    const body = await req.json();
    const { action, torneo, giocatori, emails, recipientName, data, quota, motivo } = body;

    if (action === "resend_confirmation") {
      if (!body.id) return NextResponse.json({ error: "Iscrizione non specificata." }, { status: 400 });
      const [registrations, tournaments] = await Promise.all([getIscrizioni(), getTornei()]);
      const registration = registrations.find((item) => String(item.id) === String(body.id));
      if (!registration) return NextResponse.json({ error: "Iscrizione non trovata." }, { status: 404 });
      if (registration.stato === "Annullata" || registration.stato === "Rifiutata") return NextResponse.json({ error: "Non è possibile reinviare la conferma per un'iscrizione annullata o rifiutata." }, { status: 400 });
      const tournament = tournaments.find((item) => String(item.nome || "").trim().toLowerCase() === String(registration.torneo || "").trim().toLowerCase());
      const primary = String(registration.atletaEmail1 || registration.email || "").trim();
      const partner = String(registration.atletaEmail2 || registration.email2 || "").trim();
      const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      if (!validEmail(primary)) return NextResponse.json({ error: "L'iscrizione non contiene un'email valida per l'atleta principale." }, { status: 400 });
      const tasks = [{ recipient: "atleta", send: () => sendConfirmationEmail({ email: primary, torneo: registration.torneo, giocatori: registration.giocatori, data: tournament?.data, quota: tournament?.quota, note: registration.note, risposte: registration.risposte }) }];
      if (partner && partner.toLowerCase() !== primary.toLowerCase()) {
        if (!validEmail(partner)) return NextResponse.json({ error: "L'email del compagno non è valida." }, { status: 400 });
        tasks.push({ recipient: "compagno", send: () => sendPartnerInviteEmail({ email: partner, partnerName: registration.atleta2Nome || "", inviterName: registration.atleta1Nome || registration.giocatori, torneo: registration.torneo, data: tournament?.data, quota: tournament?.quota }) });
      }
      const results = await Promise.all(tasks.map(async ({ recipient, send }) => {
        try {
          const result = await send();
          return { recipient, success: result?.success === true && !result?.isMock };
        } catch (error) {
          console.error("Errore reinvio conferma:", error);
          return { recipient, success: false };
        }
      }));
      return NextResponse.json({ success: results.every((result) => result.success), results });
    }

    if (!torneo || !emails || (Array.isArray(emails) && emails.length === 0)) {
      return NextResponse.json({ error: "Parametri torneo o email mancanti." }, { status: 400 });
    }

    if (action === "approved") {
      const result = await sendRegistrationApprovedEmail({
        emails,
        recipientName,
        torneo,
        giocatori,
        data,
        quota
      });
      return NextResponse.json({ success: true, result });
    } else if (action === "rejected") {
      const result = await sendRegistrationRejectedEmail({
        emails,
        recipientName,
        torneo,
        giocatori,
        motivo
      });
      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ error: "Azione non valida. Usare 'approved' o 'rejected'." }, { status: 400 });
  } catch (error) {
    console.error("Errore notifica iscrizione staff:", error);
    return NextResponse.json({ error: "Errore interno durante l'invio della notifica." }, { status: 500 });
  }
}
