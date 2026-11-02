import type { Option } from "@/lib/resources";
import { type StatusKey, statusColors } from "@/lib/theme/palette";

/** A status as a coloured pill (spec 06; any status list since spec 07). */
export function StatusPill({ status, options }: { status: string; options: Option[] }) {
  const colors = statusColors[status as StatusKey] ?? statusColors.archived;
  const label = options.find((o) => o.value === status)?.label ?? status;
  return (
    <span
      className="rounded-[10px] px-2 py-[3px] text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: colors.bg, color: colors.fg }}
    >
      {label}
    </span>
  );
}
