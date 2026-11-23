"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import StaffHeader from "@/app/components/StaffHeader";
import StaffPageHeading from "@/app/components/StaffPageHeading";
import StaffIcon from "@/app/components/StaffIcon";
import { getTornei, getIscrizioni, saveTornei, saveIscrizioni, saveUsers } from "@/app/utils/db";

export default function StaffDashboard() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [stats, setStats] = useState({
    torneiAttivi: 0,
    iscrizioniInAttesa: 0,
    squadreConfermate: 0
  });
  const [role, setRole] = useState("admin");

  useEffect(() => {
    Promise.all([getTornei(), getIscrizioni()]).then(([tornei, iscrizioni]) => {
      const countTorneiAttivi = tornei.filter(t => ["Iscrizioni Aperte", "In Programmazione", "In Corso"].includes(t.stato)).length;
      const countInAttesa = iscrizioni.filter(i => i.stato === "In Attesa").length;
      const countConfermate = iscrizioni.filter(i => i.stato === "Approvata").length;

      setStats({
        torneiAttivi: countTorneiAttivi,
        iscrizioniInAttesa: countInAttesa,
        squadreConfermate: countConfermate
      });
    });
  }, []);

  useEffect(() => {
    if (user) {
      setRole(user.publicMetadata?.role || "staff");
    }
  }, [user]);

  const handleResetData = async () => {
    if (typeof window !== "undefined" && window.confirm("Sei sicuro di voler cancellare TUTTI i dati (tornei, iscritti, atleti, gironi) dal database? Questa azione non è reversibile.")) {
      await saveTornei([]);
      await saveIscrizioni([]);
      await saveUsers([]);
      // Clear localStorage items
      localStorage.removeItem("bvi_tornei");
      localStorage.removeItem("bvi_iscrizioni");
      localStorage.removeItem("bvi_users");
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("bvi_gironi_") || key.startsWith("bvi_bracket_") || key.startsWith("bvi_iscrizioni") || key.startsWith("bvi_tornei") || key.startsWith("bvi_users"))) {
          localStorage.removeItem(key);
        }
      }
      alert("Database ripulito con successo!");
      window.location.reload();
    }
  };


  return (
    <main className="min-h-screen pb-12 bg-[#f8faff]">
      <StaffHeader />

      <div className="max-w-6xl mx-auto mt-6 md:mt-10 px-4">
        <StaffPageHeading title="Dashboard" description="Tornei, iscrizioni e operazioni quotidiane in un unico spazio." actions={<button onClick={() => router.push('/staff/tornei/nuovo')} className="staff-button staff-button-yellow"><StaffIcon name="plus" className="h-4 w-4" />Nuovo torneo</button>} />
        
        <div className="grid grid-cols-3 gap-4">
          {[{ label: "Tornei attivi", value: stats.torneiAttivi, icon: "tournaments", href: "/staff/tornei" },
            { label: "Iscrizioni in attesa", value: stats.iscrizioniInAttesa, icon: "registrations", href: "/staff/iscrizioni" },
            { label: "Iscrizioni confermate", value: stats.squadreConfermate, icon: "athletes", href: "/staff/iscrizioni" }].map((item) => <div key={item.label} className="staff-stat"><div className="staff-stat-label"><span>{item.label}</span><StaffIcon name={item.icon} className="h-5 w-5 text-slate-400" /></div><p className="staff-stat-value">{item.value}</p><button onClick={() => router.push(item.href)} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-slate-500">Apri sezione<StaffIcon name="arrow" className="h-3.5 w-3.5" /></button></div>)}
        </div>

        <section className="staff-panel mt-6"><h2 className="text-base font-bold">Accesso rapido</h2><p className="mt-1 text-sm text-slate-500">Le attività più frequenti, senza passaggi intermedi.</p><div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-3">{[
          { title: "Gestisci il torneo", detail: "Gironi, risultati e tabellone", icon: "management", href: "/staff/gestione-torneo" },
          { title: "Valuta le iscrizioni", detail: "Conferme e partecipanti", icon: "registrations", href: "/staff/iscrizioni" },
          { title: "Registra un pagamento", detail: "Quote, acconti e saldi", icon: "payments", href: "/staff/pagamenti" },
          { title: "Organizza un tour", detail: "Tappe e classifica del circuito", icon: "tour", href: "/staff/tour" },
          { title: "Crea un torneo", detail: "Date, formato e iscrizioni", icon: "plus", href: "/staff/tornei/nuovo" },
          { title: "Gestisci gli sponsor", detail: "Partner e visibilità", icon: "sponsors", href: "/staff/sponsors" },
        ].map((item) => <button key={item.href} onClick={() => router.push(item.href)} className="staff-quick-link"><span className="flex items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100"><StaffIcon name={item.icon} /></span><span><strong className="block text-sm font-semibold">{item.title}</strong><span className="mt-1 block text-xs text-slate-500">{item.detail}</span></span></span><StaffIcon name="arrow" className="h-4 w-4 shrink-0 text-slate-400" /></button>)}</div></section>

        {/* Gestione Dati */}
        {role === "admin" && (
          <details className="staff-danger-zone mt-6">
            <summary className="cursor-pointer text-sm font-semibold text-red-800">Amministrazione database · Operazioni avanzate</summary>
            <p className="mt-3 text-xs text-slate-500">Operazione irreversibile. Non necessaria per la gestione ordinaria dei tornei.</p>
            <div className="mt-4">
              <button 
                onClick={handleResetData}
                className="flex items-center justify-between p-5 bg-red-50 hover:bg-red-600 hover:text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all group shadow-sm border border-red-100 text-red-700"
              >
                Resetta database
              </button>
            </div>
          </details>
        )}
      </div>
    </main>
  );
}
