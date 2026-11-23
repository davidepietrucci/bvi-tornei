import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { manageGialloCompletion } from "@/app/utils/db-server";

export const dynamic = "force-dynamic";
export async function POST(request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Accesso richiesto." }, { status: 401 });
    const user = await currentUser();
    if (!["admin", "staff"].includes(user?.publicMetadata?.role)) return NextResponse.json({ error: "Operazione riservata allo staff." }, { status: 403 });
    const body = await request.json();
    if (typeof body.slug !== "string" || !body.slug || body.slug.length > 300 || body.slug.includes("/") || !["preview", "close", "reopen"].includes(body.action) ||
      (body.action === "preview" ? !body.baseline || typeof body.baseline !== "object" || Array.isArray(body.baseline) : typeof body.fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(body.fingerprint))) return NextResponse.json({ error: "Richiesta non valida. Aggiorna e verifica nuovamente la classifica." }, { status: 400 });
    const result = await manageGialloCompletion(body.slug, body.action, body.fingerprint, userId, body.baseline);
    return NextResponse.json({ success: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: [400, 404, 409].includes(error.status) ? error.message : "Operazione non confermata. Aggiorna i dati prima di riprovare." }, { status: [400, 404, 409].includes(error.status) ? error.status : 500 });
  }
}
