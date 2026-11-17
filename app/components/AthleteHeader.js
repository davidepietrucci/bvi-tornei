"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import StaffIcon from "@/app/components/StaffIcon";

const MENU = [
  { name: "Dashboard", path: "/atleta/dashboard", icon: "dashboard" },
  { name: "Le mie iscrizioni", path: "/atleta/iscrizioni", icon: "registrations" },
  { name: "Le mie partite", path: "/atleta/gironi", icon: "management" },
  { name: "Tour", path: "/tour", icon: "tour" },
  { name: "Iscriviti a un torneo", path: "/atleta/iscriviti", icon: "plus" },
  { name: "Notifiche", path: "/atleta/notifiche", icon: "notifications" },
  { name: "Profilo", path: "/atleta/profilo", icon: "athletes" },
];

export default function AthleteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const menuButton = useRef(null), drawer = useRef(null), closeButton = useRef(null);
  const name = user?.firstName || user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress?.split("@")[0] || "Atleta";
  const staff = isLoaded && ["admin", "staff"].includes(user?.publicMetadata?.role);
  const close = () => { setOpen(false); menuButton.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const key = (event) => {
      if (event.key === "Escape") { setOpen(false); menuButton.current?.focus(); }
      if (event.key !== "Tab") return;
      const controls = drawer.current?.querySelectorAll('a[href], button:not([disabled])');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key);
    const desktop = window.matchMedia("(min-width: 1280px)");
    const resize = (event) => { if (event.matches) setOpen(false); };
    desktop.addEventListener("change", resize);
    return () => { document.removeEventListener("keydown", key); desktop.removeEventListener("change", resize); };
  }, [open]);
  const brand = <Link href="/atleta/dashboard" className="bvi-athlete-brand"><Image src="/logo.png" alt="BVI" width={38} height={38} /><div><strong>BVI <span>Atleta</span></strong><small>Il tuo spazio, dentro il torneo.</small></div></Link>;
  const nav = <nav aria-label="Navigazione atleta" className="bvi-athlete-navigation">{MENU.map((item) => <Link key={item.path} href={item.path} onClick={() => setOpen(false)} aria-current={pathname === item.path || pathname.startsWith(`${item.path}/`) ? "page" : undefined}><StaffIcon name={item.icon} /><span>{item.name}</span></Link>)}{staff && <Link href="/staff/dashboard"><StaffIcon name="tournaments" />Area staff</Link>}</nav>;
  const footer = <div className="bvi-athlete-nav-footer"><p className="mb-3 truncate">Ciao, {name}</p><Link href="/" className="mb-2 flex min-h-10 items-center gap-2"><StaffIcon name="external" className="h-4 w-4" />Sito pubblico</Link><button onClick={() => signOut({ redirectUrl: "/" })} className="flex min-h-10 items-center gap-2"><StaffIcon name="logout" className="h-4 w-4" />Esci dal portale</button></div>;
  return <>
    <aside className="bvi-athlete-sidebar">{brand}{nav}{footer}</aside>
    <header className="bvi-athlete-topbar"><Link href="/atleta/dashboard"><Image src="/logo.png" alt="BVI" width={30} height={30} />BVI Atleta</Link><div className="flex items-center gap-3"><Link href="/atleta/profilo" aria-label={`Profilo di ${name}`}><span className="bvi-user-avatar">{name.slice(0, 2).toLocaleUpperCase("it-IT")}</span></Link><button ref={menuButton} type="button" className="bvi-menu-button" aria-label={open ? "Chiudi menu atleta" : "Apri menu atleta"} aria-expanded={open} aria-controls="athlete-menu" onClick={() => setOpen((value) => !value)}><StaffIcon name="menu" /></button></div></header>
    {open && <div id="athlete-menu" className="bvi-athlete-drawer" onClick={close}><aside ref={drawer} role="dialog" aria-modal="true" aria-label="Menu atleta" className="bvi-athlete-drawer-panel" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between pb-3"><strong>BVI Atleta</strong><button ref={closeButton} type="button" aria-label="Chiudi menu atleta" onClick={close} className="flex h-11 w-11 items-center justify-center"><StaffIcon name="close" /></button></div>{nav}{footer}</aside></div>}
  </>;
}
