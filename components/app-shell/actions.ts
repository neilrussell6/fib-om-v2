"use server";

import { auth, signOut } from "@/lib/auth";
import { bumpSessionVersion } from "@/lib/db/queries/users";

/** Signs out everywhere: bumping the session version rejects every earlier session cookie. */
export async function signOutAction() {
  const session = await auth();
  if (session?.user?.id) await bumpSessionVersion(session.user.id);
  await signOut({ redirectTo: "/login" });
}
