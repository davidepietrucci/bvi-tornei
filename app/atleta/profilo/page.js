"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import AthleteHeader from "@/app/components/AthleteHeader";
import AthleteBottomNav from "@/app/components/AthleteBottomNav";

const TABS = ["Info", "Impostazioni"];

export default function AtletaProfilo() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [tab, setTab] = useState("Info");
  const [notifiche, setNotifiche] = useState(true);

  // Profile Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    username: ""
  });

  useEffect(() => {
    // Carica preferenze da localStorage
    const savedNotif = localStorage.getItem("bvi_notif_atleta");
    if (savedNotif !== null) setNotifiche(savedNotif === "true");

    if (user) {
      setEditForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        username: user.username || ""
      });
    }
  }, [user]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#f0f4ff] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#0a1628] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const nome = user?.fullName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || user?.username || "—";
  const email = user?.primaryEmailAddress?.emailAddress || "—";
  const initials = nome !== "—"
    ? nome.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "A";

  const toggleNotifiche = () => {
    const newVal = !notifiche;
    setNotifiche(newVal);
    localStorage.setItem("bvi_notif_atleta", String(newVal));
  };

  const handleLogout = () => {
    signOut({ redirectUrl: "/" });
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await user.update({
        firstName: editForm.firstName.trim(),
        lastName: editForm.lastName.trim(),
        ...(editForm.username.trim() ? { username: editForm.username.trim() } : {})
      });
      alert("Profilo aggiornato con successo!");
      setIsEditing(false);
    } catch (err) {
      alert("Errore durante l'aggiornamento: " + (err.errors?.[0]?.message || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f0f4ff] pb-28 xl:pb-10">
      <AthleteHeader />

      <div className="max-w-2xl mx-auto px-4 pt-6">

        {/* Avatar hero */}
        <div className="flex items-center gap-5 mb-6">
          <div className="w-20 h-20 rounded-[1.6rem] bg-[#0a1628] flex items-center justify-center text-[#FFD700] font-black text-3xl shadow-xl border-4 border-white shrink-0">
            {initials}
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#0a1628] uppercase tracking-tighter">{nome}</h1>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{email}</p>
            <span className="mt-2 inline-block text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest border border-blue-100">
              Atleta BVI
            </span>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-white p-1 rounded-2xl border border-gray-100 shadow-sm mb-5">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                tab === t
                  ? "bg-[#0a1628] text-white shadow-md"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Tab: Info */}
        {tab === "Info" && (
          <div className="space-y-3">
            <InfoRow emoji="👤" label="Nome" value={user?.firstName || "Non impostato"} />
            <InfoRow emoji="👤" label="Cognome" value={user?.lastName || "Non impostato"} />
            <InfoRow emoji="🏷️" label="Username" value={user?.username || "Non impostato"} />
            <InfoRow emoji="📧" label="Email" value={email} />

            <div className="pt-3 flex flex-col gap-3">
              <button
                onClick={() => setIsEditing(true)}
                className="w-full py-4 bg-[#0a1628] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-slate-800 shadow-md"
              >
                ✏️ Modifica Dati Profilo
              </button>

              <button
                onClick={handleLogout}
                className="w-full py-4 bg-red-50 border border-red-100 text-red-500 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-red-100"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                </svg>
                Disconnetti account
              </button>
            </div>
          </div>
        )}

        {/* Tab: Impostazioni */}
        {tab === "Impostazioni" && (
          <div className="space-y-3">
            <div className="bg-white rounded-[1.8rem] p-5 shadow-sm border border-gray-100">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Privacy & Notifiche</h2>
              <div className="space-y-3">
                <ToggleRow
                  label="Notifiche Staff"
                  desc="Avvisi su tornei e scadenze"
                  value={notifiche}
                  onChange={toggleNotifiche}
                />
              </div>
            </div>

            <div className="bg-white rounded-[1.8rem] p-5 shadow-sm border border-gray-100">
              <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Account</h2>
              <div className="space-y-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-2xl text-xs font-black text-gray-700 hover:bg-gray-100 transition-colors active:scale-[0.98]"
                >
                  <span>✏️ Modifica Nome, Cognome o Username</span>
                </button>
                <button
                  onClick={() => router.push("/")}
                  className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-2xl text-xs font-black text-gray-600 hover:bg-gray-100 transition-colors active:scale-[0.98]"
                >
                  <span>Torna alla home pubblica</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-gray-300">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-between p-4 bg-red-50 rounded-2xl text-xs font-black text-red-500 hover:bg-red-100 transition-colors active:scale-[0.98]"
                >
                  <span>Disconnetti</span>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal Edit Profile */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-[#0a1628]">Modifica Profilo</h3>
              <button
                onClick={() => setIsEditing(false)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 hover:bg-gray-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                  Nome
                </label>
                <input
                  type="text"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                  placeholder="Es. Davide"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-[#0a1628] focus:outline-none focus:ring-2 focus:ring-[#0a1628]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                  Cognome
                </label>
                <input
                  type="text"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                  placeholder="Es. Pietrucci"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-[#0a1628] focus:outline-none focus:ring-2 focus:ring-[#0a1628]"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  placeholder="Es. davide"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-[#0a1628] focus:outline-none focus:ring-2 focus:ring-[#0a1628]"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-colors"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3 bg-[#0a1628] hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {saving ? "Salvataggio..." : "Salva Modifiche"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AthleteBottomNav />
    </main>
  );
}

function InfoRow({ emoji, label, value }) {
  return (
    <div className="bg-white rounded-[1.8rem] p-4 shadow-sm border border-gray-100 flex items-center gap-4">
      <span className="text-2xl shrink-0">{emoji}</span>
      <div className="min-w-0">
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
        <p className="text-sm font-black text-[#0a1628] mt-0.5 truncate">{value}</p>
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 bg-gray-50 rounded-2xl">
      <div>
        <p className="text-xs font-black text-[#0a1628] uppercase tracking-tight">{label}</p>
        <p className="text-[9px] font-bold text-gray-400 mt-0.5">{desc}</p>
      </div>
      <button
        onClick={onChange}
        className={`relative w-12 h-6 rounded-full transition-colors duration-200 shrink-0 ${value ? "bg-green-500" : "bg-gray-200"}`}
        aria-label={label}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${value ? "translate-x-6" : "translate-x-0.5"}`}
        />
      </button>
    </div>
  );
}
