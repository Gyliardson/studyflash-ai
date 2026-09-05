import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/termos",
  "/privacidade",
  "/offline",
  "/sign-in(.*)",
  "/sign-up(.*)"
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Ignorar ficheiros estáticos (_next, imagens, etc)
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Correr sempre para rotas de API
    '/(api|trpc)(.*)',
    // Correr sempre para rotas internas do Clerk Frontend API/handshake
    '/__clerk/(.*)',
  ],
};
