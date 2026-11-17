import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getIscrizioni, getTornei, updateRegistrationsAtomically } from "@/app/utils/db-server";
import { paymentVersion, updatePayment } from "@/app/utils/payments";

export const dynamic = "force-dynamic";
async function staffUser() {
  const { userId, sessionClaims } = await auth();
  if (!userId) return { error: NextResponse.json({ error: "Accesso richiesto." }, { status: 401 }) };
  const user = await currentUser();
  const role = user?.publicMetadata?.role || sessionClaims?.metadata?.role || sessionClaims?.publicMetadata?.role;
  if (!["admin", "staff"].includes(role)) return { error: NextResponse.json({ error: "Operazione riservata allo staff." }, { status: 403 }) };
  return { userId };
}
export async function GET() {
  try {
    const actor = await staffUser(); if (actor.error) return actor.error;
    const [registrations, tournaments] = await Promise.all([getIscrizioni(), getTornei()]);
    return NextResponse.json({ registrations, tournaments }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Caricamento pagamenti non riuscito." }, { status: 500 }); }
}
export async function POST(request) {
  try {
    const actor = await staffUser(); if (actor.error) return actor.error;
    const body = await request.json();
    if (!body.id || typeof body.version !== "string") return NextResponse.json({ error: "Ricarica i dati prima di salvare." }, { status: 400 });
    const result = await updateRegistrationsAtomically(async (registrations, tournaments) => {
      const target = registrations.find((r) => String(r.id) === String(body.id));
      if (!target) return NextResponse.json({ error: "Iscrizione non trovata." }, { status: 404 });
      if (paymentVersion(target, tournaments) !== body.version) return NextResponse.json({ error: "Questo pagamento è cambiato su un altro dispositivo. Chiudi e riapri il pagamento dopo aver aggiornato." }, { status: 409 });
      let updated;
      try { updated = updatePayment(target, tournaments, body, actor.userId, new Date().toISOString()); }
      catch (error) { return NextResponse.json({ error: error.message }, { status: 400 }); }
      return { registrations: registrations.map((r) => r === target ? updated : r), tournaments, result: { registration: updated } };
    });
    if (result instanceof Response) return result;
    return NextResponse.json({ success: true, ...result });
  } catch { return NextResponse.json({ error: "Salvataggio non confermato. Aggiorna i dati prima di riprovare." }, { status: 500 }); }
}
