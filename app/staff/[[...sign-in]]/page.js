"use client";

import { SignIn, useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StaffLogin() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && user) {
      const role = user.publicMetadata?.role || "staff";
      if (role === "admin" || role === "staff") {
        router.replace("/staff/dashboard");
      } else {
        router.replace("/atleta/dashboard");
      }
    }
  }, [user, isLoaded, router]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#f0f4ff] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#0a1628] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4" style={{backgroundColor: "#f0f4ff"}}>
      <div className="my-8">
        <SignIn
          appearance={{
            elements: {
              card: {
                borderTop: "4px solid #0a1628",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                borderRadius: "1rem",
                backgroundColor: "#ffffff",
                padding: "2rem",
                width: "100%",
                maxWidth: "400px",
              },
              socialButtons: {
                display: "none",
              },
              dividerRow: {
                display: "none",
              },
              headerTitle: {
                color: "#0a1628",
                fontWeight: "900",
                textTransform: "uppercase",
                letterSpacing: "-0.05em",
                fontSize: "1.5rem",
                textAlign: "center",
              },
              headerSubtitle: {
                color: "#94a3b8",
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontSize: "10px",
                textAlign: "center",
                marginTop: "0.25rem",
              },
              formFieldLabel: {
                color: "#0a1628",
                fontWeight: "900",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontSize: "10px",
                marginBottom: "0.375rem",
              },
              formFieldInput: {
                borderRadius: "0.75rem",
                border: "1px solid #e2e8f0",
                fontSize: "0.875rem",
                padding: "0.625rem 1rem",
                backgroundColor: "rgba(248, 250, 252, 0.5)",
                "&:focus": {
                  borderColor: "#0a1628",
                  boxShadow: "0 0 0 1px #0a1628",
                }
              },
              formButtonPrimary: {
                backgroundColor: "#FFD700",
                color: "#0a1628",
                fontWeight: "900",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                padding: "0.75rem",
                borderRadius: "0.75rem",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                transition: "all 0.2s",
                "&:hover": {
                  backgroundColor: "#e6c300",
                },
                "&:active": {
                  transform: "scale(0.98)",
                }
              },
              footerAction: {
                display: "none",
              },
              footerActionLink: {
                color: "#0a1628",
                fontWeight: "700",
                fontSize: "0.75rem",
                textDecoration: "none",
                "&:hover": {
                  textDecoration: "underline",
                }
              },
              footerActionText: {
                color: "#94a3b8",
                fontSize: "0.75rem",
                fontWeight: "600",
              },
              dividerLine: {
                backgroundColor: "#f1f5f9",
              },
              dividerText: {
                color: "#94a3b8",
                fontWeight: "700",
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              },
            }
          }}
          forceRedirectUrl="/staff/dashboard"
          routing="path"
          path="/staff"
        />
      </div>
    </main>
  );
}
