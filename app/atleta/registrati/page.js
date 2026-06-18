"use client";

import { SignUp } from "@clerk/nextjs";

export default function AtletaRegistrati() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4" style={{backgroundColor: "#f0f4ff"}}>
      <div className="my-8">
        <SignUp
          appearance={{
            elements: {
              formButtonPrimary: 'bg-[#0a1628] hover:bg-[#0a1628]/90 text-white font-bold',
              footerActionLink: 'text-[#0a1628] hover:underline font-bold',
              card: 'border-t-4 border-[#FFD700] shadow-xl rounded-2xl',
              headerTitle: 'text-[#0a1628] font-black uppercase tracking-tighter',
            }
          }}
          signInUrl="/atleta"
          forceRedirectUrl="/atleta/dashboard"
        />
      </div>
    </main>
  );
}
