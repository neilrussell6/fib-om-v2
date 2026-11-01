import { ORDER_STATUS } from "@/lib/resources";
import { type StatusKey, statusColors } from "@/lib/theme/palette";

/** The order status as a coloured pill (spec 06). */
export function StatusPill({ status }: { status: string }) {
  const colors = statusColors[status as StatusKey] ?? statusColors.archived;
  const label = ORDER_STATUS.find((o) => o.value === status)?.label ?? status;
  return (
    <span
      className="rounded-[10px] px-2 py-[3px] text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: colors.bg, color: colors.fg }}
    >
      {label}
    </span>
  );
}
