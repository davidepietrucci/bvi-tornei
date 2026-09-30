"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { itIT } from "@clerk/localizations/it-IT";
import { usePathname } from "next/navigation";

export function Providers({ children }) {
  const pathname = usePathname();
  const isStaff = pathname?.startsWith("/staff");

  const localization = {
    ...itIT,
    signIn: {
      ...itIT.signIn,
      start: {
        ...itIT.signIn.start,
        title: isStaff ? "BVI STAFF" : "BVI ATLETA",
        subtitle: isStaff ? "Accedi al Portale Staff" : "Accedi al Portale Atleta",
      },
    },
  };

  return (
    <ClerkProvider localization={localization}>
      {children}
    </ClerkProvider>
  );
}
