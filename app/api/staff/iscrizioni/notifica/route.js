import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { sendRegistrationApprovedEmail, sendRegistrationRejectedEmail } from "@/app/utils/email";

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
