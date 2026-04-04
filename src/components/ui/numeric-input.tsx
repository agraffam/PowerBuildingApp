"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function clampNum(n: number, min?: number, max?: number) {
  let x = n;
  if (min != null) x = Math.max(min, x);
  if (max != null) x = Math.min(max, x);
  return x;
}

function snapHalfStep(n: number) {
  return Math.round(n * 2) / 2;
}

type NumericInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "onChange" | "defaultValue"
> & {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  decimals?: boolean;
  /** On blur, snap to nearest 0.5 after clamp (for RPE). */
  snapHalf?: boolean;
  /** When blur leaves empty or invalid text. */
  fallback: number;
};

/**
 * Text-field numeric editor: allows clearing and re-typing; commits on blur or Enter.
 * Avoids `type="number"` + `Number(x) || fallback` which injects 1/7/8 while the field looks empty.
 */
export function NumericInput({
  value,
  onValueChange,
  min,
  max,
  decimals = false,
  snapHalf = false,
  fallback,
  className,
  disabled,
  onBlur,
  onKeyDown,
  ...rest
}: NumericInputProps) {
  const [text, setText] = React.useState(() =>
    Number.isFinite(value) ? String(value) : String(fallback),
  );
  const lastProp = React.useRef(value);

  React.useEffect(() => {
    if (value !== lastProp.current) {
      lastProp.current = value;
      setText(Number.isFinite(value) ? String(value) : String(fallback));
    }
  }, [value, fallback]);

  const allowedInput = (t: string) => {
    if (decimals) return t === "" || /^\d*\.?\d*$/.test(t);
    return t === "" || /^\d*$/.test(t);
  };

  const commitBlur = () => {
    const t = text.trim();
    if (t === "" || t === ".") {
      const f = clampNum(fallback, min, max);
      const out = snapHalf ? clampNum(snapHalfStep(f), min, max) : f;
      setText(String(out));
      onValueChange(out);
      lastProp.current = out;
      return;
    }
    let n = Number(t);
    if (!Number.isFinite(n)) {
      const f = clampNum(fallback, min, max);
      setText(String(f));
      onValueChange(f);
      lastProp.current = f;
      return;
    }
    if (snapHalf) n = snapHalfStep(n);
    n = clampNum(n, min, max);
    setText(String(n));
    onValueChange(n);
    lastProp.current = n;
  };

  return (
    <Input
      {...rest}
      type="text"
      inputMode={decimals ? "decimal" : "numeric"}
      disabled={disabled}
      className={cn(className)}
      value={text}
      onChange={(e) => {
        const t = e.target.value;
        if (!allowedInput(t)) return;
        setText(t);
      }}
      onBlur={(e) => {
        commitBlur();
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        }
        onKeyDown?.(e);
      }}
    />
  );
}

type NullableNumericInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "onChange" | "defaultValue"
> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
  min?: number;
  max?: number;
  decimals?: boolean;
};

export function NullableNumericInput({
  value,
  onValueChange,
  min,
  max,
  decimals = false,
  className,
  disabled,
  onBlur,
  onKeyDown,
  ...rest
}: NullableNumericInputProps) {
  const [text, setText] = React.useState(() => (value == null ? "" : String(value)));
  const lastProp = React.useRef(value);

  React.useEffect(() => {
    if (value !== lastProp.current) {
      lastProp.current = value;
      setText(value == null ? "" : String(value));
    }
  }, [value]);

  const allowedInput = (t: string) => {
    if (decimals) return t === "" || /^\d*\.?\d*$/.test(t);
    return t === "" || /^\d*$/.test(t);
  };

  const commitBlur = () => {
    const t = text.trim();
    if (t === "" || t === ".") {
      setText("");
      onValueChange(null);
      lastProp.current = null;
      return;
    }
    const n = Number(t);
    if (!Number.isFinite(n)) {
      setText(value == null ? "" : String(value));
      return;
    }
    const c = clampNum(n, min, max);
    setText(String(c));
    onValueChange(c);
    lastProp.current = c;
  };

  return (
    <Input
      {...rest}
      type="text"
      inputMode={decimals ? "decimal" : "numeric"}
      disabled={disabled}
      className={cn(className)}
      value={text}
      onChange={(e) => {
        const t = e.target.value;
        if (!allowedInput(t)) return;
        setText(t);
      }}
      onBlur={(e) => {
        commitBlur();
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        }
        onKeyDown?.(e);
      }}
    />
  );
}
