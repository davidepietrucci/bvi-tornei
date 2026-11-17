"use client";

import { usePathname } from "next/navigation";

export default function BrandTheme({ children }) {
  const pathname = usePathname() || "/";
  if (pathname === "/staff" || pathname.startsWith("/staff/")) return children;
  const athlete = pathname === "/atleta" || pathname.startsWith("/atleta/");
  const live = pathname === "/live" || pathname === "/gironi";
  return <div className={`bvi-theme ${athlete ? "bvi-athlete" : "bvi-public"}${live ? " bvi-live" : ""}`}>{children}</div>;
}
