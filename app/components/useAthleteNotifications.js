"use client";

import { useEffect, useRef, useState } from "react";
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
  const [settings, setSettings] = useState({ enabled: true, read: [], notifications: [], loading: true });
  const [error, setError] = useState(null);
  const saving = useRef(false), epoch = useRef(0), activeUser = useRef(userId);
  useEffect(() => {
    activeUser.current = userId;
    ++epoch.current;
    if (!userId) return;
    const controller = new AbortController(); let cancelled = false;
    const load = async () => {
      if (saving.current) return;
      const current = ++epoch.current;
      try {
        const response = await fetch("/api/atleta/notifiche", { cache: "no-store", signal: controller.signal });
        const json = await response.json();
        if (!response.ok || !Array.isArray(json.data) || !Array.isArray(json.settings?.read) || typeof json.settings?.enabled !== "boolean") throw new Error(json.error || "Risposta notifiche non valida.");
        if (cancelled || current !== epoch.current || activeUser.current !== userId) return;
        let preferences = json.settings;
        if (!preferences.initialized) {
          let local = { enabled: true, read: [] };
          try { local = readNotificationSettings(window.localStorage, userId); } catch { /* Storage access may itself be blocked. */ }
          preferences = { ...preferences, enabled: local.enabled,
            read: json.data.filter((notice) => local.read.includes(notificationKey(notice)) || local.read.includes(String(notice.id))).map((notice) => String(notice.id)) };
        }
        setSettings({ ...preferences, userId, notifications: json.data, loading: false, saving: false });
        setError(null);
      } catch (reason) {
        if (!cancelled && current === epoch.current && activeUser.current === userId) {
          setError({ userId, message: reason.message || "Aggiornamento notifiche non riuscito." });
          setSettings((previous) => ({ ...(previous.userId === userId ? previous : { enabled: true, read: [], notifications: [] }), userId, loading: false }));
        }
      }
    };
    load(); const timer = setInterval(load, 15000);
    window.addEventListener("focus", load); window.addEventListener(eventName, load);
    return () => { cancelled = true; controller.abort(); clearInterval(timer); window.removeEventListener("focus", load); window.removeEventListener(eventName, load); };
  }, [userId]);
  const current = settings.userId === userId ? settings : { enabled: true, read: [], notifications: [], loading: true, saving: false };
  const save = async (items, enabled) => {
    if (!userId || saving.current || current.loading) return false;
    saving.current = true; ++epoch.current;
    setSettings((previous) => ({ ...previous, saving: true }));
    const visible = new Set(current.notifications.map((notice) => String(notice.id)));
    const read = [...new Set([...current.read, ...items.map((notice) => String(notice.id))])].filter((id) => visible.has(id)).slice(-200);
    let confirmed = false;
    try {
      const response = await fetch("/api/atleta/notifiche", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ read, ...(enabled === undefined ? {} : { enabled }) }) });
      const json = await response.json();
      if (!response.ok || !json.success || !Array.isArray(json.settings?.read)) throw new Error(json.error || "Salvataggio delle notifiche non confermato.");
      if (activeUser.current !== userId) return false;
      setSettings((previous) => ({ ...previous, ...json.settings, userId, saving: false })); setError(null);
      confirmed = true;
      try { window.localStorage.setItem(`bvi_notifications:${userId}`, JSON.stringify(json.settings)); } catch { /* Cloud state remains authoritative. */ }
      return true;
    } catch (reason) { if (activeUser.current === userId) setError({ userId, message: reason.message }); return false; }
    finally {
      saving.current = false;
      if (activeUser.current === userId) { setSettings((previous) => ({ ...previous, saving: false })); if (confirmed) window.dispatchEvent(new Event(eventName)); }
    }
  };
  return { ...current, error: error && error.userId === userId ? error.message : "",
    refresh: () => window.dispatchEvent(new Event(eventName)),
    toggle: () => save([], !current.enabled), markRead: (items) => save(items),
    isUnread: (notice) => !current.read.includes(String(notice.id)),
  };
}
