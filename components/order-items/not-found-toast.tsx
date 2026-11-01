"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/** Shows "Order item not found" once, for a `?item=` id that matches nothing (spec 06 AC-18). */
export function NotFoundToast() {
  useEffect(() => {
    toast.error("Order item not found", { id: "order-item-not-found" });
  }, []);
  return null;
}
