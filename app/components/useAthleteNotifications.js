"use client";

import { useEffect, useState } from "react";
import { notificationKey } from "@/app/utils/athlete-area";

const eventName = "bvi-athlete-notifications";
export function readNotificationSettings(storage, userId) {
  if (!userId) return { enabled: true, read: [] };
  try {
    const value = JSON.parse(storage.getItem(`bvi_notifications:${userId}`) || "null");
    return { enabled: value?.enabled !== false, read: Array.isArray(value?.read) ? value.read.filter((key) => typeof key === "string") : [] };
  } catch { return { enabled: true, read: [] }; }
}

export default function useAthleteNotifications(userId) {
  const [settings, setSettings] = useState({ enabled: true, read: [] });
  const [error, setError] = useState("");
  useEffect(() => {
    const load = () => {
      try { setSettings({ ...readNotificationSettings(window.localStorage, userId), userId }); }
      catch { setSettings({ enabled: true, read: [], userId }); }
    };
    load();
    window.addEventListener("storage", load);
    window.addEventListener(eventName, load);
    return () => { window.removeEventListener("storage", load); window.removeEventListener(eventName, load); };
  }, [userId]);
  const save = (update) => {
    if (!userId) return;
    try {
      const next = update(readNotificationSettings(window.localStorage, userId));
      window.localStorage.setItem(`bvi_notifications:${userId}`, JSON.stringify(next));
      setSettings({ ...next, userId }); setError(""); window.dispatchEvent(new Event(eventName));
    } catch { setError("Il browser non permette di salvare le preferenze delle notifiche."); }
  };
  const current = settings.userId === userId ? settings : { enabled: true, read: [] };
  return { ...current, error,
    toggle: () => save((current) => ({ ...current, enabled: !current.enabled })),
    markRead: (items) => save((current) => ({ ...current, read: [...new Set([...current.read, ...items.map(notificationKey)])] })),
    isUnread: (item) => !current.read.includes(notificationKey(item)),
  };
}
