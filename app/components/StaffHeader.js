"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import StaffIcon from "@/app/components/StaffIcon";

const MENU_ITEMS = [
  { name: "Dashboard", path: "/staff/dashboard", icon: "dashboard", group: "Panoramica" },
  { name: "Tornei", path: "/staff/tornei", icon: "tournaments", group: "Organizzazione" },
  { name: "Gestione torneo", path: "/staff/gestione-torneo", icon: "management", group: "Organizzazione" },
  { name: "Tour", path: "/staff/tour", icon: "tour", group: "Organizzazione" },
  { name: "Iscrizioni", path: "/staff/iscrizioni", icon: "registrations", group: "Amministrazione" },
  { name: "Anagrafica Atleti", path: "/staff/atleti", icon: "athletes", group: "Amministrazione", adminOnly: true },
  { name: "Pagamenti", path: "/staff/pagamenti", icon: "payments", group: "Amministrazione" },
  { name: "Notifiche", path: "/staff/notifiche", icon: "notifications", group: "Amministrazione" },
  { name: "Sponsor", path: "/staff/sponsors", icon: "sponsors", group: "Amministrazione" },
];
const isCurrentPage = (pathname, path) => pathname === path || pathname.startsWith(`${path}/`);

export default function StaffHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [role, setRole] = useState("staff");
  const [username, setUsername] = useState("");
  const [dbConnected, setDbConnected] = useState(false);
  const [dbStatusText, setDbStatusText] = useState("Verifica connessione…");
  const menuButton = useRef(null);
  const closeButton = useRef(null);
  const drawer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/db?type=status&_t=${Date.now()}`)
      .then((res) => res.json()).then((json) => {
        if (cancelled) return;
        const status = json.status;
        setDbConnected(Boolean(status?.isConnected));
        setDbStatusText(status?.isConnected ? "Cloud connesso" : status?.missing?.length ? `Non connesso (${status.missing.join(", ")})` : "Database offline");
      }).catch(() => { if (!cancelled) { setDbConnected(false); setDbStatusText("Errore di connessione"); } });
    if (isLoaded && !user) router.push("/staff");
    if (user) {
      const userRole = user.publicMetadata?.role || "staff";
      setRole(userRole);
      const raw = user.firstName || user.fullName || user.username || user.primaryEmailAddress?.emailAddress?.split("@")[0] || "Staff";
      setUsername(raw.charAt(0).toLocaleUpperCase("it-IT") + raw.slice(1));
      if (userRole !== "admin" && pathname === "/staff/atleti") router.push("/staff/dashboard");
    }
    return () => { cancelled = true; };
  }, [router, pathname, user, isLoaded]);

  useEffect(() => {
    if (!isMenuOpen) return;
    closeButton.current?.focus();
    const handleKey = (event) => {
      if (event.key === "Escape") { setIsMenuOpen(false); menuButton.current?.focus(); }
      if (event.key !== "Tab") return;
      const items = drawer.current?.querySelectorAll('a[href], button:not([disabled])');
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    const desktop = window.matchMedia("(min-width: 1280px)");
    const handleDesktop = (event) => { if (event.matches) setIsMenuOpen(false); };
    desktop.addEventListener("change", handleDesktop);
    return () => { document.removeEventListener("keydown", handleKey); desktop.removeEventListener("change", handleDesktop); };
  }, [isMenuOpen]);

  const closeMenu = () => { setIsMenuOpen(false); menuButton.current?.focus(); };
  const menuItems = MENU_ITEMS.filter((item) => !item.adminOnly || role === "admin");
  const current = menuItems.find((item) => isCurrentPage(pathname, item.path));
  const sectionTitle = pathname === "/staff/tornei/nuovo" ? "Nuovo torneo" : pathname.startsWith("/staff/tornei/modifica/") ? "Modifica torneo" : current?.name || "Area staff";
  const brand = <Link href="/staff/dashboard" className="staff-brand"><Image src="/logo.png" alt="BVI" width={38} height={38} className="shrink-0 object-contain" /><div><p className="staff-brand-title">BVI <span>Staff</span></p><p className="staff-brand-subtitle">Beach Volley Institute</p></div></Link>;
  const navigation = <nav aria-label="Navigazione staff" className="flex-1 overflow-y-auto pt-2">
    {[...new Set(menuItems.map((item) => item.group))].map((group) => <div key={group}><p className="staff-nav-label">{group}</p><div className="space-y-1">{menuItems.filter((item) => item.group === group).map((item) => <Link key={item.path} href={item.path} onClick={() => setIsMenuOpen(false)} aria-current={isCurrentPage(pathname, item.path) ? "page" : undefined} className="staff-nav-link"><StaffIcon name={item.icon} /><span>{item.name}</span></Link>)}</div></div>)}
  </nav>;
  const footer = <div className="staff-sidebar-footer"><p className="staff-db-status" title={dbStatusText}><span className="staff-db-dot" data-connected={dbConnected} />{dbStatusText}</p><button type="button" onClick={() => signOut({ redirectUrl: "/staff" })} className="mt-3 flex w-full items-center gap-3 py-2 text-left text-xs font-medium text-slate-300 hover:text-white"><StaffIcon name="logout" className="h-4 w-4" />Esci dal portale</button></div>;

  return <>
    <a href="#staff-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-lg focus:bg-[#FFD700] focus:p-3 focus:text-[#0a1628]">Vai al contenuto</a>
    <aside className="staff-sidebar">{brand}{navigation}{footer}</aside>
    <header className="staff-topbar">
      <div className="staff-breadcrumb"><button ref={menuButton} type="button" aria-label={isMenuOpen ? "Chiudi menu staff" : "Apri menu staff"} aria-expanded={isMenuOpen} aria-controls="staff-drawer" className="staff-menu-toggle" onClick={() => setIsMenuOpen((value) => !value)}><StaffIcon name="menu" /></button><Link href="/staff/dashboard" aria-label="BVI Staff · Dashboard" className="staff-tablet-brand"><Image src="/logo.png" alt="BVI" width={26} height={26} /></Link><span>Area di gestione</span><span aria-hidden="true">/</span><strong>{sectionTitle}</strong></div>
      <div className="staff-top-actions"><Link href="/" target="_blank" rel="noopener noreferrer" className="staff-public-link">Sito pubblico<StaffIcon name="external" className="h-3.5 w-3.5" /></Link><div className="staff-user"><span className="staff-avatar" aria-hidden="true">{(username || "S").slice(0, 2).toLocaleUpperCase("it-IT")}</span><span className="staff-user-name">{username || "Staff"}</span></div></div>
    </header>
    <span id="staff-content" tabIndex={-1} />
    {isMenuOpen && <div id="staff-drawer" className="staff-drawer" onClick={closeMenu}><aside ref={drawer} role="dialog" aria-modal="true" aria-label="Menu staff" className="staff-drawer-panel" onClick={(event) => event.stopPropagation()}><div className="mb-2 flex items-center justify-between"><span className="px-2 text-sm font-bold">BVI Staff</span><button ref={closeButton} type="button" aria-label="Chiudi menu" onClick={closeMenu} className="flex h-10 w-10 items-center justify-center rounded-lg text-white"><StaffIcon name="close" /></button></div>{navigation}{footer}</aside></div>}
  </>;
}
