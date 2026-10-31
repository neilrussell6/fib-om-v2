"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { signOutAction } from "./actions";

/** A plain button calling the Server Action (a <form action> would add an unnamed hidden input). */
export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => signOutAction())}
    >
      Sign out
    </Button>
  );
}
