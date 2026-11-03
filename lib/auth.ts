import NextAuth from "next-auth";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import Credentials from "next-auth/providers/credentials";
import { verifyCredentials } from "@/lib/auth/credentials";
import { jwtCallback, sessionCallback } from "@/lib/auth/callbacks";
import { sessionConfig } from "@/lib/auth/session-config";
import { findUserByEmail, getSessionUser } from "@/lib/db/queries/users";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: sessionConfig,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: { label: "Email" }, password: { label: "Password", type: "password" } },
      authorize: (credentials) => verifyCredentials(credentials ?? {}, { findUserByEmail }),
    }),
  ],
  callbacks: {
    jwt: (params) => jwtCallback(params as Parameters<typeof jwtCallback>[0], getSessionUser) as never,
    session: (params) => sessionCallback(params as Parameters<typeof sessionCallback>[0]) as never,
  },
});

/** The current session, read once per request however many components ask for it. */
const getSession = cache(async () => {
  // Mark the render as request-time before Auth.js touches crypto (Cache Components).
  await connection();
  return auth();
});

/** Server-side session check for layouts and Server Actions (defence in depth behind proxy.ts). */
export async function requireSession() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  return session;
}
