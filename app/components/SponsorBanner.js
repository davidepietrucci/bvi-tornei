"use client";

import { useState, useEffect } from "react";

const DEFAULT_SPONSORS = [
  { id: "s1", nome: "Mikasa", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/1a/Mikasa_Sports_logo.svg", linkUrl: "https://mikasasports.co.jp/en/" },
  { id: "s2", nome: "Decathlon", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/12/Decathlon_Logo.svg", linkUrl: "https://www.decathlon.it" },
  { id: "s3", nome: "Red Bull", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b5/Red_Bull_Logo.svg", linkUrl: "https://www.redbull.com" },
  { id: "s4", nome: "Wilson", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/07/Wilson_Sporting_Goods_logo.svg", linkUrl: "https://www.wilson.com" }
];

export default function SponsorBanner({ customSponsors = null, title = "Partner & Sponsor" }) {
  const [sponsors, setSponsors] = useState(customSponsors || []);

  useEffect(() => {
    if (customSponsors) return;

    fetch("/api/db?type=sponsors", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          setSponsors(json.data);
        } else {
          setSponsors(DEFAULT_SPONSORS);
        }
      })
      .catch((err) => {
        console.error("Errore fetch sponsor:", err);
        setSponsors(DEFAULT_SPONSORS);
      });
  }, [customSponsors]);

  const displaySponsors = sponsors.length > 0 ? sponsors : DEFAULT_SPONSORS;

  let baseSponsors = [...displaySponsors];
  while (baseSponsors.length < 10) {
    baseSponsors = [...baseSponsors, ...displaySponsors];
  }
  const doubleSponsors = [...baseSponsors, ...baseSponsors];

  return (
    <section className="w-full py-6 bg-transparent border-y border-transparent overflow-hidden select-none">
      <div className="max-w-7xl mx-auto px-4">
        {title && (
          <h3 className="text-center text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">
            {title}
          </h3>
        )}

        <div className="relative overflow-hidden w-full animate-marquee-paused">
          <div className="animate-marquee items-center gap-8 sm:gap-12">
            {doubleSponsors.map((sp, idx) => {
              const content = (
                <div className="flex items-center justify-center h-12 w-32 opacity-100 hover:scale-105 transition-all duration-200 cursor-pointer">
                  <img
                    src={sp.logoUrl}
                    alt={sp.nome || "Sponsor"}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              );

              return sp.linkUrl ? (
                <a
                  key={`${sp.id || idx}-${idx}`}
                  href={sp.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={sp.nome}
                >
                  {content}
                </a>
              ) : (
                <div key={`${sp.id || idx}-${idx}`}>{content}</div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
