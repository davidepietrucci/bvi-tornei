"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import AthleteHeader from "@/app/components/AthleteHeader";
import AthleteBottomNav from "@/app/components/AthleteBottomNav";
import { calendarDay, fetchAthleteData, sortNotifications } from "@/app/utils/athlete-area";
import useAthleteNotifications from "@/app/components/useAthleteNotifications";

const TIPO_CONFIG = {
  urgente: { emoji: "🚨", color: "bg-red-50 border-red-100", badge: "bg-red-100 text-red-700", label: "Urgente" },
  avviso:  { emoji: "⚠️", color: "bg-amber-50 border-amber-100", badge: "bg-amber-100 text-amber-700", label: "Avviso" },
  info:    { emoji: "ℹ️", color: "bg-blue-50 border-blue-100", badge: "bg-blue-100 text-blue-600", label: "Info" },
};

export default function AtletaNotifiche() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const [notifiche, setNotifiche] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const notificationSettings = useAthleteNotifications(user?.id);
  const unreadCount = notifiche.filter(notificationSettings.isUnread).length;

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/atleta");
      return;
    }
    if (user) {
      let cancelled = false;
      const controller = new AbortController();
      setLoading(true); setLoadError("");
      fetchAthleteData("notifiche", { array: true, signal: controller.signal }).then((data) => {
        if (!cancelled) setNotifiche(sortNotifications(data));
      }).catch((error) => {
        if (!cancelled) setLoadError(error.message);
      }).finally(() => { if (!cancelled) setLoading(false); });
      return () => { cancelled = true; controller.abort(); };
    }
  }, [router, isLoaded, user, reload]);

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-[#f0f4ff] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#0a1628] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f0f4ff] pb-28 xl:pb-10 xl:pl-72">
      <AthleteHeader />

      <div className="max-w-2xl mx-auto px-4 pt-6">

        {/* Titolo */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-black text-[#0a1628] uppercase tracking-tighter">Notifiche</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Avvisi dallo staff BVI</p>
          </div>
          {notifiche.length > 0 && (
            <span className="w-8 h-8 rounded-full bg-[#0a1628] text-[#FFD700] text-xs font-black flex items-center justify-center">
              {notifiche.length}
            </span>
          )}
        </div>

        {loadError && <div role="alert" className="mb-5 rounded-2xl bg-red-50 p-4 text-sm text-red-800">{loadError}<button onClick={() => setReload((n) => n + 1)} className="ml-3 font-bold underline">Riprova</button></div>}
        {notificationSettings.error && <p role="alert" className="mb-4 text-sm text-red-700">{notificationSettings.error}</p>}
        {!loadError && unreadCount > 0 && <button onClick={() => notificationSettings.markRead(notifiche)} className="mb-5 rounded-xl bg-white p-3 text-sm font-bold">Segna tutte come lette ({unreadCount})</button>}
        <p className="mb-4 text-xs text-gray-500">Lo stato di lettura è salvato per il tuo account su questo browser.</p>
        {/* Lista notifiche */}
        {!loadError && (notifiche.length > 0 ? (
          <div className="space-y-3">
            {notifiche.map((n, idx) => {
              const cfg = TIPO_CONFIG[n.tipo] || TIPO_CONFIG.info;
              return (
                <div
                  key={idx}
                  className={`rounded-[1.8rem] p-5 border shadow-sm ${cfg.color}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0 mt-0.5">{cfg.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="font-black text-[#0a1628] text-sm uppercase tracking-tight truncate">
                          {n.titolo || "Comunicazione Staff"}
                        </p>
                        <span className={`shrink-0 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 font-medium leading-relaxed">
                        {n.messaggio || "Nessun contenuto."}
                      </p>
                      {notificationSettings.isUnread(n) ? <button onClick={() => notificationSettings.markRead([n])} className="mt-3 text-xs font-bold underline">Nuova · Segna come letta</button> : <p className="mt-3 text-xs text-gray-500">Letta</p>}
                      {n.data && (
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-2">
                          📅 {calendarDay(n.data) !== null ? new Date(calendarDay(n.data)).toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" }) : "Data non disponibile"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-20 h-20 rounded-[2rem] bg-white shadow-sm border border-gray-100 flex items-center justify-center text-4xl">
              🔔
            </div>
            <div>
              <p className="font-black text-[#0a1628] text-base uppercase tracking-tighter">Nessuna notifica</p>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                Lo staff non ha ancora inviato avvisi
              </p>
            </div>
            <button
              onClick={() => router.push("/atleta/dashboard")}
              className="px-8 py-3.5 bg-[#0a1628] text-[#FFD700] rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-transform"
            >
              ← Torna alla Dashboard
            </button>
          </div>
        ))}

        {/* Info */}
        {notifiche.length > 0 && (
          <div className="mt-6 p-4 bg-white/60 rounded-2xl border border-gray-100 text-center">
            <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
              Le notifiche vengono inviate dallo staff BVI per aggiornamenti importanti sui tornei
            </p>
          </div>
        )}
      </div>

      <AthleteBottomNav notificheCount={!loadError && notificationSettings.enabled ? unreadCount : 0} />
    </main>
  );
}
