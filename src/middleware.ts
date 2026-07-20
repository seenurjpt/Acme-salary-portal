export { auth as middleware } from "@/auth";

// Gate every page except login behind auth (redirects to /login via the `authorized`
// callback in src/auth.ts). API routes are excluded on purpose: each handler does its own
// `requireActor()` check and returns JSON 401 rather than an HTML redirect.
export const config = {
  matcher: ["/((?!api|login|_next/static|_next/image|favicon.ico).*)"],
};
