import { createHash } from "node:crypto";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getNotifiche, getNotificationEvents, getNotificationRegistrations, getNotificationPreferences } from "./db-server";
import { visibleNotifications } from "./notifications";
import { notificationKey, sortNotifications } from "./athlete-area";

export async function notificationActor() {
  const { userId, sessionClaims } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  return { userId, role: user?.publicMetadata?.role || sessionClaims?.metadata?.role || sessionClaims?.publicMetadata?.role || "atleta",
    email: String(user?.primaryEmailAddress?.emailAddress || "").trim().toLocaleLowerCase("it-IT") };
}

export async function athleteNotificationFeed(actor) {
  const [events, legacy, registrations, settings] = await Promise.all([
    getNotificationEvents(), getNotifiche(), getNotificationRegistrations(), getNotificationPreferences(actor.userId),
  ]);
  const previous = (Array.isArray(legacy) ? legacy : []).map((notice) => ({ ...notice,
    id: `legacy-${createHash("sha256").update(notificationKey(notice)).digest("hex").slice(0, 32)}` }));
  const data = sortNotifications(visibleNotifications([...events, ...previous], actor.userId, actor.email, registrations)).slice(0, 200);
  return { data, settings };
}
