"use server";

import { AuthError } from "next-auth";
import { headers } from "next/headers";
import { signIn } from "@/lib/auth";
import { safeCallbackUrl } from "@/lib/auth/callback-url";
import { clientIpFromHeaders } from "@/lib/auth/client-ip";
import { checkSignInRateLimit } from "@/lib/auth/rate-limit";

import { INVALID_CREDENTIALS, TOO_MANY_ATTEMPTS } from "./messages";

export type SignInState = { error?: string };

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  // The limit is checked first: a refused attempt never reaches the password check.
  const ip = clientIpFromHeaders(await headers());
  const { allowed } = await checkSignInRateLimit(ip);
  if (!allowed) return { error: TOO_MANY_ATTEMPTS };

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: safeCallbackUrl(formData.get("callbackUrl")?.toString()),
    });
    return {};
  } catch (err) {
    // signIn redirects on success by throwing; only Auth.js errors are failed logins.
    if (err instanceof AuthError) return { error: INVALID_CREDENTIALS };
    throw err;
  }
}
