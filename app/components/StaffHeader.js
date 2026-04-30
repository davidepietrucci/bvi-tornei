"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function StaffHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const menuItems = [
    { name: "Dashboard", path: "/staff/dashboard" },
    { name: "Iscrizioni", path: "/staff/iscrizioni" },
    { name: "Anagrafica Atleti", path: "/staff/atleti" },
    { name: "Tornei", path: "/staff/tornei" },
    { name: "Gironi", path: "/staff/gironi" },
    { name: "Classifica", path: "/staff/classifica" },
    { name: "Tabellone", path: "/staff/tabellone" },
    { name: "Pagamenti", path: "/staff/pagamenti" },
  ];

  return (
    <header className="bg-white py-3 px-4 md:px-8 flex justify-between items-center shadow-md border-b-4 sticky top-0 z-[100]" style={{borderColor: "#0a1628"}}>
      <div className="flex items-center gap-3">
        <Image src="/logo.png" alt="BVI Logo" width={40} height={40} className="object-contain" />
        <h1 className="text-xl font-black uppercase tracking-tighter" style={{color: "#0a1628"}}>BVI Staff</h1>
      </div>

      {/* Desktop Navigation */}
      <nav className="hidden xl:flex gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200">
        {menuItems.map((item) => (
          <a
            key={item.path}
            href={item.path}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              pathname === item.path
                ? "bg-white text-[#0a1628] shadow-sm border border-gray-100"
                : "text-gray-400 hover:text-gray-800"
            }`}
          >
            {item.name}
          </a>
        ))}
      </nav>

      <div className="flex items-center gap-4">
        <a href="/" className="hidden sm:block hover:underline font-bold text-red-500 text-xs uppercase tracking-widest">Esci</a>
        
        {/* Mobile Menu Button */}
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="xl:hidden w-10 h-10 flex items-center justify-center bg-gray-100 rounded-xl text-[#0a1628]"
        >
          {isMenuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-[110] xl:hidden" onClick={() => setIsMenuOpen(false)}>
          <div className="absolute right-0 top-0 h-full w-72 bg-white shadow-2xl p-6 flex flex-col gap-6 animate-in slide-in-from-right" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b pb-4">
                <span className="font-black text-[#0a1628]">MENU STAFF</span>
                <button onClick={() => setIsMenuOpen(false)} className="text-2xl">✕</button>
            </div>
            <nav className="flex flex-col gap-2">
              {menuItems.map((item) => (
                <a
                  key={item.path}
                  href={item.path}
                  className={`p-4 rounded-2xl text-sm font-bold transition-all ${
                    pathname === item.path
                      ? "bg-[#0a1628] text-white shadow-lg"
                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.name}
                </a>
              ))}
            </nav>
            <div className="mt-auto pt-6 border-t">
                <a href="/" className="flex items-center justify-center p-4 bg-red-50 text-red-600 rounded-2xl font-black text-xs uppercase tracking-widest">
                    Esci dal Portale
                </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
