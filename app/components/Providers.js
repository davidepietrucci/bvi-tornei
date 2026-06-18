"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

export function Providers({ children }) {
  const pathname = usePathname();
  const isStaff = pathname?.startsWith("/staff");

  const customLocalization = {
    signIn: {
      start: {
        title: isStaff ? "BVI STAFF" : "BVI ATLETA",
        subtitle: isStaff ? "Accedi al Portale Staff" : "Accedi al Portale Atleta",
      },
    },
  };

  return (
    <ClerkProvider localization={customLocalization}>
      {children}
    </ClerkProvider>
  );
}
