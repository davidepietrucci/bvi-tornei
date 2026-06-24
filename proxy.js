import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define public routes (accessible without login)
const isPublicRoute = createRouteMatcher([
  '/',
  '/manifest.json',
  '/classifica(.*)',
  '/gironi(.*)',
  '/live(.*)',
  '/iscrizioni(.*)',
  '/api/iscrizioni(.*)',
  '/api/db(.*)',
  // Login and Registration routes
  '/staff',
  '/atleta',
  '/atleta/registrati(.*)'
]);

export default clerkMiddleware(async (auth, request) => {
  const pathname = request.nextUrl.pathname;

  // 1. If it's a public route, let it pass
  if (isPublicRoute(request)) {
    return NextResponse.next();
  }

  // 2. Verify authentication
  const { userId, sessionClaims } = await auth();
  
  if (!userId) {
    // Redirect unauthenticated staff requests to the staff login page
    if (pathname.startsWith('/staff')) {
      const staffSignInUrl = new URL('/staff', request.url);
      staffSignInUrl.searchParams.set('redirect_url', request.url);
      return NextResponse.redirect(staffSignInUrl);
    }
    
    // Redirect unauthenticated athlete/API requests to the athlete login page
    if (pathname.startsWith('/atleta') || pathname.startsWith('/api')) {
      const atletaSignInUrl = new URL('/atleta', request.url);
      atletaSignInUrl.searchParams.set('redirect_url', request.url);
      return NextResponse.redirect(atletaSignInUrl);
    }
  }

  // 3. Role-based protection (only if logged in)
  const role = sessionClaims?.metadata?.role || "atleta";

  // Prevent athletes from accessing staff pages
  if (pathname.startsWith('/staff') && role !== 'admin' && role !== 'staff') {
    // Redirect athletes attempting to access staff area to athlete dashboard
    return NextResponse.redirect(new URL('/atleta/dashboard', request.url));
  }

  // Proceed with Clerk request protection
  await auth.protect();
});

export const config = {
  matcher: [
    // Apply middleware to all routes except Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
