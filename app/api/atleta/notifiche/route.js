import { NextResponse } from "next/server";
import { notificationActor, athleteNotificationFeed } from "@/app/utils/notification-server";
import { updateNotificationPreferences } from "@/app/utils/db-server";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const actor = await notificationActor();
    if (!actor) return NextResponse.json({ error: "Accesso richiesto." }, { status: 401 });
    return NextResponse.json(await athleteNotificationFeed(actor), { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Non è stato possibile caricare le notifiche." }, { status: 500 }); }
}
export async function POST(request) {
  try {
    const actor = await notificationActor();
    if (!actor) return NextResponse.json({ error: "Accesso richiesto." }, { status: 401 });
    const body = await request.json();
    if (!Array.isArray(body.read) || body.read.length > 200 || body.read.some((id) => typeof id !== "string" || id.length > 150) || body.enabled !== undefined && typeof body.enabled !== "boolean") return NextResponse.json({ error: "Preferenze non valide." }, { status: 400 });
    const { data } = await athleteNotificationFeed(actor);
    const visible = new Set(data.map((notice) => String(notice.id)));
    if (body.read.some((id) => !visible.has(id))) return NextResponse.json({ error: "Alcuni avvisi non sono più disponibili. Aggiorna le notifiche." }, { status: 409 });
    const settings = await updateNotificationPreferences(actor.userId, { read: body.read, enabled: body.enabled });
    return NextResponse.json({ success: true, settings });
  } catch { return NextResponse.json({ error: "Salvataggio non confermato. Riprova dopo aver aggiornato." }, { status: 500 }); }
}
