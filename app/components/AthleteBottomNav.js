"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import StaffIcon from "@/app/components/StaffIcon";

const items = [
  { name: "Home", path: "/atleta/dashboard", icon: "dashboard" },
  { name: "Iscrizioni", path: "/atleta/iscrizioni", icon: "registrations" },
  { name: "Iscriviti", path: "/atleta/iscriviti", icon: "plus" },
  { name: "Partite", path: "/atleta/gironi", icon: "management" },
  { name: "Profilo", path: "/atleta/profilo", icon: "athletes" },
];
export default function AthleteBottomNav({ notificheCount = 0 }) {
  const pathname = usePathname(), router = useRouter();
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  useEffect(() => {
    const scroll = () => {
      const y = window.scrollY;
      if (y > lastScrollY + 10 && y > 100) setVisible(false);
      else if (y < lastScrollY - 5) setVisible(true);
      setLastScrollY(y);
    };
    window.addEventListener("scroll", scroll, { passive: true });
    return () => window.removeEventListener("scroll", scroll);
  }, [lastScrollY]);
  return <nav aria-label="Navigazione rapida atleta" className={`bvi-athlete-bottom-nav fixed inset-x-0 bottom-0 z-[200] xl:hidden transition-transform ${visible ? "translate-y-0" : "translate-y-full"}`}><div className="flex">
    {items.map((item) => <button key={item.path} type="button" aria-label={item.name} aria-current={pathname === item.path ? "page" : undefined} onClick={() => router.push(item.path)}><StaffIcon name={item.icon} className="h-5 w-5" /><span>{item.name}</span>{item.name === "Home" && notificheCount > 0 && <span className="absolute right-[calc(50%-18px)] top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] text-white">{notificheCount > 9 ? "9+" : notificheCount}</span>}</button>)}
  </div></nav>;
}
