import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getEmail(user) {
  const primary = user.emailAddresses?.find((email) => email.id === user.primaryEmailAddressId);
  return String(primary?.emailAddress || user.emailAddresses?.[0]?.emailAddress || "").trim().toLowerCase();
}

export async function GET(request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Accesso non autorizzato." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = String(searchParams.get("q") || "").trim().toLowerCase();

    const client = await clerkClient();
    const clerkResponse = await client.users.getUserList({ limit: 500, orderBy: "-created_at" });
    const allUsers = clerkResponse.data || clerkResponse || [];

    const athletes = allUsers
      .filter((u) => u.id !== userId) // esclude l'utente che cerca se stesso
      .map((u) => {
        const firstName = u.firstName || "";
        const lastName = u.lastName || "";
        const email = getEmail(u);
        const fullName = `${firstName} ${lastName}`.trim() || u.username || email.split("@")[0] || "Atleta";
        return {
          id: u.id,
          nome: firstName,
          cognome: lastName,
          fullName,
          email,
          imageUrl: u.imageUrl || null,
        };
      })
      .filter((athlete) => {
        if (!query) return true;
        const target = `${athlete.fullName} ${athlete.email} ${athlete.nome} ${athlete.cognome}`.toLowerCase();
        return target.includes(query);
      })
      .slice(0, 15); // massimo 15 risultati suggeriti

    return NextResponse.json({ data: athletes });
  } catch (error) {
    console.error("Errore ricerca compagni:", error);
    return NextResponse.json({ error: "Errore durante la ricerca degli atleti." }, { status: 500 });
  }
}
