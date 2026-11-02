"use client";

import { useRouter } from "next/navigation";
import { LinkButton } from "../link-button";
import { openPanel } from "../panel/history";

/**
 * The list's "New …" button (spec 08): a link to the list with `new=1`, so it works from
 * the keyboard and in a new tab. A plain click opens the create dialog as a new history
 * layer (the panels' rules).
 */
export function NewRecordLink({ href, label }: { href: string; label: string }) {
  const router = useRouter();
  return (
    <LinkButton
      href={href}
      variant="default"
      scroll={false}
      data-create-trigger=""
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        openPanel(router, href, "new");
      }}
    >
      {label}
    </LinkButton>
  );
}
