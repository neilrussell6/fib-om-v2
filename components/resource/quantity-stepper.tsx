"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { NumberInput } from "./number-input";

const asNumber = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));

/**
 * The Order Items dialog's Quantity (spec 08): − and + around a number input.
 * − never goes below 1 and + starts from 1 on an empty field; typing still works.
 */
export function QuantityStepper({
  id,
  name,
  value,
  onChange,
  onBlur,
  ...aria
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-required"?: boolean;
}) {
  const n = asNumber(value);
  const step = (by: number) => {
    const next = n === null ? 1 : Math.max(1, Math.trunc(n) + by);
    onChange(String(next));
  };
  const button =
    "flex size-10 shrink-0 items-center justify-center rounded-md border border-input bg-background text-label outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
  return (
    <div className="flex w-[150px] items-center gap-1.5">
      <button type="button" aria-label="Decrease quantity" className={button} disabled={n === null || n <= 1} onClick={() => step(-1)}>
        <MinusIcon aria-hidden="true" className="size-4" />
      </button>
      <NumberInput
        id={id}
        name={name}
        value={value}
        min={1}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="text-center tabular-nums"
        {...aria}
      />
      <button type="button" aria-label="Increase quantity" className={button} onClick={() => step(1)}>
        <PlusIcon aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
