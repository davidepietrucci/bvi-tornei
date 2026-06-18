"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import AthleteHeader from "@/app/components/AthleteHeader";
import AthleteBottomNav from "@/app/components/AthleteBottomNav";
import { getIscrizioni, getTornei, getNotifiche } from "@/app/utils/db";
import { Card, Button, Chip } from "@heroui/react";

export default function AtletaDashboard() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const [iscrizioni, setIscrizioni] = useState([]);
  const [torneiAperti, setTorneiAperti] = useState([]);
  const [notifiche, setNotifiche] = useState([]);
  const [loading, setLoading] = useState(true);

  const nome = user?.firstName || "Atleta";
  const initials = user?.fullName
    ? user.fullName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "A";
  const ora = new Date().getHours();
  const saluto = ora < 12 ? "Buongiorno" : ora < 18 ? "Buon pomeriggio" : "Buonasera";

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/atleta");
      return;
    }
    if (user) {
      const nomeUtente = user.fullName || "";
      Promise.all([
        getIscrizioni(),
        getTornei(),
        getNotifiche(),
      ]).then(([allIscrizioni, allTornei, allNotifiche]) => {
        const mie = allIscrizioni.filter(
          (isc) => isc.giocatori?.toLowerCase().includes(nomeUtente.toLowerCase())
        );
        setIscrizioni(mie);
        setTorneiAperti(allTornei.filter((t) => t.stato === "Iscrizioni Aperte"));
        setNotifiche(allNotifiche.slice(0, 3)); // ultimi 3 avvisi
      }).finally(() => setLoading(false));
    }
  }, [router, isLoaded, user]);

  // Calcoli
  const iscrConfirmate = iscrizioni.filter((i) => i.stato === "Approvata").length;
  const iscrAttesa = iscrizioni.filter((i) => i.stato === "In Attesa").length;
  const prossimaIscr = iscrizioni.find((i) => i.stato === "Approvata") || iscrizioni[0] || null;
  const notificheNonLette = notifiche.length; // semplificato

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-[#f0f4ff] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#0a1628] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f0f4ff] pb-28 xl:pb-10">
      <AthleteHeader />

      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-5">

        {/* Hero Card */}
        <Card className="border-none bg-[#0a1628] text-white rounded-[2rem] shadow-xl overflow-hidden">
          <Card.Content className="p-6 relative z-10 flex flex-row items-center justify-between">
            <div className="absolute top-0 right-0 w-40 h-40 bg-[#FFD700]/5 rounded-full -mr-20 -mt-20 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/3 rounded-full -ml-16 -mb-16 pointer-events-none" />
            <div>
              <p className="text-[10px] font-black text-[#FFD700]/70 uppercase tracking-[0.3em] mb-1">{saluto} 👋</p>
              <h1 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">{nome}</h1>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-2">Portale Atleta BVI</p>
            </div>
            <div className="w-16 h-16 rounded-[1.4rem] bg-[#FFD700] flex items-center justify-center text-[#0a1628] font-black text-2xl shadow-lg shrink-0">
              {initials}
            </div>
          </Card.Content>
        </Card>

        {/* Notifiche Staff */}
        {notifiche.length > 0 && (
          <Card 
            className="border-none bg-white rounded-[1.8rem] shadow-sm border border-amber-100 transition-all hover:-translate-y-0.5 cursor-pointer"
            onClick={() => router.push("/atleta/notifiche")}
          >
            <Card.Content className="p-5">
              <div className="flex items-center justify-between mb-3 w-full">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Avvisi Staff</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-gray-300">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
              <div className="space-y-2 w-full text-left">
                {notifiche.map((n, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <span className="text-base mt-0.5 shrink-0">
                      {n.tipo === "urgente" ? "🚨" : n.tipo === "avviso" ? "⚠️" : "ℹ️"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-[#0a1628] truncate">{n.titolo}</p>
                      <p className="text-[10px] text-gray-400 font-medium truncate">{n.messaggio}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card.Content>
          </Card>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-none bg-white rounded-[1.8rem] shadow-sm">
            <Card.Content className="p-5">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Confermate</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-green-600">{iscrConfirmate}</span>
                <span className="text-[9px] font-bold text-green-400 uppercase">tornei</span>
              </div>
            </Card.Content>
          </Card>
          <Card className="border-none bg-white rounded-[1.8rem] shadow-sm">
            <Card.Content className="p-5">
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">In Attesa</p>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-amber-500">{iscrAttesa}</span>
                <span className="text-[9px] font-bold text-amber-400 uppercase">richieste</span>
              </div>
            </Card.Content>
          </Card>
        </div>

        {/* Prossima iscrizione */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">La tua prossima sfida</h2>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => router.push("/atleta/iscrizioni")}
              className="text-[10px] font-black text-blue-500 uppercase tracking-widest min-w-0 p-0 h-auto border-none bg-transparent hover:bg-transparent"
            >
              Vedi tutte →
            </Button>
          </div>

          {prossimaIscr ? (
            <Card className="border-none bg-white rounded-[1.8rem] shadow-sm">
              <Card.Content className="p-5 flex flex-row items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#0a1628] flex items-center justify-center text-2xl shrink-0">🏐</div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-[#0a1628] text-sm uppercase tracking-tight truncate">{prossimaIscr.torneo}</p>
                  <p className="text-[10px] text-gray-400 font-semibold mt-1 truncate">{prossimaIscr.giocatori}</p>
                  <p className="text-[10px] text-gray-300 font-bold mt-0.5">{prossimaIscr.data}</p>
                </div>
                <Chip
                  variant="soft"
                  color={prossimaIscr.stato === "Approvata" ? "success" : "warning"}
                  className="shrink-0 text-[9px] font-black uppercase tracking-wider"
                >
                  <Chip.Label>{prossimaIscr.stato === "Approvata" ? "Confermato" : "In Attesa"}</Chip.Label>
                </Chip>
              </Card.Content>
            </Card>
          ) : (
            <Card 
              className="border-none bg-white rounded-[1.8rem] shadow-sm border border-dashed border-gray-200 cursor-pointer"
              onClick={() => router.push("/atleta/iscriviti")}
            >
              <Card.Content className="flex flex-col items-center gap-3 py-6">
                <span className="text-4xl">🏜️</span>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest text-center">Nessuna iscrizione attiva</p>
                <Button
                  onPress={() => router.push("/atleta/iscriviti")}
                  className="text-[10px] font-black text-white bg-[#0a1628] rounded-full uppercase tracking-widest px-6 py-2 shadow-sm"
                >
                  Iscriviti ora →
                </Button>
              </Card.Content>
            </Card>
          )}
        </div>

        {/* Tornei aperti */}
        {torneiAperti.length > 0 && (
          <div>
            <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Tornei con iscrizioni aperte</h2>
            <div className="space-y-3">
              {torneiAperti.map((t) => (
                <Card
                  key={t.id}
                  className="border-none bg-white rounded-[1.8rem] shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer"
                  onClick={() => router.push("/atleta/iscriviti")}
                >
                  <Card.Content className="p-5 flex flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#FFD700]/20 flex items-center justify-center shrink-0">
                        <span className="text-lg">🏆</span>
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="font-black text-[#0a1628] text-xs uppercase tracking-tight truncate">{t.nome}</p>
                        <p className="text-[10px] text-gray-400 font-semibold mt-0.5">{t.data} · {t.categoria}</p>
                      </div>
                    </div>
                    <Chip
                      variant="soft"
                      color="success"
                      className="shrink-0 text-[9px] font-black uppercase tracking-wider"
                    >
                      <Chip.Label>Aperto</Chip.Label>
                    </Chip>
                  </Card.Content>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Azioni rapide */}
        <div>
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 px-1">Azioni rapide</h2>
          <div className="grid grid-cols-2 gap-3">
            <Card
              className="col-span-2 border-none bg-white rounded-[1.8rem] shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer"
              onClick={() => router.push("/atleta/gironi")}
            >
              <Card.Content className="p-5 flex flex-row items-center justify-center gap-3">
                <span className="text-2xl">📊</span>
                <span className="text-[10px] font-black text-[#0a1628] uppercase tracking-widest text-center">Gironi Live</span>
              </Card.Content>
            </Card>
            <Card
              className="border-none bg-white rounded-[1.8rem] shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer"
              onClick={() => router.push("/atleta/notifiche")}
            >
              <Card.Content className="p-5 flex flex-col items-center gap-3 relative">
                {notificheNonLette > 0 && (
                  <span className="absolute top-4 right-4 w-5 h-5 bg-red-500 rounded-full text-[9px] font-black text-white flex items-center justify-center z-20 animate-pulse">
                    {notificheNonLette}
                  </span>
                )}
                <span className="text-3xl">🔔</span>
                <span className="text-[10px] font-black text-[#0a1628] uppercase tracking-widest text-center">Notifiche</span>
              </Card.Content>
            </Card>
            <Card
              className="border-none bg-white rounded-[1.8rem] shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer"
              onClick={() => router.push("/atleta/profilo")}
            >
              <Card.Content className="p-5 flex flex-col items-center gap-3">
                <span className="text-3xl">👤</span>
                <span className="text-[10px] font-black text-[#0a1628] uppercase tracking-widest text-center">Profilo</span>
              </Card.Content>
            </Card>
          </div>
        </div>

      </div>

      <AthleteBottomNav notificheCount={notificheNonLette} />
    </main>
  );
}
