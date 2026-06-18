import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Rotte pubbliche generali (esterne alle aree personali)
const isGeneralPublicRoute = createRouteMatcher([
  '/',
  '/manifest.json',
  '/classifica(.*)',
  '/gironi(.*)',
  '/live(.*)',
  '/iscrizioni(.*)',
  '/api/iscrizioni(.*)',
  '/api/db(.*)',
  '/api/export-users(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  const pathname = request.nextUrl.pathname;
  
  // Determina se il percorso appartiene alle aree funzionali protette dello staff o dell'atleta
  const isProtectedPath = 
    pathname.startsWith('/staff/dashboard') ||
    pathname.startsWith('/staff/tornei') ||
    pathname.startsWith('/staff/iscrizioni') ||
    pathname.startsWith('/staff/pagamenti') ||
    pathname.startsWith('/staff/gironi') ||
    pathname.startsWith('/staff/tabellone') ||
    pathname.startsWith('/staff/classifica') ||
    pathname.startsWith('/staff/moduli') ||
    pathname.startsWith('/staff/atleti') ||
    pathname.startsWith('/staff/gestione-staff') ||
    pathname.startsWith('/atleta/dashboard') ||
    pathname.startsWith('/atleta/iscrizioni') ||
    pathname.startsWith('/atleta/gironi') ||
    pathname.startsWith('/atleta/iscriviti') ||
    pathname.startsWith('/atleta/notifiche') ||
    pathname.startsWith('/atleta/profilo') ||
    pathname.startsWith('/atleta/classifica');

  // Se è una rotta protetta o non è una rotta pubblica generale, verifichiamo l'autenticazione
  if (isProtectedPath || (!isGeneralPublicRoute(request) && !pathname.startsWith('/staff') && !pathname.startsWith('/atleta'))) {
    const { userId } = await auth();
    
    if (!userId) {
      // Se l'utente tenta di accedere all'area staff da disconnesso, va al login staff
      if (pathname.startsWith('/staff')) {
        const staffSignInUrl = new URL('/staff', request.url);
        staffSignInUrl.searchParams.set('redirect_url', request.url);
        return NextResponse.redirect(staffSignInUrl);
      }
      
      // Se tenta di accedere all'area atleta da disconnesso, va al login atleta
      if (pathname.startsWith('/atleta')) {
        const atletaSignInUrl = new URL('/atleta', request.url);
        atletaSignInUrl.searchParams.set('redirect_url', request.url);
        return NextResponse.redirect(atletaSignInUrl);
      }
    }
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Applica il middleware a tutti i file tranne gli statici di Next.js e i file immagine/icone
    '/((?!_next|[^?]*\\.(?:html|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
