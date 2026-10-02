import { NextResponse } from "next/server";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { getIscrizioni } from "@/app/utils/db-server";
import { getRegistrationPlayers } from "@/app/utils/circuit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getEmail(user) {
  const primary = user.emailAddresses?.find((email) => email.id === user.primaryEmailAddressId);
  return String(primary?.emailAddress || user.emailAddresses?.[0]?.emailAddress || "").trim();
}

function toAthlete(user) {
  const role = String(user.publicMetadata?.role || "atleta");
  return {
    id: user.id,
    nome: user.firstName || "",
    cognome: user.lastName || "",
    username: user.username || "",
    email: getEmail(user),
    role,
    dataRegistrazione: user.createdAt || null,
    ultimoAccesso: user.lastSignInAt || null,
  };
}

async function requireAdmin() {
  const { userId, sessionClaims } = await auth();
  if (!userId) return { response: NextResponse.json({ error: "Accesso richiesto." }, { status: 401 }) };

  const user = await currentUser();
  const role = user?.publicMetadata?.role || sessionClaims?.metadata?.role || sessionClaims?.publicMetadata?.role;
  if (role !== "admin") {
    return { response: NextResponse.json({ error: "Accesso riservato agli amministratori." }, { status: 403 }) };
  }
  return {};
}

async function getAllClerkUsers(client) {
  const users = [];
  let offset = 0;
  let totalCount = 0;

  do {
    const page = await client.users.getUserList({ limit: 500, offset, orderBy: "-created_at" });
    users.push(...page.data);
    totalCount = page.totalCount;
    offset += page.data.length;
    if (page.data.length === 0) break;
  } while (offset < totalCount);

  return users;
}

function registrationMatches(registration, athlete) {
  const email = athlete.email.toLocaleLowerCase("it-IT");
  return getRegistrationPlayers(registration).some((player) =>
    player.userId === athlete.id || (email && player.email === email)
  );
}

export async function GET(request) {
  try {
    const authorization = await requireAdmin();
    if (authorization.response) return authorization.response;

    const client = await clerkClient();
    const users = await getAllClerkUsers(client);
    const athletes = users.map(toAthlete);

    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get("userId");
    const registrations = await getIscrizioni();
    const safeRegistrations = Array.isArray(registrations) ? registrations : [];

    if (requestedUserId) {
      const athlete = athletes.find((item) => item.id === requestedUserId);
      if (!athlete) {
        return NextResponse.json({ error: "Atleta non trovato." }, { status: 404 });
      }

      const athleteRegistrations = safeRegistrations
        .filter((registration) => registrationMatches(registration, athlete))
        .map((registration) => ({
          id: String(registration.id),
          torneo: registration.torneo || "Torneo",
          data: registration.data || "",
          stato: registration.stato || "In Attesa",
          giocatori: registration.giocatori || "",
        }))
        .sort((a, b) => String(b.data).localeCompare(String(a.data), "it-IT"));

      return NextResponse.json({ data: { ...athlete, iscrizioni: athleteRegistrations } }, {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" },
      });
    }

    const registrationCounts = new Map();
    for (const athlete of athletes) {
      registrationCounts.set(athlete.id, safeRegistrations.filter((registration) => registrationMatches(registration, athlete)).length);
    }

    const data = athletes.map((athlete) => ({
      ...athlete,
      iscrizioni: registrationCounts.get(athlete.id) || 0,
    }));

    return NextResponse.json({ data }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate" },
    });
  } catch (error) {
    console.error("Errore nel caricamento dell'anagrafica Clerk:", error);
    return NextResponse.json({ error: "Non è stato possibile caricare gli atleti." }, { status: 500 });
  }
}
