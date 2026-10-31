"use client";

import { Input } from "@/components/ui/input";

/** A number input whose value never changes on mouse-wheel scroll (it loses focus instead, as in web3). */
export function NumberInput(props: Omit<React.ComponentProps<typeof Input>, "type">) {
  return (
    <Input
      {...props}
      type="number"
      step={1}
      inputMode="numeric"
      onWheel={(e) => {
        e.currentTarget.blur();
        props.onWheel?.(e);
      }}
    />
  );
}
