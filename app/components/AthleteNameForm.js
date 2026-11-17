"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { getAthleteName } from "@/app/utils/athleteIdentity";

export default function AthleteNameForm() {
  const { user } = useUser();
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    if (!getAthleteName({ firstName, lastName })) {
      setError("Inserisci sia il nome sia il cognome, non il nome utente.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const updated = await user.update({ firstName: firstName.trim(), lastName: lastName.trim() });
      if (!getAthleteName(updated)) throw new Error("Nome e cognome non risultano salvati. Riprova.");
    } catch (err) {
      setError(err.errors?.[0]?.longMessage || err.message || "Salvataggio non riuscito. Riprova.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f0f4ff] flex items-center justify-center p-4">
      <section className="w-full max-w-md bg-white rounded-2xl border-t-4 border-[#FFD700] shadow-xl p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Profilo atleta BVI</p>
        <h1 className="text-2xl font-black text-[#0a1628]">Come ti chiami?</h1>
        <p className="text-sm text-gray-600 mt-3 mb-6">Per partecipare ai tornei servono nome e cognome. Lo username resta invariato e non verrà usato nelle iscrizioni al posto del tuo nome.</p>
        <form onSubmit={save} className="space-y-4">
          <label className="block text-sm font-bold text-[#0a1628]">Nome
            <input autoComplete="given-name" name="firstName" required value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={saving} className="block w-full mt-1 p-3 rounded-xl border border-gray-300" />
          </label>
          <label className="block text-sm font-bold text-[#0a1628]">Cognome
            <input autoComplete="family-name" name="lastName" required value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={saving} className="block w-full mt-1 p-3 rounded-xl border border-gray-300" />
          </label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button disabled={saving} type="submit" className="w-full rounded-xl bg-[#0a1628] text-white font-bold p-3 disabled:opacity-60">{saving ? "Salvataggio…" : "Salva e continua"}</button>
        </form>
      </section>
    </main>
  );
}
