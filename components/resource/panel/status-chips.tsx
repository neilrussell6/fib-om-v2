"use client";

import type { Option } from "@/lib/resources";
import { type StatusKey, statusColors } from "@/lib/theme/palette";

/** Status as radio chips in the pill colours (spec 06 panel, shared since spec 07). */
export function StatusChips({
  name,
  label,
  value,
  options,
  onChange,
}: {
  /** Radio group name, unique per panel instance. */
  name: string;
  /** Accessible name of the radio group. */
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value === o.value;
        const c = statusColors[o.value as StatusKey] ?? statusColors.archived;
        return (
          <label
            key={o.value}
            className="relative cursor-pointer rounded-md border px-3 py-1.5 text-[13px] has-focus-visible:ring-2 has-focus-visible:ring-ring"
            style={on ? { borderColor: c.fg, backgroundColor: c.bg, color: c.fg } : { borderColor: "var(--input)", backgroundColor: "#ffffff", color: "var(--label)" }}
          >
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={on}
              onChange={() => onChange(o.value)}
              className="absolute inset-0 m-0 cursor-pointer appearance-none opacity-0"
            />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}
