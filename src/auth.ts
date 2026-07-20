/**
 * Auth — a single HR-Manager role (per assessment guidance, no RBAC).
 *
 * Credentials provider checks against the seeded HR account from env. This exists to show
 * the authentication seam and protect the app; it is intentionally simple.
 */

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    // Used by the middleware: without this, `auth` as middleware only attaches the
    // session and never blocks — pages would render for signed-out visitors.
    authorized: ({ auth }) => !!auth?.user,
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: (creds) => {
        const email = process.env.HR_EMAIL ?? "hr@acme.com";
        const password = process.env.HR_PASSWORD ?? "password123";
        if (creds?.email === email && creds?.password === password) {
          return { id: "hr-manager", name: "HR Manager", email };
        }
        return null;
      },
    }),
  ],
});
