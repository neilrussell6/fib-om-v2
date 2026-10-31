import NextAuth from "next-auth";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import Credentials from "next-auth/providers/credentials";
import { verifyCredentials } from "@/lib/auth/credentials";
import { sessionConfig } from "@/lib/auth/session-config";
import { findUserByEmail } from "@/lib/db/queries/users";

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
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.email = token.email ?? "";
      }
      return session;
    },
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
