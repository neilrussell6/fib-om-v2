"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/** Shows "<Singular> not found" once, for a `?item=` id that matches nothing (spec 06 AC-18, spec 07 AC-6). */
export function NotFoundToast({ label }: { label: string }) {
  useEffect(() => {
    toast.error(`${label} not found`, { id: "panel-not-found" });
  }, [label]);
  return null;
}
