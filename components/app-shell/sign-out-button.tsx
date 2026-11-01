"use client";

import { useTransition } from "react";
import { signOutAction } from "./actions";

/** A plain button calling the Server Action (a <form action> would add an unnamed hidden input). */
export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => signOutAction())}
      className="text-xs text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:underline disabled:opacity-50"
    >
      Sign out
    </button>
  );
}
