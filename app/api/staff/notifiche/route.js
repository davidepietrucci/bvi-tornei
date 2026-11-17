import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { notificationActor } from "@/app/utils/notification-server";
import { getNotificationEvents, createNotificationEvent, archiveNotificationEvent, getTornei, getNotificationDeliverySettings, setNotificationDeliverySettings } from "@/app/utils/db-server";
import { validateNotificationText } from "@/app/utils/notifications";

export const dynamic = "force-dynamic";
const denied = (actor) => !actor ? NextResponse.json({ error: "Accesso richiesto." }, { status: 401 }) : !["admin", "staff"].includes(actor.role) ? NextResponse.json({ error: "Operazione riservata allo staff." }, { status: 403 }) : null;
const email = (user) => user.emailAddresses?.find((item) => item.id === user.primaryEmailAddressId)?.emailAddress || user.emailAddresses?.[0]?.emailAddress || "";

export async function GET(request) {
  try {
    const actor = await notificationActor(), error = denied(actor); if (error) return error;
    const search = new URL(request.url).searchParams.get("search");
    if (search !== null) {
      if (search.trim().length < 3 || search.length > 100) return NextResponse.json({ athletes: [] });
      const client = await clerkClient();
      const result = await client.users.getUserList({ query: search.trim(), limit: 20 });
      return NextResponse.json({ athletes: result.data.map((user) => ({ id: user.id, name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Atleta", email: email(user) })) }, { headers: { "Cache-Control": "no-store" } });
    }
    const [data, tournaments, settings] = await Promise.all([getNotificationEvents(), getTornei(), getNotificationDeliverySettings()]);
    return NextResponse.json({ data, tournaments: tournaments.map(({ id, nome }) => ({ id, nome })), settings }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Caricamento notifiche non riuscito." }, { status: 500 }); }
}

export async function POST(request) {
  try {
    const actor = await notificationActor(), error = denied(actor); if (error) return error;
    const body = await request.json();
    if (body.action === "settings") {
      if (typeof body.automaticEnabled !== "boolean") return NextResponse.json({ error: "Impostazione non valida." }, { status: 400 });
      await setNotificationDeliverySettings(body.automaticEnabled);
      return NextResponse.json({ success: true });
    }
    if (body.action === "archive") {
      if (typeof body.id !== "string" || !body.id || body.id.includes("/")) return NextResponse.json({ error: "Avviso non valido." }, { status: 400 });
      if (!await archiveNotificationEvent(body.id, actor.userId)) return NextResponse.json({ error: "Avviso non trovato." }, { status: 404 });
      return NextResponse.json({ success: true });
    }
    if (body.action !== "create") return NextResponse.json({ error: "Operazione non valida." }, { status: 400 });
    let text;
    try { text = validateNotificationText(body); } catch (error) { return NextResponse.json({ error: error.message }, { status: 400 }); }
    let audience;
    if (body.audience?.type === "all") audience = { type: "all", label: "Tutti gli atleti" };
    else if (body.audience?.type === "tournament") {
      if (!["string", "number"].includes(typeof body.audience.tournamentId)) return NextResponse.json({ error: "Seleziona un torneo valido." }, { status: 400 });
      const tournaments = await getTornei();
      const tournament = tournaments.find((t) => String(t.id) === String(body.audience.tournamentId));
      if (!tournament) return NextResponse.json({ error: "Torneo non trovato." }, { status: 400 });
      audience = { type: "tournament", tournamentName: tournament.nome, tournamentId: String(tournament.id), label: tournament.nome };
    } else if (body.audience?.type === "athlete") {
      if (typeof body.audience.userId !== "string" || !body.audience.userId.startsWith("user_")) return NextResponse.json({ error: "Seleziona un account atleta valido." }, { status: 400 });
      const client = await clerkClient();
      let user;
      try { user = await client.users.getUser(body.audience.userId); } catch { return NextResponse.json({ error: "Account atleta non trovato." }, { status: 404 }); }
      audience = { type: "athlete", userId: user.id, label: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Atleta" };
    } else return NextResponse.json({ error: "Destinatari non validi." }, { status: 400 });
    const notice = await createNotificationEvent({ ...text, audience, data: new Date().toISOString(), source: "manual", archived: false, createdBy: actor.userId });
    return NextResponse.json({ success: true, data: notice });
  } catch { return NextResponse.json({ error: "Invio non confermato. Aggiorna l’elenco prima di riprovare." }, { status: 500 }); }
}
