import { toast } from "sonner";
import type { Option } from "@/lib/resources";
import { markOpenedFromList, type PanelRouter } from "./history";

/** `<path>?<query>&item=<id>` for a list (other params kept). */
export const itemHref = (path: string, baseQuery: string, id: string) => `${path}?${baseQuery ? `${baseQuery}&` : ""}item=${id}`;

/**
 * The panel's success toast (spec 06 AC-25, spec 07 AC-10). When the saved status
 * no longer matches the selected tab it adds "Moved to <Status>." with a View action
 * that opens the record on that tab.
 */
export function savedToast({
  message,
  router,
  path,
  baseQuery,
  id,
  activeStatus,
  savedStatus,
  options,
}: {
  message: string;
  router: PanelRouter;
  path: string;
  baseQuery: string;
  id: string;
  activeStatus: string;
  savedStatus?: string;
  options?: Option[];
}): void {
  if (!activeStatus || !savedStatus || savedStatus === activeStatus) {
    toast.success(message);
    return;
  }
  const label = options?.find((o) => o.value === savedStatus)?.label ?? savedStatus;
  const params = new URLSearchParams(baseQuery);
  params.set("status", savedStatus);
  params.delete("page");
  const viewHref = itemHref(path, params.toString(), id);
  toast.success(`${message}. Moved to ${label}.`, {
    action: {
      label: "View",
      onClick: () => {
        markOpenedFromList(viewHref);
        router.push(viewHref, { scroll: false });
      },
    },
  });
}
