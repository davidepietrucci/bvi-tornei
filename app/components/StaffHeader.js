"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";

const MENU_ITEMS = [
  { name: "Dashboard", path: "/staff/dashboard", icon: "⌂" },
  { name: "Iscrizioni", path: "/staff/iscrizioni", icon: "☷" },
  { name: "Anagrafica Atleti", path: "/staff/atleti", icon: "♙", adminOnly: true },
  { name: "Tornei", path: "/staff/tornei", icon: "🏆" },
  { name: "Tour", path: "/staff/tour", icon: "↗" },
  { name: "Gironi", path: "/staff/gironi", icon: "▦" },
  { name: "Tabellone", path: "/staff/tabellone", icon: "⌘" },
  { name: "Classifica", path: "/staff/classifica", icon: "☰" },
  { name: "Pagamenti", path: "/staff/pagamenti", icon: "€" },
  { name: "Sponsor", path: "/staff/sponsors", icon: "✦" },
];

function isCurrentPage(pathname, itemPath) {
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

export default function StaffHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [role, setRole] = useState("staff");
  const [username, setUsername] = useState("");
  const [dbConnected, setDbConnected] = useState(false);
  const [dbStatusText, setDbStatusText] = useState("Verifica Database...");

  useEffect(() => {
    fetch(`/api/db?type=status&_t=${Date.now()}`)
      .then((res) => res.json())
      .then((json) => {
        const status = json.status;
        if (status?.isConnected) {
          setDbConnected(true);
          setDbStatusText("Database: Cloud ☁️");
        } else if (status?.missing?.length) {
          setDbConnected(false);
          setDbStatusText(`Database: Non connesso ⚠️ (${status.missing.join(", ")})`);
        } else {
          setDbConnected(false);
          setDbStatusText("Database: Offline ⚠️");
        }
      })
      .catch(() => {
        setDbConnected(false);
        setDbStatusText("Database: Errore connessione ❌");
      });

    if (isLoaded && !user) {
      router.push("/staff");
      return;
    }

    if (user) {
      const userRole = user.publicMetadata?.role || "staff";
      setRole(userRole);
      const rawName = user.firstName || user.fullName || user.username || (user.primaryEmailAddress?.emailAddress ? user.primaryEmailAddress.emailAddress.split("@")[0] : "Staff");
      setUsername(rawName ? rawName.charAt(0).toLocaleUpperCase("it-IT") + rawName.slice(1) : "Staff");

      if (userRole !== "admin" && pathname === "/staff/atleti") {
        router.push("/staff/dashboard");
      }
    }
  }, [router, pathname, user, isLoaded]);

  const handleLogout = async () => {
    await signOut({ redirectUrl: "/staff" });
  };

  const menuItems = MENU_ITEMS.filter((item) => !item.adminOnly || role === "admin");

  const renderNavItems = (compact = false) => menuItems.map((item) => {
    const active = isCurrentPage(pathname, item.path);
    return (
      <Link
        key={item.path}
        href={item.path}
        onClick={() => setIsMenuOpen(false)}
        aria-current={active ? "page" : undefined}
        className={`${compact ? "flex items-center gap-3 rounded-xl px-4 py-3" : "flex items-center gap-3 rounded-2xl px-4 py-3.5"} text-sm font-bold transition-colors ${
          active
            ? "bg-[#FFD700] text-[#0a1628] shadow-md"
            : compact
              ? "bg-gray-50 text-gray-700 hover:bg-gray-100"
              : "text-white/75 hover:bg-white/10 hover:text-white"
        }`}
      >
        <span aria-hidden="true" className="w-6 text-center text-lg leading-none">{item.icon}</span>
        <span>{item.name}</span>
        {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#0a1628]" />}
      </Link>
    );
  });

  return (
    <>
      {/* Navigazione laterale desktop */}
      <aside className="staff-sidebar fixed inset-y-0 left-0 z-[120] hidden w-72 flex-col bg-[#0a1628] px-4 py-5 text-white shadow-2xl xl:flex">
        <div className="flex items-center gap-3 border-b border-white/10 px-2 pb-5">
          <Image src="/logo.png" alt="BVI Logo" width={44} height={44} className="object-contain" />
          <div className="min-w-0">
            <h1 className="text-lg font-black uppercase tracking-tight leading-none text-[#FFD700]">BVI Staff</h1>
            <span className={`mt-2 block truncate text-[9px] font-bold ${dbConnected ? "text-green-300" : "text-amber-300"}`} title={dbStatusText}>
              {dbStatusText}
            </span>
          </div>
        </div>

        <nav aria-label="Navigazione staff" className="mt-5 flex-1 space-y-1 overflow-y-auto pr-1">
          {renderNavItems()}
        </nav>

        <div className="mt-4 border-t border-white/10 pt-4">
          {username && <p className="mb-3 truncate px-3 text-xs font-bold text-white/60">Ciao, {username}</p>}
          <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold text-red-200 transition-colors hover:bg-red-500/15 hover:text-red-100">
            <span aria-hidden="true" className="w-6 text-center text-lg">↪</span>
            Esci dal portale
          </button>
        </div>
      </aside>

      {/* Barra superiore per tablet e telefono */}
      <header className="sticky top-0 z-[100] flex items-center justify-between border-b-4 border-[#0a1628] bg-white px-4 py-3 shadow-md xl:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <Image src="/logo.png" alt="BVI Logo" width={38} height={38} className="object-contain" />
          <div className="min-w-0">
            <h1 className="text-lg font-black uppercase tracking-tighter leading-none text-[#0a1628]">BVI Staff</h1>
            <span className={`mt-1 block max-w-[55vw] truncate text-[8px] font-black uppercase tracking-wider ${dbConnected ? "text-green-600" : "text-amber-600"}`} title={dbStatusText}>
              {dbStatusText}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {username && <span className="hidden max-w-32 truncate text-[10px] font-bold uppercase tracking-widest text-gray-500 sm:inline">Ciao, {username}</span>}
          <button
            type="button"
            aria-label={isMenuOpen ? "Chiudi menu staff" : "Apri menu staff"}
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((open) => !open)}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-lg font-black text-[#0a1628]"
          >
            {isMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </header>

      {/* Menu a scomparsa su tablet e telefono */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[130] bg-black/50 xl:hidden" onClick={() => setIsMenuOpen(false)}>
          <aside className="absolute inset-y-0 left-0 flex w-80 max-w-[88vw] flex-col overflow-y-auto bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-[#0a1628]">Menu Staff</p>
                {username && <p className="mt-1 text-xs font-semibold text-gray-400">Ciao, {username}</p>}
              </div>
              <button type="button" aria-label="Chiudi menu" onClick={() => setIsMenuOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-lg font-black text-[#0a1628]">✕</button>
            </div>
            <nav aria-label="Navigazione staff" className="flex flex-col gap-2">
              {renderNavItems(true)}
            </nav>
            <div className="mt-auto border-t border-gray-100 pt-4">
              <button onClick={handleLogout} className="flex w-full items-center justify-center rounded-2xl bg-red-50 p-4 text-xs font-black uppercase tracking-widest text-red-600">
                Esci dal portale
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
